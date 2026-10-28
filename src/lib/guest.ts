// Guest accounts (Supabase anonymous sign-in), shared by the sign-in page and invite links.
import { config } from "./supabase";
import { auth } from "./auth-api";
import { getSession } from "./session";

/** The guest account a guest left on this device when signing out (Account.tsx). */
export type Kept = { rt: string; name: string };
export function savedGuest(): Kept | null {
  try {
    const [rt, name] = JSON.parse(localStorage.getItem("reidle:guest") ?? "null") as [string, string];
    return { rt, name };
  } catch { return null; }
}

/** Back into the kept guest account; false if there is none or it no longer works. */
async function resumeGuest(kept: Kept | null): Promise<boolean> {
  if (!kept) return false;
  try { localStorage.removeItem("reidle:guest"); } catch { /* ignore */ }
  const res = await fetch(`${config.URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: config.KEY, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: kept.rt }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const t = await res.json();
  return !auth.fromRedirect("#" + new URLSearchParams({ access_token: t.access_token, refresh_token: t.refresh_token, expires_in: String(t.expires_in) }));
}

/** The kept guest if it still works, else a brand-new one (which starts in Reidle Global). */
export async function playAsGuest(kept: Kept | null = savedGuest()): Promise<void> {
  if (!await resumeGuest(kept)) await auth.signInAnonymously();
}

/**
 * A guest logging out keeps their guest account on this device: its tokens are set aside (not revoked by
 * /sign-out) for "Continue as …" on the sign-in page. Use as the click handler of a /sign-out link.
 */
export function keepGuest(e: Event, to = "/sign-in") {
  try {
    const t = JSON.parse(localStorage.getItem("reidle:auth") ?? "null");
    if (!t) return;
    e.preventDefault();
    localStorage.setItem("reidle:guest", JSON.stringify([t.refresh_token, getSession().name]));
    localStorage.removeItem("reidle:auth");
    location.assign(to); // a fresh start, signed out
  } catch { /* fall back to a normal sign-out */ }
}
