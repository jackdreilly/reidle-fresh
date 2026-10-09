import { supabase } from "./supabase";
import { credentials, normalizeName } from "./credentials";

export { normalizeName };

export async function signIn(rawName: string): Promise<string> {
  const name = normalizeName(rawName);
  if (!name) throw new Error("Enter a name");
  const creds = await credentials(name);
  const attempt = await supabase.auth.signInWithPassword(creds);
  if (!attempt.error) return name;
  const created = await supabase.auth.signUp({ ...creds, options: { data: { name } } });
  if (created.error) throw created.error;
  if (!created.data.session) {
    const retry = await supabase.auth.signInWithPassword(creds);
    if (retry.error) throw retry.error;
  }
  return name;
}

export const signOut = () => supabase.auth.signOut();
