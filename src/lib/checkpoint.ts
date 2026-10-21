// Daily game progress. The server checkpoint is what a resume (any device) starts from, so every
// guess must reach it: saves go out one at a time (latest state wins), failed ones are retried, a
// pending one is flushed with keepalive when the app is hidden, and a copy is kept in localStorage
// so a resume on this device never loses a guess whose save never left. The server never lets a
// save shrink the history (see save_checkpoint).
import { rpc } from "@/lib/supabase";
import type { Checkpoint } from "@/lib/types";
import type { ScoringHistory } from "@/lib/wordle";

type Progress = { penalty: number; history: ScoringHistory; league?: number | null };
type Local = Progress & { word: string; startingWord: string; at: number };

const STORE = "reidle:checkpoint";
const read = (): Local | null => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { return null; }
};

/** The furthest of the server checkpoint and this device's copy of the same game. */
export function resumeFrom(cp: Checkpoint | undefined, word: string, startingWord: string): Checkpoint | undefined {
  const local = read();
  if (!cp || !local || local.word !== word || local.startingWord !== startingWord) return cp;
  if (Date.now() - local.at > 36 * 3600_000) return cp; // same pair of words on another day: ignore
  return {
    ...cp,
    history: local.history.length > (cp.history?.length ?? 0) ? local.history : cp.history,
    penalty: Math.max(cp.penalty ?? 0, local.penalty ?? 0),
  };
}

let pending: Progress | null = null;
let inFlight = false;
let retry: ReturnType<typeof setTimeout> | undefined;
let delay = 1000;

export function saveProgress(word: string, startingWord: string, p: Progress) {
  try { localStorage.setItem(STORE, JSON.stringify({ ...p, word, startingWord, at: Date.now() })); } catch { /* ignore */ }
  pending = p;
  void pump();
}

/** The game was submitted: nothing left to resume. */
export function clearProgress() {
  pending = null;
  clearTimeout(retry);
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}

async function pump(keepalive = false) {
  if (inFlight || !pending) return;
  clearTimeout(retry);
  const p = pending;
  pending = null;
  inFlight = true;
  let ok = true;
  try {
    await rpc("save_checkpoint", { p_penalty: p.penalty, p_history: p.history }, { keepalive, league: p.league });
    delay = 1000;
  } catch {
    ok = false;
    pending ??= p; // keep a newer state if one arrived meanwhile
    retry = setTimeout(() => void pump(), delay);
    delay = Math.min(delay * 2, 30_000);
  } finally {
    inFlight = false;
  }
  if (ok) void pump(); // a newer state arrived while this one was in flight
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void pump(true);
  });
  addEventListener("online", () => void pump());
}
