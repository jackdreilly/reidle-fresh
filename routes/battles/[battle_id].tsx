import { SessionData, SessionHandler } from "@/utils/utils.ts";
import ReidleTemplate from "../../components/reidle_template.tsx";
import { PageProps } from "https://deno.land/x/fresh@1.1.5/server.ts";
import Battle from "../../islands/Battle.tsx";
import { BattleState, runSql } from "@/utils/sql_files.ts";
interface Data {
  battle_id: number;
  supabase_params: [string, string];
  initial_state: BattleState;
}
export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { params: { battle_id: bidString }, state: { connection, render } } =
      ctx;
    const battle_id = parseInt(bidString);
    const { state: initial_state } = await runSql({
      file: "battle",
      single_row: true,
      connection,
      args: { battle_id },
    });
    return render(ctx, {
      battle_id,
      supabase_params: [
        Deno.env.get("SUPABASE_HOST")!,
        Deno.env.get("SUPABASE_KEY")!,
      ],
      initial_state,
    });
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
