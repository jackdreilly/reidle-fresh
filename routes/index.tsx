import { Handlers, PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import getWinner from "@/utils/get_winner.ts";
import { getName } from "@/utils/utils.ts";
import { WithSession } from "https://deno.land/x/fresh_session@0.2.0/mod.ts";

interface Data {
  name: string;
  winner: string;
}

export const handler: Handlers<
  Data,
  WithSession
> = {
  async GET(_req, ctx) {
    const name = getName(ctx);
    if (!name) {
      return new Response("", {
        status: 307,
        headers: { Location: "/set-name" },
      });
    }
    return ctx.render({ name, winner: await getWinner() });
  },
};

export default function Home(
  { data: { name, winner } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate>
      Welcome to Reidle, <strong>{name}</strong>!
      <p>Last week's winner: {winner}</p>
      <div>
        <nav class="m-4">
          <ul>
            {[
              ["play", "Play"],
              ["practice", "Practice"],
              ["stats/today", "Stats"],
              ["messages", "Messages"],
              ["set-name", "Set Name"],
            ].map(([link, text]) => (
              <li>
                <a
                  class="font-medium text-blue-600 dark:text-blue-500 hover:underline"
                  href={"/" + link}
                >
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </ReidleTemplate>
  );
}
