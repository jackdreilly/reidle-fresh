import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/mod.ts";
export interface Challenge {
  challenger: string;
  id: number;
  created_at: string;
}
interface Data {
  challenges: Challenge[];
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const { state: { name, connection, render } } = ctx;
    return render(ctx, {
      challenges: await connection.queryObject<Challenge>`
        SELECT
            id,
            challenger,
            created_at
        FROM
            challenges
        WHERE
            challenger = ${name}
        OR
            id in (
                SELECT
                    challenge_id
                FROM
                    challenge_requests
                WHERE
                    name = ${name}
                OR
                    email = (
                        SELECT
                            email
                        FROM
                            players
                        WHERE
                            name = ${name}
                    )
            )
        ORDER BY
            created_at DESC
    `.then((r) => r.rows),
    });
  },
};

export default function Page(
  { data: { challenges, name: myName, playedToday } }: PageProps<
    Data & SessionData
  >,
) {
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
      <h2 class="text-xl">Challenges</h2>
      <ul class="max-w-md divide-y divide-gray-200 rounded shadow border m-4">
        {challenges.map(({ challenger, created_at, id }) => (
          <li class="divide-y divide-gray-700 hover:bg-gray-200">
            <a href={`/challenges/challenge/${id}`}>
              <div class="p-4 flex items-center space-x-4">
                <div class="flex-shrink-0">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      clipRule="evenodd"
                      fillRule="evenodd"
                      d="M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 00-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 00-.552.698 5 5 0 004.503 5.152 6 6 0 002.946 1.822A6.451 6.451 0 017.768 13H7.5A1.5 1.5 0 006 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 00.75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 00-1.5-1.5h-.268a6.453 6.453 0 01-.684-2.202 6 6 0 002.946-1.822 5 5 0 004.503-5.152.75.75 0 00-.552-.698A31.804 31.804 0 0016 2.562v-.387a.75.75 0 00-.629-.74A33.227 33.227 0 0010 1zM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 01-1.855-2.68zm14.95 0a3.503 3.503 0 01-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332z"
                    />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900 truncate">
                    <span>Challenger:</span>
                    <span class="pl-2 font-medium">{challenger}</span>
                  </p>
                  <p class="text-sm text-gray-500 truncate">
                    {moment(created_at).fromNow()}
                  </p>
                </div>
                <div class="inline-flex items-center text-base font-semibold text-gray-900">
                  ID: {id}
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </ReidleTemplate>
  );
}
