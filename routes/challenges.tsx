import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/mod.ts";
import TimerText from "../components/timer_text.tsx";
export interface Challenge {
  challenger: string;
  id: number;
  created_at: string;
  best_time?: number;
  best_name?: string;
  have_played: boolean;
  challengers: string;
}
interface Data {
  challenges: Challenge[];
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { state: { name, connection, render } } = ctx;
    return render(ctx, {
      challenges: await connection.queryObject<Challenge>`
      WITH
      challenger_ids AS (
        SELECT
          id as challenge_id
        FROM
          challenges
        where
          challenger = ${name}
      ),
      requested_ids AS (
        SELECT
          challenge_id
        FROM
          challenge_requests
        WHERE
          name = ${name}
        OR
          email IN (
            SELECT
              email
            FROM
              players
            WHERE
              name = ${name}
          )
      ),
      eligible_challenge_ids AS (
        SELECT distinct
          challenge_id
        from
          challenger_ids
        UNION
        select distinct
          challenge_id
        from
          requested_ids
      ),
      eligible_challenges AS (
        select
          id AS challenge_id,
          challenger,
          created_at
        from
          challenges
        WHERE
          id IN (
            select
              challenge_id
            from
              eligible_challenge_ids
          )
      ),
      submissions AS (
        select
          challenge_id,
          name,
          time
        FROM
          eligible_challenge_ids
        NATURAL INNER JOIN challenge_submissions
      ),
      best_result AS (
        select distinct ON (challenge_id)
          challenge_id,
          time as best_time,
          name as best_name
        from
          submissions
        ORDER BY
          challenge_id,
          time
      ),
      played AS (
        SELECT
          challenge_id,
          bool_or(name = ${name}) as have_played
        from
          submissions
        group by
          1
      ),
      challengers as (
        select
          challenge_id,
          string_agg(name, ', ' order by name) as challengers
        FROM
          challenge_requests
        NATURAL INNER JOIN
          eligible_challenge_ids
        group by 1
      )
      SELECT
        challenger,
        challenge_id as id,
        created_at,
        best_time,
        best_name,
        have_played,
        challengers
      FROM
        eligible_challenges
      natural FULL OUTER join
        best_result
      natural full outer join
        played
      natural FULL OUTER join
        challengers
      ORDER BY
        have_played,
        challenge_id desc
    `.then((r) => r.rows),
    });
  },
};

export default function Page(
  { data: { challenges, name: myName, playedToday } }: PageProps<
    Data & SessionData
  >,
) {
  const [have_not_played, played] = challenges
    .reduce(
      (acc, challenge) => {
        const { have_played } = challenge;
        acc[have_played ? 1 : 0].push(challenge);
        return acc;
      },
      [[], []] as [Challenge[], Challenge[]],
    );
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/challenges"
      title="Challenges"
    >
      <a
        href="/challenges/new"
        class="inline-block text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300  font-medium rounded-lg text-sm px-5 py-2.5 text-center m-2"
      >
        New Challenge
      </a>
      {[{ tag: "Active ", challenges: have_not_played }, {
        tag: "Past ",
        challenges: played,
      }].map(({ tag, challenges }, i) => (
        <div>
          <h2 class="text-xl font-bold">{tag}Challenges</h2>
          {challenges.length === 0
            ? (
              <div class="italic">
                No {" " + tag.toLowerCase()}challenges, start a new one!
              </div>
            )
            : (
              <ul class="max-w-md divide-y divide-gray-200 rounded shadow border m-4">
                {challenges.map((
                  {
                    challenger,
                    created_at,
                    id,
                    best_name,
                    best_time,
                    challengers,
                  },
                ) => (
                  <li
                    class={[
                      "divide-y divide-gray-700 hover:bg-gray-200",
                      best_name === myName ? "bg-green-200" : "",
                    ].join(" ")}
                  >
                    <a href={`/challenges/challenge/${id}`}>
                      <div class="flex divide-x divide-gray-400 items-center p-2">
                        <div class="p-2 w-8">{id}</div>
                        <div class="p-2 flex-1">
                          {best_time
                            ? (
                              <>
                                Leader:<span class="p-2 font-bold">
                                  {best_name}
                                </span>
                                <span class={"p-2"}>
                                  <TimerText seconds={best_time} />
                                </span>
                              </>
                            )
                            : null}
                          <div class="italic">
                            <span class={"font-bold"}>{challenger}</span>,
                            {" "}
                            <span>{challengers}</span>
                          </div>
                        </div>
                        <div class="italic w-32 p-2">
                          {moment(created_at).fromNow()}
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
        </div>
      ))}
    </ReidleTemplate>
  );
}
