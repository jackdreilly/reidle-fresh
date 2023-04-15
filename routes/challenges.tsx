import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "../components/tables.tsx";
import TimerText from "../components/timer_text.tsx";
interface Data {
  played: Challenge[];
  unplayed: Challenge[];
  winner_records: { name: string; count: number }[];
}

interface Challenge {
  challenge_id: number;
  leader?: {
    name: string;
    time: number;
  };
  participants: string[];
  created_at: string;
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { state: { name, connection, render } } = ctx;
    return render(
      ctx,
      await connection.queryObject<Data>`
      with
      winners as (
        select distinct on (challenge_id)
          challenge_id,
          name
        from
          submissions
        inner join challenges using (challenge_id)
        where date_trunc('week', challenges.created_at) = date_trunc('week', now())
        order by challenge_id, time
      ),
      winner_counts as (
        select winners.name, count(*) - count(distinct challenge_id) as count from winners inner join submissions using (challenge_id) group by 1
        HAVING count(*) - count(distinct challenge_id) > 0
      ),
      winner_records as (
        select coalesce(json_agg(json_build_object('name', name, 'count', count) order by count desc), json_build_array()) as winner_records from winner_counts
      ),
      challenges as (
        select
        challenge_id,
        challenges.created_at,
          json_agg(name) participants,
          bool_or(name = ${name}) played,
          (select json_build_object('name', name, 'time', time) from submissions where challenge_id = "outer".challenge_id order by time limit 1) as leader
        from
          submissions "outer"
        inner join challenges using (challenge_id)
        where date_trunc('week', challenges.created_at) = date_trunc('week', now())
        group by 1, 2
      ),
      challenge_records as (
        select played, json_agg(json_build_object('challenge_id', challenge_id, 'leader', leader, 'participants',coalesce(participants, json_build_array()), 'played', played, 'created_at', created_at) order by created_at desc) as challenge from challenges group by 1 order by 1
      )
      select
        coalesce(
        (select challenge played from challenge_records where played),
        '[]') played,
        coalesce((select challenge played from challenge_records where not played),
        '[]') unplayed,
        (select winner_records from winner_records) winner_records
      `.then((x) => {
        return x.rows[0];
      }),
    );
  },
  async POST(req, ctx) {
    const challenge_id = await ctx.state.connection.queryObject<
      { challenge_id: number }
    >`
      INSERT INTO challenges (challenger, answer, starting_word)
        SELECT
          ${ctx.state.name},
          (SELECT c1 FROM answers ORDER BY random() LIMIT 1),
          (SELECT c1 FROM words ORDER BY random() LIMIT 1)
        RETURNING challenge_id`.then((x) => x.rows[0].challenge_id);
    return new Response("ok", {
      status: 303,
      headers: { location: `/challenges/challenge/${challenge_id}/play` },
    });
  },
};

