import { BattleState, runSql } from "@/utils/sql_files.ts";
import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async POST(req, ctx) {
    const { params: { battle_id: bidString }, state: { connection } } = ctx;
    const battle_id = parseInt(bidString);
    if (isNaN(battle_id)) {
      return new Response("Invalid battle ID", { status: 400 });
    }

    const row = await runSql({
      file: "battle",
      args: { battle_id },
      single_row: true,
      connection,
    });

    let currentState = row?.state as BattleState | undefined;
    if (typeof currentState === "string") {
      try {
        currentState = JSON.parse(currentState);
      } catch (_) {
        currentState = undefined;
      }
    }

    const lastActive = row?.updated_at ? new Date(row.updated_at).getTime() : 0;
    const isStale = (Date.now() - lastActive) > 35000;
    const usersList = Array.isArray(row?.users) ? row.users : [];
    const hasActivePlayers = !isStale && usersList.length > 0;

    const wordRes = await connection.queryObject<{ word: string }>(
      `select word from "postgres"."public"."words" order by random() limit 1`,
    );
    const answerRes = await connection.queryObject<{ answer: string }>(
      `select answer from "postgres"."public"."answers" order by random() limit 1`,
    );
    const starting_word = wordRes.rows[0]?.word ?? "crane";
    const answer = answerRes.rows[0]?.answer ?? "slate";

    const nextRound = ((currentState?.round as number) || 1) + 1;
    const round_id = crypto.randomUUID();

    const newState: BattleState = {
      round: nextRound,
      round_id,
      version: 0,
      history: [],
      game: {
        starting_word,
        answer,
      },
      leaderboard: hasActivePlayers ? (currentState?.leaderboard ?? {}) : {},
      battle_history: hasActivePlayers ? (currentState?.battle_history ?? []) : [],
    };

    await connection.queryObject(
      `update "postgres"."public"."battles" set state = $1, updated_at = NOW() where battle_id = $2`,
      [JSON.stringify(newState), battle_id],
    );

    return new Response(JSON.stringify(newState), {
      headers: { "content-type": "application/json" },
    });
  },
};
