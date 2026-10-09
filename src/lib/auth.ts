import { auth } from "./supabase";
import { credentials, normalizeName } from "./credentials";

export { normalizeName };

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
  if (!(await auth.signUp(creds, { name }))) await auth.signInWithPassword(creds);
  return name;
}

export const signOut = () => auth.signOut();
