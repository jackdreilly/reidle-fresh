import { PageProps } from "$fresh/server.ts";
import ReidleTemplate from "@/components/reidle_template.tsx";
import { getName, SessionHandler } from "@/utils/utils.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";
import Input from "@/components/input.tsx";

interface Data {
  email?: string;
}

export const handler: SessionHandler<Data> = {
  async GET(req, ctx) {
    const email = new URL(req.url).searchParams.get("email") ??
      await getEmail(getName(ctx), ctx.state.connection);
    return ctx.render({ email });
  },
};
export default function Page({ data: { email } }: PageProps<Data>) {
  return (
    <ReidleTemplate title="Unsubscribe">
      <form method="POST">
        {email ? null : <Input type="text" placeholder="email" value={email ?? ""} />}
        <Input type="submit" value={`Unsubscribe ${email ?? ""}`} />
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
