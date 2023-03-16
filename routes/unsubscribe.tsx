import { PageProps } from "$fresh/server.ts";
import Input from "@/components/input.tsx";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { SessionHandler } from "@/utils/utils.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

interface Data {
  email?: string;
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const email = new URL(req.url).searchParams.get("email") ??
      await getEmail(ctx.state.name, ctx.state.connection);
    return ctx.render({ email });
  },
  async POST(req, ctx) {
    const email = (await req.formData()).get("email");
    await ctx.state.connection
      .queryObject`update players set notifications_enabled = false where email = ${email}`;
    return new Response("", { status: 303, headers: { location: "/" } });
  },
};
export default function Page({ data: { email } }: PageProps<Data>) {
  email ??= "";
  return (
    <ReidleTemplate title="Unsubscribe">
      <form method="POST">
        <Input type={email ? "hidden" : "text"} name="email" value={email} />
        <Input
          class="cursor-pointer"
          type="submit"
          value={`Unsubscribe ${email}?`}
        />
      </form>
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
