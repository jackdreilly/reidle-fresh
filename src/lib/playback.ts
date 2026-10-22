import { ScoredWord, Scoring } from "@/lib/wordle";

export interface PlaybackEvent {
  time: number;
  letter?: string;
  score?: ScoredWord;
  backspace?: boolean;
  clear?: boolean;
  error?: { message: string; penalty: number };
}
export interface Playback {
  events: PlaybackEvent[];
}

/** Tile/key colour for a score; the dark theme (src/dark.css) swaps them via --absent/--present/--correct. */
export function scoreColor(score: Scoring): string | null {
  switch (score) {
    case Scoring.gray:
      return "var(--absent, #787c7e)";
    case Scoring.orange:
      return "var(--present, #c9b458)";
    case Scoring.green:
      return "var(--correct, #6aaa64)";
    default:
      return null;
  }
}
