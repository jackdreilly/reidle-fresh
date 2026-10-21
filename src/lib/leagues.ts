import type { Scoring } from "./types";

/** Scoring presets a commissioner picks from (custom = their own points list). */
export const PRESETS: { id: string; label: string; detail: string; scoring: Scoring }[] = [
  { id: "classic", label: "Classic", detail: "40, 20, 10, then 7, 6, 5 … 1", scoring: { mode: "table", points: [40, 20, 10, 7, 6, 5, 4, 3, 2, 1] } },
  { id: "f1", label: "Formula 1", detail: "25, 18, 15, 12, 10, 8, 6, 4, 2, 1", scoring: { mode: "table", points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] } },
  { id: "field", label: "Beat the field", detail: "1 point for playing + 1 for everyone you beat", scoring: { mode: "field" } },
  { id: "winner", label: "Winner takes all", detail: "Only the day's fastest scores (1 point)", scoring: { mode: "table", points: [1] } },
];

export function presetOf(s: Scoring): string {
  if (s.mode === "field") return "field";
  const p = JSON.stringify(s.points ?? []);
  return PRESETS.find((x) => x.scoring.mode === "table" && JSON.stringify(x.scoring.points) === p)?.id ?? "custom";
}

export const describeScoring = (s: Scoring) => {
  const base = s.mode === "field" ? "1 point for playing + 1 for each player you beat"
    : `${(s.points ?? []).join(", ")} points by place`;
  return base + (s.no_show ? ` · ${s.no_show} for a missed day` : "") + (s.best_of ? ` · best ${s.best_of} days count` : "");
};

export const inviteUrl = (code: string) => `${location.origin}/join/${code}`;

/** Share sheet on phones, clipboard elsewhere. Returns what happened, for a status line. */
export async function shareInvite(name: string, code: string): Promise<"shared" | "copied" | "failed"> {
  const url = inviteUrl(code);
  if (navigator.share) {
    try {
      await navigator.share({ title: `Join ${name} on Reidle`, text: `Play the daily Reidle with us in ${name}!`, url });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "failed";
    }
  }
  try { await navigator.clipboard.writeText(url); return "copied"; } catch { return "failed"; }
}

/** Browser timezone, for new leagues. */
export const localTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

/** A short list of zones for the picker, plus whatever the league already uses. */
export function tzChoices(current: string): string[] {
  let all: string[] = [];
  try { all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { /* old browser */ }
  if (!all.length) {
    all = ["UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London",
      "Europe/Paris", "Europe/Athens", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
  }
  return [...new Set([current, localTz(), "UTC", ...all])];
}
