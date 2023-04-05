import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { guardLogin, SessionData, SessionHandler } from "@/utils/utils.ts";

interface Data {
  name?: string;
  email?: string;
  notifications_enabled?: boolean;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    return guardLogin(ctx) ?? ctx.state.render(ctx,
      await ctx.state.connection.queryObject<
        Data
      >`select name, email, notifications_enabled from players where name = ${name} limit 1`
        .then((x) => x.rows[0] ?? { name }),
    );
  },
  async POST(req, ctx) {
    const form = await req.formData();
    const email = form.get("email")?.toString()?.toLowerCase();
    const notifications_enabled = form.has("notifications_enabled") && !!email;
    await ctx.state.connection.queryObject`
      INSERT INTO
        players (
          name,
          email,
          notifications_enabled
        )
      VALUES(
        ${ctx.state.name},
        NULLIF(${email}, ''),
        ${notifications_enabled}
      )
      ON CONFLICT (name)
          DO UPDATE
            SET
              email = EXCLUDED.email,
              notifications_enabled = EXCLUDED.notifications_enabled
      `;
    return new Response("", { status: 303, headers: { location: "/account" } });
  },
};

export default function Page(
  { data: { name, email, notifications_enabled, playedToday } }: PageProps<Data & SessionData>,
) {
  return (
    <ReidleTemplate  playedToday={playedToday} route="/account" title="Account">
      <h1 class="text-2xl uppercase">{name}</h1>
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
            placeholder="Email"
            name="email"
            title="Email"
            value={email}
          />
        </div>
        <div class="flex items-start mb-6">
          <div class="flex items-center h-5">
            <input
              id="notifications_enabled"
              type="checkbox"
              value=""
              class="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-blue-300"
              name="notifications_enabled"
              checked={notifications_enabled ||
                notifications_enabled === undefined}
            />
          </div>
          <label
            for="notifications_enabled"
            class="ml-2 text-sm font-medium text-gray-900"
          >
            Reminder Notifications
          </label>
        </div>
        <button
          type="submit"
          class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center"
        >
          Save
        </button>
      </form>
    </ReidleTemplate>
  );
}
