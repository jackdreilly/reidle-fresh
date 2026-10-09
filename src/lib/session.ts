import { useEffect, useState } from "preact/hooks";
import { hasSession, rpc } from "./supabase";
import type { Bootstrap } from "./types";
import { utcToday } from "./time";

const KEY = "reidle:boot";
const anon: Bootstrap = { name: null, played_today: false, unread: false };

function readCache(): Bootstrap {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (c?.name) return { name: c.name, played_today: c.day === utcToday() && c.played_today, unread: false };
  } catch { /* storage unavailable */ }
  return anon;
}

let state: Bootstrap = readCache();
const listeners = new Set<() => void>();

function set(next: Bootstrap) {
  if (next.name === state.name && next.played_today === state.played_today && next.unread === state.unread) return;
  state = next;
  try {
    if (next.name) localStorage.setItem(KEY, JSON.stringify({ ...next, day: utcToday() }));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const getSession = () => state;
let rev = 0; // bumps on local patches so a slower bootstrap can't clobber fresher state
export const patchSession = (p: Partial<Bootstrap>) => { rev++; set({ ...state, ...p }); };
export const clearSession = () => set(anon);

/** One cheap RPC for the app shell (name, played-today, unread dot). */
export async function refreshSession(): Promise<Bootstrap> {
  const startedAt = rev;
  const b = await rpc<Bootstrap>("bootstrap");
  set(rev === startedAt ? b : { ...b, unread: state.unread });
  return state;
}

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
