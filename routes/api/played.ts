import { jsonResponse, SessionHandler } from "@/utils/utils.ts";
import { PoolClient } from "https://deno.land/x/postgres@v0.14.0/mod.ts";

export async function played(
  { state: { name, connection } }: {
    state: { name: string; connection: PoolClient };
  },
): Promise<boolean> {
  const response = await connection.queryObject`
    select
        id
    from
        submissions
    where
        CURRENT_DATE = day
    and
        name = ${name}
`;
  return (response.rowCount ?? 0) > 0;
}

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    return jsonResponse(await played(ctx));
  },
};
