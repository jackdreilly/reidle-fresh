import { ScoredWord, Scoring } from "@/utils/wordle.ts";

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

export function scoreColor(score: Scoring): string | null {
  switch (score) {
    case Scoring.gray:
      return "#64748b"; // slate-500
    case Scoring.orange:
      return "#ca8a04"; // yellow-600 (accessible contrast)
    case Scoring.green:
      return "#16a34a"; // green-600
    default:
      return null;
  }
}
