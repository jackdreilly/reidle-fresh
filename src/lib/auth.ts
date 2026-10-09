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
  } catch { /* first visit: no account yet */ }
  if (!(await auth.signUp(creds, { name }))) await auth.signInWithPassword(creds);
  return name;
}

export const signOut = () => auth.signOut();
