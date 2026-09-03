import { SessionData, SessionHandler } from "@/utils/utils.ts";
import ReidleTemplate from "../../components/reidle_template.tsx";
import { PageProps } from "$fresh/server.ts";
import Battle from "../../islands/Battle.tsx";
import { BattleState, runSql } from "@/utils/sql_files.ts";

interface Data {
  battle_id: number;
  supabase_params: [string, string];
  initial_state: BattleState;
  url: string;
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    try {
      const { params: { battle_id: bidString }, state: { connection, render } } =
        ctx;
      const battle_id = parseInt(bidString);
      if (isNaN(battle_id)) {
        return new Response("Invalid battle ID", { status: 404 });
      }

      let battleRow = await runSql({
        file: "battle",
        single_row: true,
        connection,
        args: { battle_id },
      });

      if (!battleRow && battle_id === 7) {
        await runSql({
          file: "reset_battle",
          args: { battle_id: 7 },
          connection,
        });
        battleRow = await runSql({
          file: "battle",
          single_row: true,
          connection,
          args: { battle_id: 7 },
        });
      }

      if (!battleRow) {
        return new Response("Battle not found", { status: 404 });
      }

      let initial_state = battleRow.state;
      if (typeof initial_state === "string") {
        try {
          initial_state = JSON.parse(initial_state);
        } catch (_) {
          // ignore
        }
      }
      if (!initial_state?.game?.answer) {
        await runSql({
          file: "reset_battle",
          args: { battle_id },
          connection,
        });
        const updated = await runSql({
          file: "battle",
          single_row: true,
          connection,
          args: { battle_id },
        });
        battleRow = updated ?? battleRow;
        initial_state = updated?.state;
        if (typeof initial_state === "string") {
          try {
            initial_state = JSON.parse(initial_state);
          } catch (_) {
            // ignore
          }
        }
      }

      const lastActive = battleRow.updated_at ? new Date(battleRow.updated_at).getTime() : 0;
      const isStale = (Date.now() - lastActive) > 35000;
      const usersList = Array.isArray(battleRow.users) ? battleRow.users : [];
      const hasActivePlayers = !isStale && usersList.length > 0;

      if (initial_state) {
        if (!hasActivePlayers) {
          initial_state.leaderboard = {};
          initial_state.battle_history = [];
        } else {
          if (!initial_state.leaderboard) initial_state.leaderboard = {};
          if (!initial_state.battle_history) initial_state.battle_history = [];
        }
        if (!initial_state.round) initial_state.round = 1;
        if (!initial_state.round_id) initial_state.round_id = `${battle_id}-${initial_state.round}`;
        if (initial_state.version === undefined) initial_state.version = initial_state.history?.length ?? 0;
      }

      const host =
        Deno.env.get("SUPABASE_HOST") ??
        Deno.env.get("SUPABASE_URL") ??
        Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ??
        Deno.env.get("VITE_SUPABASE_URL") ??
        "";
      const key =
        Deno.env.get("SUPABASE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY") ??
        Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
        "";

      return await render(ctx, {
        battle_id,
        supabase_params: [host, key],
        initial_state,
        url: req.url,
      });
    } catch (err) {
      console.error("Error handling battle route:", err);
      return new Response(
        `Error in /battles: ${(err as Error)?.message}\n${(err as Error)?.stack}`,
        {
          status: 500,
          headers: { "content-type": "text/plain" },
        },
      );
    }
  },
};

export default function Page(
  {
    data: {
      battle_id,
      name,
      supabase_params,
      initial_state,
      playedToday,
      url,
    },
  }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      route="/battles"
      title="Battle"
      fullPage={true}
      playedToday={playedToday}
    >
      <Battle
        name={name}
        initial_state={initial_state}
        battle_id={battle_id}
        supabase_params={supabase_params}
        url={url}
      />
    </ReidleTemplate>
  );
}
