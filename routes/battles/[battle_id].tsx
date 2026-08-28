import { SessionData, SessionHandler } from "@/utils/utils.ts";
import ReidleTemplate from "../../components/reidle_template.tsx";
import { PageProps } from "$fresh/server.ts";
import Battle from "../../islands/Battle.tsx";
import { BattleState, runSql } from "@/utils/sql_files.ts";

interface Data {
  battle_id: number;
  supabase_params: [string, string];
  initial_state: BattleState;
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
        initial_state = updated?.state;
        if (typeof initial_state === "string") {
          try {
            initial_state = JSON.parse(initial_state);
          } catch (_) {
            // ignore
          }
        }
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
      />
    </ReidleTemplate>
  );
}
