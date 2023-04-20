import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionData, SessionHandler } from "@/utils/utils.ts";
import { PoolClient } from "psql";

interface Data {
  email?: string;
  unsubscribed?: boolean;
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const email = new URL(req.url).searchParams.get("email") ??
      await getEmail(ctx.state.name, ctx.state.connection);
    return ctx.state.render(ctx, { email });
  },
  async POST(req, ctx) {
    const email = (await req.formData()).get("email") as string;
    if (!email) {
      return ctx.state.render(ctx, {});
    }
    await ctx.state.connection
      .queryObject`update players set notifications_enabled = false where email = ${email}`;
    return ctx.state.render(ctx, { email, unsubscribed: true });
  },
};
export default function Page(
  { data: { email, unsubscribed, playedToday } }: PageProps<Data & SessionData>,
) {
  email ??= "";
  return (
    <ReidleTemplate
      playedToday={playedToday}
      route="/unsubscribe"
      title="Unsubscribe"
    >
      <h1 class="text-2xl my-4">Reminder Notifications</h1>
      {unsubscribed
        ? "You have been successfully unsubscribed from daily notifications"
        : (
          <form method="POST" class="my-4 max-w-sm">
            <div class="mb-6">
              <label
                for="email"
                class="block mb-2 text-sm font-medium text-gray-900"
              >
                Your email
              </label>
              <input
                type="email"
                id="email"
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                required
                autoFocus
                readOnly={!!email}
                placeholder="Email"
                name="email"
                title="Email"
                value={email}
              />
            </div>
            <button
              type="submit"
              class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center"
            >
              Unsubscribe
            </button>
          </form>
        )}
    </ReidleTemplate>
  );
}

async function getEmail(
  name: string | null,
  connection: PoolClient,
): Promise<string | undefined> {
  if (!name) {
    return undefined;
  }
  const response = await connection.queryObject<
    { email: string }
  >`select email from players where name = ${name} limit 1`;
  return response.rows[0]?.email;
}
