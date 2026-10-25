// GoTrue (Supabase Auth) calls for signing in and changing a login, kept out of the first load:
// only the sign-in, callback and account pages import this.
import { accessToken, adopt, config, fail, post, request, signOut } from "./supabase";

const { URL, KEY } = config;

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
  /** Emails a sign-in link (and a 6-digit code once templates carry one); new players are created on first use. */
  async sendEmailCode(email: string, redirectTo: string): Promise<void> {
    const res = await post(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, { email, create_user: true });
    if (!res.ok) return fail(res);
  },
  /** `email` signs in with the code; `email_change` confirms an email added to this account. */
  async verifyEmailCode(email: string, token: string, type: "email" | "email_change"): Promise<void> {
    const t = await accessToken();
    const res = await post("/auth/v1/verify", { email, token, type }, type === "email_change" && t ? t : KEY);
    if (!res.ok) return fail(res);
    adopt(await res.json());
  },
  /** Change the signed-in account: { email } sends a confirmation to it, { password } replaces the password. */
  async updateUser(attrs: { email?: string; password?: string }, redirectTo?: string): Promise<void> {
    const res = await request(`${URL}/auth/v1/user${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`, {
      method: "PUT",
      headers: { apikey: KEY, authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
      body: JSON.stringify(attrs),
    });
    if (!res.ok) return fail(res);
  },
  signOut,
};
