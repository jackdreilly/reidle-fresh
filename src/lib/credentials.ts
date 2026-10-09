/** Deterministic per-player login. Shared by the app and tools/sync-auth-users.ts. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toLowerCase().slice(0, 15);
}

export async function credentials(name: string): Promise<{ email: string; password: string }> {
  const bytes = new TextEncoder().encode("reidle:" + name);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { email: `${hex.slice(0, 32)}@players.reidle.app`, password: `reidle-${hex.slice(32)}` };
}
