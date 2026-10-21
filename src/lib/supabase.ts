// Lean Supabase client: just what Reidle needs (RPC over fetch + password auth with refresh).
// Realtime lives in ./realtime and is only loaded by the battle page.
import { leagueId } from "./league";
const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string;
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
async function request(url: string, init: RequestInit): Promise<Response> {
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

const fail = async (res: Response): Promise<never> => {
  const body = await res.json().catch(() => ({}));
  throw Object.assign(new Error(body.message ?? body.msg ?? body.error_description ?? res.statusText), {
    code: body.error_code ?? body.code,
  }) as ApiError;
};

const post = (path: string, body: unknown, bearer = KEY) =>
  request(`${URL}${path}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function adopt(body: { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number }): boolean {
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

export const auth = {
  async signInWithPassword(creds: { email: string; password: string }): Promise<void> {
    const res = await post("/auth/v1/token?grant_type=password", creds);
    if (!res.ok) return fail(res);
    adopt(await res.json());
  },
  /** Returns whether a session was established (false if email confirmation were required). */
  async signUp(creds: { email: string; password: string }, data: Record<string, unknown>): Promise<boolean> {
    const res = await post("/auth/v1/signup", { ...creds, data });
    if (!res.ok) return fail(res);
    return adopt(await res.json());
  },
  /** Guest: an anonymous account (Reidle Global), upgradable later by linking Google or an email. */
  async signInAnonymously(): Promise<void> {
    const res = await post("/auth/v1/signup", { data: {} });
    if (!res.ok) return fail(res);
    adopt(await res.json());
  },
  /** Where to send the browser to sign in with a provider; it comes back to `redirectTo` with tokens in the hash. */
  providerUrl: (provider: string, redirectTo: string) =>
    `${URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`,
  /** Same, but adds the provider to the signed-in account (guest or name-only) instead of a new one. */
  async linkUrl(provider: string, redirectTo: string): Promise<string> {
    const res = await request(`${URL}/auth/v1/user/identities/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}&skip_http_redirect=true`, {
      headers: { apikey: KEY, authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok) return fail(res);
    return (await res.json()).url;
  },
  /** Back from a provider: adopt the tokens in the URL hash. Returns the provider's error, if any. */
  fromRedirect(hash: string): string | null {
    const p = new URLSearchParams(hash.replace(/^#/, ""));
    if (p.get("error")) return p.get("error_description") ?? p.get("error");
    return adopt({
      access_token: p.get("access_token") ?? undefined, refresh_token: p.get("refresh_token") ?? undefined,
      expires_in: Number(p.get("expires_in")) || undefined, expires_at: Number(p.get("expires_at")) || undefined,
    }) ? null : "Sign-in didn't complete. Try again.";
  },
  /** Emails a 6-digit code (new players are created on first use). */
  async sendEmailCode(email: string): Promise<void> {
    const res = await post("/auth/v1/otp", { email, create_user: true });
    if (!res.ok) return fail(res);
  },
  /** `email` signs in with the code; `email_change` confirms an email added to this account. */
  async verifyEmailCode(email: string, token: string, type: "email" | "email_change"): Promise<void> {
    const t = await accessToken();
    const res = await post("/auth/v1/verify", { email, token, type }, type === "email_change" && t ? t : KEY);
    if (!res.ok) return fail(res);
    adopt(await res.json());
  },
  /** Change the signed-in account: { email } sends a code to it, { password } replaces the password. */
  async updateUser(attrs: { email?: string; password?: string }): Promise<void> {
    const res = await request(`${URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: KEY, authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify(attrs),
    });
    if (!res.ok) return fail(res);
  },
  async signOut(): Promise<void> {
    const t = tokens?.access_token;
    save(null);
    if (t) await post("/auth/v1/logout", {}, t).catch(() => {});
  },
};

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

/** Direct row update (only `battles` is writable by clients; RLS enforces it). */
export async function patchRow(table: string, match: Record<string, string | number>, patch: unknown): Promise<void> {
  const token = await accessToken();
  const qs = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  const res = await request(`${URL}/rest/v1/${table}?${qs}`, {
    method: "PATCH",
    headers: { apikey: KEY, authorization: `Bearer ${token ?? KEY}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await fail(res);
}

export const config = { URL, KEY };
