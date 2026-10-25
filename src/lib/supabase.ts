// Lean Supabase client: just what Reidle needs (RPC over fetch + password auth with refresh).
// Realtime lives in ./realtime and is only loaded by the battle page; the sign-in calls live in ./auth-api,
// loaded only by the pages that sign in or change a login.
import { leagueId } from "./league";
const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string;
/** The URL hash this page was opened with (provider and email-link tokens), kept before the router rewrites the URL. */
export const landingHash = typeof location === "undefined" ? "" : location.hash;
const STORE = "reidle:auth";

type Tokens = { access_token: string; refresh_token: string; expires_at: number };
type ApiError = Error & { code?: string };

let tokens: Tokens | null = (() => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { return null; }
})();

function save(t: Tokens | null) {
  tokens = t;
  try { t ? localStorage.setItem(STORE, JSON.stringify(t)) : localStorage.removeItem(STORE); } catch { /* ignore */ }
}

const TIMEOUT_MS = 20_000;
// A request killed because the page is being left/reloaded is not an error worth reporting.
let leaving = false;
addEventListener("pagehide", () => (leaving = true));
addEventListener("pageshow", () => (leaving = false));
/** fetch with a deadline: a stalled connection becomes a visible error instead of an endless spinner. */
export async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    if (leaving) throw Object.assign(new Error("page unloading"), { code: "unloading" }) as ApiError;
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw Object.assign(new Error("Can't reach the server (timed out). Check your connection and try again."), { code: "timeout" }) as ApiError;
    }
    throw Object.assign(new Error("Can't reach the server. Check your connection and try again."), { code: "network" }) as ApiError;
  }
}

export const fail = async (res: Response): Promise<never> => {
  const body = await res.json().catch(() => ({}));
  throw Object.assign(new Error(body.message ?? body.msg ?? body.error_description ?? res.statusText), {
    code: body.error_code ?? body.code,
  }) as ApiError;
};

export const post = (path: string, body: unknown, bearer = KEY) =>
  request(`${URL}${path}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export function adopt(body: { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number }): boolean {
  if (!body.access_token || !body.refresh_token) return false;
  save({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? Math.floor(Date.now() / 1000) + (body.expires_in ?? 3600),
  });
  return true;
}

let refreshing: Promise<void> | null = null;
export async function accessToken(): Promise<string | null> {
  if (!tokens) return null;
  if (tokens.expires_at - 30 > Date.now() / 1000) return tokens.access_token;
  refreshing ??= (async () => {
    const res = await post("/auth/v1/token?grant_type=refresh_token", { refresh_token: tokens!.refresh_token });
    if (res.ok) adopt(await res.json());
    else if (res.status < 500) save(null); // refresh token revoked/expired
  })().finally(() => (refreshing = null));
  await refreshing;
  return tokens?.access_token ?? null;
}

export const hasSession = () => !!tokens;

/** Signs out (here, not in ./auth-api, so the sign-out route needs nothing more than the first load). */
export async function signOut(): Promise<void> {
  const t = tokens?.access_token;
  save(null);
  if (t) await post("/auth/v1/logout", {}, t).catch(() => {});
}

/** Call a Postgres function; throws on error. One round trip per page. */
/** `league` pins the call to a league (a game in progress), otherwise the app's current league is sent. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>,
  opts: { keepalive?: boolean; league?: number | null } = {}): Promise<T> {
  const token = await accessToken();
  const league = opts.league ?? leagueId();
  const res = await request(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    keepalive: opts.keepalive,
    headers: {
      apikey: KEY, authorization: `Bearer ${token ?? KEY}`, "content-type": "application/json",
      ...(league ? { "x-league": String(league) } : {}),
    },
    body: JSON.stringify(args ?? {}),
  });
  if (!res.ok) return fail(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const config = { URL, KEY };
