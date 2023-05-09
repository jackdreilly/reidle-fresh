import { PageProps } from "https://deno.land/x/fresh@1.1.5/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { BattleHomePage, runSql } from "../utils/sql_files.ts";
import { moment } from "https://deno.land/x/deno_moment@v1.1.2/moment.ts";

export const handler: SessionHandler<BattleHomePage> = {
  async GET(req, ctx) {
    return ctx.state.render(
      ctx,
      await runSql({
        file: "battle_home_page",
        connection: ctx.state.connection,
        single_row: true,
      }),
    );
  },
};

export default function Page(
  { data: { playedToday, users, updated_at, active_battles } }: PageProps<
    BattleHomePage & SessionData
  >,
) {
  return (
    <ReidleTemplate route="/battles" title="Battles" playedToday={playedToday}>
      <h1 class="text-3xl font-bold m-2 p-2">Battles</h1>
      <div class="flex">
        <div class="m-2 p-2 rounded shadow">
          <a
            href="/battles/party_room"
            class="m-2 px-3 py-2 h-12 bg-green-500 text-white rounded hover:bg-green-700 flex gap-2"
          >
            <svg
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M15.98 1.804a1 1 0 00-1.96 0l-.24 1.192a1 1 0 01-.784.785l-1.192.238a1 1 0 000 1.962l1.192.238a1 1 0 01.785.785l.238 1.192a1 1 0 001.962 0l.238-1.192a1 1 0 01.785-.785l1.192-.238a1 1 0 000-1.962l-1.192-.238a1 1 0 01-.785-.785l-.238-1.192zM6.949 5.684a1 1 0 00-1.898 0l-.683 2.051a1 1 0 01-.633.633l-2.051.683a1 1 0 000 1.898l2.051.684a1 1 0 01.633.632l.683 2.051a1 1 0 001.898 0l.683-2.051a1 1 0 01.633-.633l2.051-.683a1 1 0 000-1.898l-2.051-.683a1 1 0 01-.633-.633L6.95 5.684zM13.949 13.684a1 1 0 00-1.898 0l-.184.551a1 1 0 01-.632.633l-.551.183a1 1 0 000 1.898l.551.183a1 1 0 01.633.633l.183.551a1 1 0 001.898 0l.184-.551a1 1 0 01.632-.633l.551-.183a1 1 0 000-1.898l-.551-.184a1 1 0 01-.633-.632l-.183-.551z" />
            </svg>
            Party Room
          </a>
          <div class="p-2 m-2">Active {moment(updated_at).fromNow()}</div>
          {(new Date().getTime() - updated_at.getTime()) < 1000 * 120
            ? <div class="p-2 m-2">{users.join(", ")}</div>
            : null}
        </div>
        <div class="m-2 p-2 rounded shadow">
          <a
            href="/battles/new"
            class="m-2 px-3 py-2 h-12 bg-blue-500 text-white rounded hover:bg-blue-700 flex gap-2"
          >
            <svg
              class="flex-shrink-0 w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900"
              fill="white"
              x="0px"
              y="0px"
              height="24"
              width="24"
            >
              <path
                d="M 119,462 C 99,457 66,431 39,402 10,369 -2,343 3,322 6,314 10,305 15,298 c 7,-8 25,-29 27,-28 2,1 -0,7 -1,16 -2,18 -2,27 2,34 3,7 6,11 26,35 24,29 28,33 39,33 8,0 12,-2 19,-8 C 132,374 134,370 134,364 c 0,-6 -2,-10 -10,-18 C 108,330 92,308 85,296 80,284 79,280 79,254 L 79,231 80,230 84,226 l 5,-5 0,-12 c 0,-30 5,-63 15,-88 8,-23 24,-50 38,-69 9,-11 23,-25 33,-31 C 185,14 202,6 212,3 c 11,-3 25,-2 33,1 9,3 19,10 20,19 0,0 1,2 -1,8 -20,54 -7,18 21,-0 C 293,26 310,21 327,21 c 20,0 34,4 52,15 14,8 24,16 40,32 24,24 38,43 50,66 9,18 11,27 11,45 0,16 -1,21 -6,36 -10,31 -34,62 -69,92 -56,47 -107,70 -161,74 l -9,1 -11,13 c -40,46 -59,61 -79,67 -8,2 -19,2 -25,1 z"
                transform="matrix(0.05019839,0,0,0.05019839,-0.09522931,0.33275301)"
              />
            </svg>
            New Battle
          </a>
          {active_battles.length
            ? (
              <div class="rounded shadow m-2 p-2">
                <h2 class="m-2 p-2">Active Rooms</h2>
                <ul>
                  {active_battles.map(({ battle_id, users }) => (
                    <li class="m-2 p-2">
                      <a
                        href={`/battles/${battle_id}`}
                        class="m-2 px-3 py-2 h-12 bg-blue-500 text-white rounded hover:bg-blue-700 flex gap-2"
                      >
                        {users.join(", ")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )
            : null}
        </div>
      </div>
    </ReidleTemplate>
  );
}
