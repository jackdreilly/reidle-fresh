import { Pool, PoolClient } from "psql";

// Primary connection for writes (and fallback reads)
const PRIMARY_URL = Deno.env.get("POSTGRES_PRIMARY_URL") ??
  Deno.env.get("POSTGRES_URL") ??
  Deno.env.get("DATABASE_URL") ??
  "postgres://postgres:postgres@localhost:5432/postgres";

const POOL_SIZE = parseInt(Deno.env.get("POSTGRES_POOL_SIZE") ?? "4", 10);
const REQUIRE_TLS = Deno.env.get("POSTGRES_REQUIRE_TLS") === "true";
const TLS_CA_FILE = Deno.env.get("POSTGRES_CA_CERT_FILE");

function makePool(url: string): Pool {
  if (!REQUIRE_TLS && !TLS_CA_FILE) {
    return new Pool(url, POOL_SIZE, true);
  }

  const parsed = new URL(url);
  const caCertificate = TLS_CA_FILE
    ? Deno.readTextFileSync(TLS_CA_FILE)
    : undefined;
  return new Pool({
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    applicationName: parsed.searchParams.get("application_name") ?? undefined,
    tls: {
      enabled: true,
      enforce: true,
      caCertificates: caCertificate ? [caCertificate] : [],
    },
  }, POOL_SIZE, true);
}

// Global primary connection pool
let primaryPool = makePool(PRIMARY_URL);

// Cache for read replica pools by connection URL
const replicaPools = new Map<string, Pool>();

/**
 * Resolves the optimal read replica database URL based on the runtime region.
 * Deno Deploy automatically provides DENO_REGION (e.g. 'ord', 'iad', 'sfo', 'fra', 'sin', etc.).
 * Supports:
 *  1. Region-specific env var: POSTGRES_REPLICA_<REGION> (e.g. POSTGRES_REPLICA_FRA)
 *  2. JSON mapping in POSTGRES_REPLICAS: { "fra": "postgres://...", "us": "postgres://..." }
 *  3. Global read replica in POSTGRES_REPLICA_URL or POSTGRES_READ_URL
 *  4. Fallback to PRIMARY_URL
 */
export function getReadReplicaUrl(): string {
  const region = (Deno.env.get("DENO_REGION") ?? "").toLowerCase().trim();

  // 1. Check exact region env variable (e.g. POSTGRES_REPLICA_FRA)
  if (region) {
    const regionEnv = Deno.env.get(`POSTGRES_REPLICA_${region.toUpperCase()}`);
    if (regionEnv) return regionEnv;
  }

  // 2. Check JSON replica map if configured
  const replicasJson = Deno.env.get("POSTGRES_REPLICAS");
  if (replicasJson) {
    try {
      const map = JSON.parse(replicasJson) as Record<string, string>;
      if (region && map[region]) return map[region];
      // Check prefix matches (e.g. 'us', 'eu', 'ap')
      for (const [key, url] of Object.entries(map)) {
        if (region && (region.startsWith(key) || key.startsWith(region))) {
          return url;
        }
      }
    } catch (e) {
      console.error("Failed to parse POSTGRES_REPLICAS JSON:", e);
    }
  }

  // 3. Fallback to generic read replica URL
  const genericReplica = Deno.env.get("POSTGRES_REPLICA_URL") ??
    Deno.env.get("POSTGRES_READ_URL");
  if (genericReplica) return genericReplica;

  // 4. Default to primary
  return PRIMARY_URL;
}

/**
 * Get or create a connection pool for read operations.
 */
function getReadPool(): Pool {
  const replicaUrl = getReadReplicaUrl();
  if (replicaUrl === PRIMARY_URL) {
    return primaryPool;
  }
  let pool = replicaPools.get(replicaUrl);
  if (!pool) {
    pool = makePool(replicaUrl);
    replicaPools.set(replicaUrl, pool);
  }
  return pool;
}

/**
 * Safely acquire a client connection from a pool.
 */
async function acquireConnection(pool: Pool): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute a query runner against the read replica (or primary fallback).
 * If the read replica fails or is unreachable, transparently falls back to the primary database.
 */
export async function runRead<T>(
  runner: (cxn: PoolClient) => Promise<T> | T,
): Promise<T> {
  const readPool = getReadPool();
  let connection: PoolClient;
  try {
    connection = await acquireConnection(readPool);
  } catch (err) {
    // If we used a read replica and it failed, gracefully retry on primary
    if (readPool !== primaryPool) {
      console.warn("Read replica query failed, falling back to primary:", (err as Error).message);
      return runWrite(runner);
    }
    throw err;
  }

  try {
    return await runner(connection);
  } finally {
    connection.release();
  }
}

/**
 * Execute a query runner against the primary database (for writes, transactions, and mutations).
 */
export async function runWrite<T>(
  runner: (cxn: PoolClient) => Promise<T> | T,
): Promise<T> {
  const connection = await acquireConnection(primaryPool);
  try {
    return await runner(connection);
  } finally {
    connection.release();
  }
}

/**
 * Default runner: routes to primary (or write pool) for backward compatibility.
 */
export async function run<T>(
  runner: (cxn: PoolClient) => Promise<T> | T,
): Promise<T> {
  return runWrite(runner);
}

/**
 * Non-blocking page view logger. Runs asynchronously in the background
 * without blocking response latency or contending on user query connections.
 */
export function logPageViewAsync(args: {
  name: string;
  url: string;
  method: string;
}) {
  queueMicrotask(async () => {
    try {
      await runWrite(async (cxn) => {
        await cxn.queryObject`
          INSERT INTO page_views (name, url, method, created_at)
          VALUES (${args.name}, ${args.url}, ${args.method}, NOW())
        `;
      });
    } catch {
      // Fire-and-forget: logging errors should never crash or impact user requests
    }
  });
}
