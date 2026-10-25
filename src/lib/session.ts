import { useEffect, useState } from "preact/hooks";
import { hasSession, rpc } from "./supabase";
import type { Bootstrap } from "./types";
import { dayIn, utcToday } from "./time";
import { setBadge } from "./pwa";
import { leagueId, setLeagueId } from "./league";

const KEY = "reidle:boot";
const anon: Bootstrap = { name: null, played_today: false, unread: false, leagues: [] };

function readCache(): Bootstrap {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (c?.name) {
      const fresh = c.league && c.league.id === leagueId();
      return {
        ...anon, name: c.name, account: c.account, legacy_until: c.legacy_until, nickname_set: c.nickname_set, tour_seen: c.tour_seen,
        reminder_prompt: c.reminder_prompt,
        league: fresh ? c.league : null, leagues: c.leagues ?? [],
        played_today: fresh && c.day === dayIn(c.league.tz, c.league.reset_hour) && c.played_today,
      };
    }
  } catch { /* storage unavailable */ }
  return anon;
}

let state: Bootstrap = readCache();
const listeners = new Set<() => void>();

function set(next: Bootstrap) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  if (next.unread !== state.unread) setBadge(next.unread);
  state = next;
  try {
    if (next.name) localStorage.setItem(KEY, JSON.stringify({ ...next, day: today() }));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const getSession = () => state;
let rev = 0; // bumps on local patches so a slower bootstrap can't clobber fresher state
export const patchSession = (p: Partial<Bootstrap>) => { rev++; set({ ...state, ...p }); };
export const clearSession = () => { setLeagueId(null); set(anon); };

/** The current league's game day (the server's league_day), UTC before we know the league. */
export const today = () => state.league ? dayIn(state.league.tz, state.league.reset_hour) : utcToday();

/** One cheap RPC for the app shell (name, league, played-today, unread dot, open challenges). */
export async function refreshSession(): Promise<Bootstrap> {
  const startedAt = rev;
  const b = await rpc<Bootstrap>("bootstrap");
  setLeagueId(b.league?.id ?? null); // the server's pick (ours may be a league we've left)
  set(rev === startedAt ? b : { ...b, unread: state.unread });
  return state;
}

/** Show another league: the shell refetches, pages load with the new header. */
export async function switchLeague(id: number): Promise<void> {
  if (setLeagueId(id)) set({ ...state, league: null, played_today: false, unread: false, pending_challenges: 0 });
  await refreshSession();
}

/** Name-only sign-in has ended (bootstrap's legacy_until): this account must link a login before playing. */
export const lockedOut = ({ account, legacy_until: t }: Bootstrap) =>
  account === "legacy" && !!t && Date.parse(t) <= Date.now(); // "infinity" (never) parses to NaN

export const hasAuthSession = async () => hasSession();

export function useSession(): Bootstrap {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    l(); // re-sync: state may have changed before this effect subscribed
    return () => void listeners.delete(l);
  }, []);
  return state;
}
