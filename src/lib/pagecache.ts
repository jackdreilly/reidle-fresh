// Page data kept on the device, so a page seen before shows instantly (from here) while fresh data loads.
// Keyed by league + URL; dropped on sign-out, after a game (clearPrefetch) and when a new build ships (the entry
// chunk's URL is in the store name, so a page never renders data shaped for an older build).
const NS = "reidle:pages:";
const STORE = NS + new URL(import.meta.url).pathname.split("/").pop();
const MAX = 30, MAX_BYTES = 200_000;

type Entry = { k: string; json: string };
let entries: Entry[] | null = null;
function load(): Entry[] {
  if (entries) return entries;
  entries = [];
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(NS) && k !== STORE) localStorage.removeItem(k); // an older build's pages
    }
    entries = JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch { /* storage unavailable: nothing kept */ }
  return entries!;
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(entries)); } catch { entries = []; try { localStorage.removeItem(STORE); } catch { /* */ } }
}

/** The page's data as last seen on this device (JSON text, to compare with fresh data cheaply), if any. */
export const readPage = (k: string): string | undefined => load().find((e) => e.k === k)?.json;

export function writePage(k: string, data: unknown) {
  const json = JSON.stringify(data);
  const list = load().filter((e) => e.k !== k);
  if (json.length <= MAX_BYTES) list.unshift({ k, json });
  entries = list.slice(0, MAX);
  save();
}

export function clearPages() {
  entries = [];
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}
