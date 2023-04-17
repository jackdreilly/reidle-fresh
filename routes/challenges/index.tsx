import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { Table, TableCell, TableRow } from "@/components/tables.tsx";
import TimerText from "@/components/timer_text.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import IconEye from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/eye.tsx";
import IconPlayerPlay from "https://deno.land/x/tabler_icons_tsx@0.0.3/tsx/player-play.tsx";

interface Data {
  history: {
    challenge_id: number;
    time: number;
    word: string;
    players: string[];
    winner: { name: string; time: number };
  }[];
  total_points: {
    name: string;
    total_points: number;
    num_wins: number;
    num_losses: number;
  }[];
}
export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    return ctx.state.render(
      ctx,
      await ctx.state.connection.queryObject<Data>`
      with
      valid_challenges as (
          select
              challenge_id,
              count(*) as num_players
          from submissions
          inner join challenges USING (challenge_id)
      where is_this_week(challenges.created_at)
      group by 1
      having count(*) > 1
      ),
      total_played as (
      select
          name,
          count(*) as total_played
      from valid_challenges
      natural inner join submissions
      group by 1
      ),
      winners as (
      select distinct on (challenge_id)
          challenge_id,
          name
      from valid_challenges
      natural inner join submissions
      order by challenge_id, time
      ),
      winner_points as (
      select
          name,
          sum(num_players) as winner_points,
          count(*) as num_wins
      from winners
      natural inner join valid_challenges
      group by 1
      ),
      total_points as (
      select
          name,
          coalesce(num_wins, 0) as num_wins,
          coalesce(total_played,0) - coalesce(num_wins, 0) as num_losses,
          coalesce(winner_points, 0) - coalesce(total_played, 0) as total_points
      from winner_points
      natural full outer join total_played
      order by total_points desc
      ),
      total_points_json as (
        select json_agg(json_build_object('name', name, 'total_points', total_points, 'num_wins', num_wins, 'num_losses', num_losses)) as total_points from total_points
      ),
      history as (
        select challenge_id, time, word from submissions inner join challenges using (challenge_id) where name = ${ctx.state.name} and challenge_id is not null and is_this_week(challenges.created_at)
      ),
      history_winners as (
        select distinct on (challenge_id) challenge_id, submissions.name as winner, submissions.time as winning_time from submissions inner join history using (challenge_id) order by challenge_id, submissions.time
      ),
      history_players as (
        select challenge_id, json_agg(name) as players from submissions inner join history using (challenge_id) INNER JOIN history_winners using (challenge_id) WHERE name != ${ctx.state.name} and name != winner group by challenge_id
      ),
      history_json as (select json_agg(json_build_object('players', COALESCE(players, '[]'), 'challenge_id', challenge_id, 'time', time, 'word', word, 'winner', json_build_object('name', winner, 'time', winning_time)) order by challenge_id desc) as history from history natural inner join history_winners natural LEFT join history_players)
      select 
        coalesce(total_points, '[]') as total_points,
        coalesce(history, '[]') as history
      from history_json full outer join total_points_json on true
    `.then((x) => x.rows[0]),
    );
  },
};
export default function Page(
  { data: { playedToday, total_points, history, name: myName } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/challenges"
      title="Challenges"
    >
      <div class="flex">
        <a
          href="/challenges/play"
          class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-700 flex gap-2"
        >
          <IconPlayerPlay class="w-6 h-6" />Start Challenges Now!
        </a>
      </div>
      <h1 class="my-4">This Week</h1>
      <Table
        columns={["Name", "Score", "W", "L"]}
      >
        {total_points.map((
          { name, total_points, num_losses, num_wins },
        ) => (
          <TableRow class={name === myName ? "bg-yellow-100" : ""}>
            {[name, total_points, num_wins, num_losses].map((x) => (
              <TableCell>{x}</TableCell>
            ))}
          </TableRow>
        ))}
      </Table>
      <h1 class="my-4">Your Challenges</h1>
      <Table
        columns={["See", "Word", "Time", "Winner", "Others"]}
      >
        {history.map((
          {
            challenge_id,
            time,
            word,
            winner: { name, time: winning_time },
            players,
          },
        ) => (
          <TableRow class={name === myName ? "bg-green-100" : ""}>
            {[
              <a
                href={`/challenges/challenge/${challenge_id}`}
                type="button"
                class="px-3 py-2 bg-white rounded border(gray-400 1)
            hover:bg-gray-200 flex gap-2"
              >
                <IconEye class="w-6 h-6" />
              </a>,
              <div>{word}</div>,
              <TimerText seconds={time} />,
              <div>
                <span>{name}</span>
                <span>
                  <TimerText seconds={winning_time} />
                </span>
              </div>,
              <div>{players.join(", ")}</div>,
            ].map((x) => <TableCell>{x}</TableCell>)}
          </TableRow>
        ))}
      </Table>
    </ReidleTemplate>
  );
}