export default function Page(
  { data: { played, unplayed, winner_records, name, playedToday } }: PageProps<
    Data & SessionData
  >,
) {
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/challenges"
      title="Challenges"
    >
      <form method="POST">
        <input
          type="submit"
          class="inline-block text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300  font-medium rounded-lg text-sm px-5 py-2.5 text-center m-2"
          value="New Challenge"
        />
      </form>
      {winner_records.length
        ? (
          <div>
            <h1 class="text-xl m-4">Week Leaderboard</h1>
            <Table
              columns={["Rank", "Name", "Points"]}
              rows={winner_records.map((
                { name, count },
                i,
              ) => [i + 1, name, count])}
            />
          </div>
        )
        : null}
      {unplayed.length
        ? (
          <div>
            <h1 class="text-xl m-4">To Play</h1>
            <Table>
              <TableHead columns={["Play", "Leader", "Players"]} />
              <TableBody>
                {unplayed.map((
                  { challenge_id, leader, participants, created_at },
                ) => (
                  <TableRow>
                    <TableCell>
                      <a href={`/challenges/challenge/${challenge_id}/play`}>
                        <svg
                          height="30"
                          width="30"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                          aria-hidden="true"
                        >
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </a>
                    </TableCell>
                    <TableCell>
                      {leader
                        ? (
                          <div class="flex">
                            <a href={`/players/${leader.name}`}>
                              {leader.name}
                            </a>
                            <div class="mx-1">
                              (<TimerText seconds={leader.time} />)
                            </div>
                          </div>
                        )
                        : null}
                    </TableCell>
                    <TableCell>
                      <ul class="flex">
                        {(participants ?? []).map((participant) => (
                          <li class="mx-1">
                            <a href={`/players/${participant}`}>
                              {participant}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
        : null}
      {played.length
        ? (
          <div>
            <h1 class="text-xl m-4">Played</h1>
            <Table>
              <TableHead columns={["See", "Leader", "Players"]} />
              <TableBody>
                {played.map((
                  { challenge_id, leader, participants, created_at },
                ) => (
                  <TableRow
                    class={leader?.name === name ? "bg-green-100" : ""}
                  >
                    <TableCell>
                      <a href={`/challenges/challenge/${challenge_id}`}>
                        <svg
                          fill="#000000"
                          version="1.1"
                          id="Capa_1"
                          xmlns="http://www.w3.org/2000/svg"
                          width="30"
                          height="30"
                          viewBox="0 0 442.04 442.04"
                        >
                          <g>
                            <g>
                              <path d="M221.02,341.304c-49.708,0-103.206-19.44-154.71-56.22C27.808,257.59,4.044,230.351,3.051,229.203
			c-4.068-4.697-4.068-11.669,0-16.367c0.993-1.146,24.756-28.387,63.259-55.881c51.505-36.777,105.003-56.219,154.71-56.219
			c49.708,0,103.207,19.441,154.71,56.219c38.502,27.494,62.266,54.734,63.259,55.881c4.068,4.697,4.068,11.669,0,16.367
			c-0.993,1.146-24.756,28.387-63.259,55.881C324.227,321.863,270.729,341.304,221.02,341.304z M29.638,221.021
			c9.61,9.799,27.747,27.03,51.694,44.071c32.83,23.361,83.714,51.212,139.688,51.212s106.859-27.851,139.688-51.212
			c23.944-17.038,42.082-34.271,51.694-44.071c-9.609-9.799-27.747-27.03-51.694-44.071
			c-32.829-23.362-83.714-51.212-139.688-51.212s-106.858,27.85-139.688,51.212C57.388,193.988,39.25,211.219,29.638,221.021z" />
                            </g>
                            <g>
                              <path d="M221.02,298.521c-42.734,0-77.5-34.767-77.5-77.5c0-42.733,34.766-77.5,77.5-77.5c18.794,0,36.924,6.814,51.048,19.188
			c5.193,4.549,5.715,12.446,1.166,17.639c-4.549,5.193-12.447,5.714-17.639,1.166c-9.564-8.379-21.844-12.993-34.576-12.993
			c-28.949,0-52.5,23.552-52.5,52.5s23.551,52.5,52.5,52.5c28.95,0,52.5-23.552,52.5-52.5c0-6.903,5.597-12.5,12.5-12.5
			s12.5,5.597,12.5,12.5C298.521,263.754,263.754,298.521,221.02,298.521z" />
                            </g>
                            <g>
                              <path d="M221.02,246.021c-13.785,0-25-11.215-25-25s11.215-25,25-25c13.786,0,25,11.215,25,25S234.806,246.021,221.02,246.021z" />
                            </g>
                          </g>
                        </svg>
                      </a>
                    </TableCell>
                    <TableCell>
                      {leader
                        ? (
                          <div class="flex">
                            <a class="mx-1" href={`/players/${leader.name}`}>
                              {leader.name}
                            </a>
                            <div>
                              (<TimerText seconds={leader.time} />)
                            </div>
                          </div>
                        )
                        : null}
                    </TableCell>
                    <TableCell>
                      <ul class="flex">
                        {(participants ?? []).map((participant) => (
                          <li class="mx-1">
                            <a href={`/players/${participant}`}>
                              {participant}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
        : null}
    </ReidleTemplate>
  );
}
