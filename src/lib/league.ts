// The league the app is showing. Every RPC carries it as the `x-league` header (see lg() in the leagues
// migration); the server ignores a league you're not in and falls back to your first one, and bootstrap
// tells us which one it picked.
const KEY = "reidle:league";

let current: number | null = (() => {
  try { return Number(localStorage.getItem(KEY)) || null; } catch { return null; }
})();

export const leagueId = () => current;

/** Returns whether it changed. */
export function setLeagueId(id: number | null): boolean {
  if (id === current) return false;
  current = id;
  try { id ? localStorage.setItem(KEY, String(id)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  return true;
}
