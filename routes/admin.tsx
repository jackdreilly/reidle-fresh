import { HandlerContext, PageProps } from "$fresh/server.ts";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
interface Player {
  name: string;
  email: string;
  notifications_enabled: boolean;
}
interface Data {
  players: Player[];
}

async function data(ctx: HandlerContext<Data, SessionData>): Promise<Data> {
  return {
    players: (await ctx.state.connection.queryObject<
      Player
    >`select name, email, notifications_enabled from players order by name`)
      .rows,
  };
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    if (ctx.state.name.toLowerCase() !== "jack") {
      return new Response("unauthorized", { status: 401 });
    }
    return ctx.render(await data(ctx));
  },
};

export default function Page({ data: { players } }: PageProps<Data>) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Notifications Enabled</th>
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr>
            <td>{player.name}</td>
            <td>{player.email}</td>
            <td>{player.notifications_enabled ? "yes" : "no"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
