import type { ScoringHistory } from "./wordle";

export type Checkpoint = { penalty: number; history: ScoringHistory; created_at: string | Date };

export type DailySubmission = {
  name: string;
  time: number;
  penalty: number;
  paste: string;
  submission_id: number;
};

export type Buckets = { bucket: number; count: number }[];

export type WeekOutput = {
  name: string;
  results: {
    days: { day: string; time: number; score: number; submission_id?: number | null }[];
    totals: { time: number; score: number };
  };
}[];

export type Leaderboard = { name: string; total_points: number; num_wins: number; num_losses: number }[];

export type BattleRoundHistory = {
  round: number;
  word: string;
  winner: string;
  guesses: number;
  completed_at: string;
};

export type BattleState = {
  game: { answer: string; starting_word: string };
  history: ScoringHistory;
  message?: string;
  last_player?: string;
  round?: number;
  round_id?: string;
  version?: number;
  leaderboard?: Record<string, number>;
  battle_history?: BattleRoundHistory[];
};

export type Scoring = { mode: "table" | "field"; points?: number[]; no_show?: number; best_of?: number | null };

export type LeagueBrief = {
  id: number; name: string; is_public: boolean; tz: string; reset_hour: number;
  today: string; reset_at: string; scoring: Scoring; role: "commissioner" | "member" | null;
};

export type Account = "guest" | "legacy" | "verified";

export type Bootstrap = {
  name: string | null; played_today: boolean; unread: boolean; pending_challenges?: number;
  account?: Account; nickname_set?: boolean;
  /** name-only accounts: when name-only sign-in ends (then they must link a login to play) */
  legacy_until?: string | null;
  /** false until the player dismisses the new-player tour (stored per player, so it follows them) */
  tour_seen?: boolean;
  league?: LeagueBrief | null; leagues: { id: number; name: string }[];
};
