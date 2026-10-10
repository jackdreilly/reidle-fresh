#!/usr/bin/env node
// Apply pending supabase/migrations/*.sql to a live project, the way `supabase db push` would, but over
// the Supabase Management API (HTTPS + one access token) so CI needs no database password.
//
//   SUPABASE_ACCESS_TOKEN=... node tools/db-migrate.mjs staging|prod [--dry-run]
//   DATABASE_URL=postgres://... node tools/db-migrate.mjs [--dry-run]       (plain psql, e.g. local)
//   ... node tools/db-migrate.mjs staging --drift <local DATABASE_URL>         (schema diff vs a local build)
//
// Each pending file runs in one transaction together with its row in supabase_migrations.schema_migrations
// (version = the filename's timestamp, same table and key the Supabase CLI uses), so a failing migration
// leaves nothing behind. Consequence: no `create index concurrently` in migrations.
// Refuses to run if the live history has versions the repo doesn't (someone applied SQL by hand).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const PROJECTS = { staging: 'noxissvouravthzvoapw', prod: 'fjnhsrkjdrmpxidjsfzd' };
const dir = new URL('../supabase/migrations/', import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const driftUrl = args.includes('--drift') ? args[args.indexOf('--drift') + 1] : null;
const target = args.find((a) => PROJECTS[a]);
const ref = target ? PROJECTS[target] : process.env.SUPABASE_PROJECT_REF;
const dbUrl = process.env.DATABASE_URL;
if (!ref && !dbUrl) die('usage: db-migrate.mjs staging|prod [--dry-run] [--drift <local db url>]  (or DATABASE_URL=...)');
if (ref && !process.env.SUPABASE_ACCESS_TOKEN) die('SUPABASE_ACCESS_TOKEN is not set');
const label = target ?? ref ?? 'DATABASE_URL';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// Run SQL on the target. `rows` returns the result rows of the last statement as objects.
async function run(sql, url = ref ? null : dbUrl) {
  if (url) {
    try {
      return execFileSync('psql', [url, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
        input: sql,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      throw new Error(`${label}: ${e.stderr || e.message}`);
    }
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}
async function rows(sql, url) {
  const wrapped = `select coalesce(json_agg(t), '[]') from (${sql}) t`;
  const out = await run(wrapped, url);
  return typeof out === 'string' ? JSON.parse(out) : out[0].coalesce;
}

async function main() {
  const files = readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((f) => ({ file: f, version: f.split('_')[0], name: f.slice(f.indexOf('_') + 1, -4) }));

  await run(`create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
  const applied = new Set(
    (await rows('select version from supabase_migrations.schema_migrations')).map((r) => r.version),
  );
  const known = new Set(files.map((f) => f.version));
  const unknown = [...applied].filter((v) => !known.has(v)).sort();
  if (unknown.length) {
    die(`${label}: live migration history has versions that are not in supabase/migrations: ${unknown.join(', ')}
Someone applied SQL outside this repo. Add it as a migration file, or fix the history, then re-run.`);
  }
  const pending = files.filter((f) => !applied.has(f.version));
  console.log(`${label}: ${applied.size} applied, ${pending.length} pending${pending.length ? ': ' + pending.map((f) => f.file).join(', ') : ''}`);

  for (const m of pending) {
    if (dryRun) continue;
    const sql = readFileSync(new URL(m.file, dir), 'utf8');
    const q = (s) => `'${s.replaceAll("'", "''")}'`;
    console.log(`${label}: applying ${m.file}`);
    await run(`begin;
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements) values (${q(m.version)}, ${q(m.name)}, array[${q(sql)}]);
commit;`);
  }

  if (driftUrl && pending.length) {
    console.log(`${label}: drift check skipped until the pending migrations are applied`);
  } else if (driftUrl) {
    const fp = readFileSync(new URL('./db-fingerprint.sql', import.meta.url), 'utf8').trim().replace(/;$/, '');
    const [live, repo] = [await rows(fp), await rows(fp, driftUrl)];
    const key = (r) => `${r.kind} ${r.name}`;
    const a = new Map(live.map((r) => [key(r), r.hash]));
    const b = new Map(repo.map((r) => [key(r), r.hash]));
    const diff = [...new Set([...a.keys(), ...b.keys()])]
      .filter((k) => a.get(k) !== b.get(k))
      .sort()
      .map((k) => `  ${k}: ${!a.has(k) ? 'missing on ' + label : !b.has(k) ? 'only on ' + label : 'differs'}`);
    if (diff.length) die(`${label}: schema drift vs a fresh build of supabase/migrations:\n${diff.join('\n')}`);
    console.log(`${label}: schema matches a fresh build of supabase/migrations (${live.length} objects)`);
  }
}

main().catch((e) => die(e.message));
