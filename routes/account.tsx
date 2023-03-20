import { PageProps } from "$fresh/server.ts";
import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionHandler } from "@/utils/utils.ts";

interface Data {
  name?: string;
  email?: string;
  notifications_enabled?: boolean;
}

export const handler: SessionHandler<Data> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    return ctx.render(
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
    return new Response("", { status: 303, headers: { location: "/" } });
  },
};

export default function Page(
  { data: { name, email, notifications_enabled } }: PageProps<Data>,
) {
  return (
    <ReidleTemplate route="/account" title="Account">
      <form method="POST">
        <div>
          Name: <span class="font-bold">{name}</span>
        </div>
        <label for="name">Email</label>
        <Input
          class="block m-4"
          autoFocus={true}
          type="email"
          placeholder="Email"
          name="email"
          title="Email"
          value={email}
        />
        <label for="name">
          Reminder Emails if you haven't played w/ 4 hours remaining (you can
          disable these whenever)
        </label>
        <Input
          class="block m-4"
          type="checkbox"
          name="notifications_enabled"
          checked={notifications_enabled || notifications_enabled === undefined}
        />
        <Input class="block m-4 cursor-pointer" type="submit" />
      </form>
      <a
        class="p-2 m-4 rounded-sm text-red-500 font-bold border-2 hover:bg-gray-100"
        href="/sign-out"
      >
        Sign Out
      </a>
    </ReidleTemplate>
  );
}
