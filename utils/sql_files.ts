import { PoolClient } from "psql";
import { DailyTableData } from "@/components/daily_table.tsx";
import { ScoringHistory } from "./wordle.ts";

type RowDef = Record<string, unknown>;
type SingleRow = RowDef;
type MultiRow = RowDef[];
type Output = SingleRow | MultiRow;
type Input = Record<string, unknown>;
type MySchema = {
  output?: Output;
  input?: Input;
};
type Leaderboard = {
  name: string;
  total_points: number;
  num_wins: number;
  num_losses: number;
}[];
type NameInput = { name: string };
export type WeekOutput = {
  name: string;
  results: {
    days: {
      day: string;
      time: number;
      score: number;
      submission_id?: number;
    }[];
    totals: {
      time: number;
      score: number;
    };
  };
}[];
type WeekInput = { week: Date };
export type Buckets = { bucket: number; count: number }[];
export type BattleState = {
  game: {
    answer: string;
    starting_word: string;
  };
  history: ScoringHistory;
  message?: string;
  last_player?: string;
};
type BattleArgs = {
  battle_id: number;
};

export type BattleHomePage = {
  active_battles: { battle_id: number; users: string[] }[];
  users: string[];
  updated_at: Date;
};

export interface Schemas {
  battle_home_page: {
    input: undefined;
    output: BattleHomePage;
  };
  reset_battle: {
    input: BattleArgs;
    output: Record<string, unknown>[];
  };
  battle: {
    input: BattleArgs;
    output: { state: BattleState };
  };
  new_battle: {
    input: NameInput;
    output: BattleArgs;
  };
  play: {
    input: undefined;
    output: {
      word: string;
      startingWord: string;
      winner?: string;
      winnersTime?: number;
    };
  };
  message_reads: {
    input: NameInput;
    output: {
      message: string;
      name: string;
      created_at: Date;
      message_id: number;
    }[];
  };
  my_account: {
    input: NameInput;
    output: {
      name: string;
      email?: string;
      notifications_enabled?: boolean;
    };
  };
  challenge_page: {
    input: NameInput & { challenge_id: number };
    output: {
      played: boolean;
      submissions: DailyTableData;
    };
  };
  challenge_play: {
    input: NameInput & { challenge_id: number };
    output: {
      starting_word: string;
      answer: string;
      already_played: boolean;
      leader?: {
        time: number;
        name: string;
      };
    };
  };
  player_stats: {
    input: NameInput;
    output: {
      total: number;
      rank: Buckets;
      time: Buckets;
      penalty: Buckets;
      week: { week: string; time: number; penalty: number; rank: number }[];
    };
  };
  emails_to_send: {
    input: undefined;
    output: { name: string; email: string }[];
  };
  played_today: {
    input: NameInput;
    output: { played: boolean };
  };
  week_json: {
    input: WeekInput;
    output: WeekOutput;
  };
  challenge_next: {
    input: NameInput;
    output: { challenge_id: number };
  };
  pending_challenges_count: {
    input: NameInput;
    output: { pending_challenges: number };
  };
  challenges_json: {
    input: NameInput;
    output: {
      history: {
        challenge_id: number;
        time: number;
        answer: string;
        players: string[];
        winner: { name: string; time: number };
      }[];
      today_leaderboard: Leaderboard;
      yesterday_leaderboard: Leaderboard;
      pending_challenges: number;
    };
  };
  current_winner: {
    output: {
      name: string;
    };
    input: WeekInput;
  };
}
type MyKeys = keyof Schemas;
type IsArray<T extends MySchema> = T extends { output: MultiRow } ? true
  : false;
type HasInput<T extends MySchema> = T extends { input: Input } ? true : false;
type KeySchema<T extends MyKeys> = Schemas[T];
type KeyInput<T extends MyKeys> = KeySchema<T>["input"];
type ArgInput<T extends MyKeys> = HasInput<KeySchema<T>> extends true
  ? { args: KeyInput<T> }
  : { args?: undefined };
type RowInput<T extends MyKeys> = IsArray<KeySchema<T>> extends true
  ? { single_row?: false }
  : { single_row: true };
type QueryInput<T extends MyKeys> =
  & { file: T; connection: PoolClient }
  & ArgInput<T>
  & RowInput<T>;
type QueryOutput<T extends MyKeys> = KeySchema<T>["output"];
type QueryType<T extends MyKeys> = QueryOutput<T> extends Array<infer Item>
  ? Item
  : QueryOutput<T>;

const cache = new Map<MyKeys, string>();
export async function runSql<T extends MyKeys>(
  { file, connection, args, single_row }: QueryInput<T>,
): Promise<QueryOutput<T>> {
  const sql_string = cache.get(file) ?? await (async () => {
    const fileExists = await Deno.stat(`sql/${file}.sql`)
      .then((stats) => stats.isFile)
      .catch(() => false);
    if (fileExists) {
      return await Deno.readTextFile(`sql/${file}.sql`);
    }
    await Deno.run({
      cmd: ["dbt", "compile", "--vars", "{export: true}"],
      cwd: "reidbt",
    }).status();
    await Deno.mkdir("sql", { recursive: true });
    await Deno.copyFile(
      `reidbt/target/compiled/reidbt/models/${file}.sql`,
      `sql/${file}.sql`,
    );
    return await Deno.readTextFile(`sql/${file}.sql`);
  })();
  cache.set(file, sql_string);
  const response = await connection.queryObject<QueryType<T>>(
    sql_string,
    args,
  );
  const rows = response.rows;
  return (single_row ? rows[0] : rows) as QueryOutput<T>;
}
