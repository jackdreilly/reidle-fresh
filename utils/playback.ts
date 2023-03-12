import { ScoredWord, Scoring } from "@/utils/wordle.ts";

export interface PlaybackEvent {
  time: number;
  letter?: string;
  score?: ScoredWord;
  backspace?: boolean;
  clear?: boolean;
  error?: {message: string, penalty: number};
}
export interface Playback {
  events: PlaybackEvent[];
}

export function scoreColor(score: Scoring): string | null {
  switch (score) {
    case Scoring.gray:
      return "#787c7e";
    case Scoring.orange:
      return "#c9b458";
    case Scoring.green:
      return "#6aaa64";
    default:
      return null;
  }
}
