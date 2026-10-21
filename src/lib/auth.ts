import { auth } from "./supabase";
import { credentials, normalizeName } from "./credentials";

export { normalizeName };

/** Name-only login (players from before real logins). Existing names only once sign-ups need an email. */
export async function signIn(rawName: string): Promise<string> {
  const name = normalizeName(rawName);
  if (!name) throw new Error("Enter a name");
  const creds = await credentials(name);
  try {
    await auth.signInWithPassword(creds);
    return name;
  } catch (e) {
    // Only a rejected login means "no account yet"; a network failure/timeout must surface instead.
    if ((e as { code?: string }).code !== "invalid_credentials") throw e;
  }
  try {
    if (!(await auth.signUp(creds, { name }))) throw new Error("New players sign in with Google, an email code, or as a guest.");
  } catch (e) {
    if ((e as { code?: string }).code === "user_already_exists") {
      throw new Error(`${name} is locked to a Google or email login. Use that instead.`);
    }
    throw e;
  }
  return name;
}

export const signOut = () => auth.signOut();

const AFTER = "reidle:after-auth";
const LINKING = "reidle:linking";

/** Off to Google (or another provider). `link` adds it to the current account instead of signing in fresh. */
export async function viaProvider(provider: string, after: string, link = false): Promise<void> {
  try {
    sessionStorage.setItem(AFTER, after);
    link ? sessionStorage.setItem(LINKING, "1") : sessionStorage.removeItem(LINKING);
  } catch { /* ignore */ }
  const back = `${location.origin}/auth/callback`;
  location.assign(link ? await auth.linkUrl(provider, back) : auth.providerUrl(provider, back));
}

/** Where to go once signed in, and whether this was an account link (see finishLink). */
export function afterAuth(): { to: string; linked: boolean } {
  let to = "/", linked = false;
  try {
    to = sessionStorage.getItem(AFTER) ?? "/";
    linked = sessionStorage.getItem(LINKING) === "1";
    sessionStorage.removeItem(AFTER);
    sessionStorage.removeItem(LINKING);
  } catch { /* ignore */ }
  return { to: to.startsWith("/") ? to : "/", linked };
}

/**
 * A name-only player just linked a real login: replace the password derived from their name, so typing
 * the name no longer signs anyone in. (Harmless for guests, who never use a password.)
 */
export async function finishLink(): Promise<void> {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  await auth.updateUser({ password: [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("") }).catch(() => {});
}
