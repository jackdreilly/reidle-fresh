// Google's own sign-in button (Google Identity Services). Its popup names this site (reidle.reillybrothers.net)
// instead of the Supabase project, and hands back an ID token we trade with Supabase for a session.
// Needs the site's origin under "Authorized JavaScript origins" on the OAuth client in Google Cloud Console;
// without VITE_GOOGLE_CLIENT_ID the app keeps the old redirect through Supabase.

import { accessToken, auth, config } from "./supabase";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Gsi = {
  initialize(o: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; ux_mode: "popup"; itp_support: boolean }): void;
  renderButton(el: HTMLElement, o: Record<string, string | number>): void;
};

let script: Promise<Gsi> | null = null;
function load(): Promise<Gsi> {
  script ??= new Promise<Gsi>((ok, fail) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => ok((window as unknown as { google: { accounts: { id: Gsi } } }).google.accounts.id);
    s.onerror = () => { script = null; s.remove(); fail(new Error("Couldn't reach Google. Check your connection and try again.")); };
    document.head.append(s);
  });
  return script;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Draws Google's button into `el`; `onToken` gets the ID token and the raw nonce Supabase checks it against. */
export async function renderGoogleButton(el: HTMLElement, text: "continue_with" | "signin_with", onToken: (token: string, nonce: string) => void) {
  const gsi = await load();
  // Google puts the hashed nonce in the token; Supabase hashes the raw one and compares
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hashed = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce)));
  gsi.initialize({ client_id: CLIENT_ID!, nonce: hashed, callback: (r) => onToken(r.credential, nonce), ux_mode: "popup", itp_support: true });
  gsi.renderButton(el, { type: "standard", theme: "outline", size: "large", shape: "rectangular", text, logo_alignment: "center", width: Math.min(400, el.clientWidth || 320) });
}

/** Trade Google's ID token for a Supabase session, or (`link`) add Google to the signed-in account. */
export async function signInWithGoogleToken(token: string, nonce: string, link: boolean): Promise<void> {
  const res = await fetch(`${config.URL}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: { apikey: config.KEY, authorization: `Bearer ${(link && await accessToken()) || config.KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", id_token: token, nonce, ...(link && { link_identity: true }) }),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(linkError(t.msg ?? t.message ?? t.error_description ?? res.statusText));
  const err = auth.fromRedirect("#" + new URLSearchParams({ access_token: t.access_token, refresh_token: t.refresh_token, expires_in: String(t.expires_in) }));
  if (err) throw new Error(err);
}

/** Google refused to link: say what to do instead of its raw message (as AuthCallback does). */
const linkError = (err: string) => /already.*linked|identity.*exists/i.test(err)
  ? "That Google account already has its own Reidle login. Sign out, then sign in with Google to use it."
  : err;
