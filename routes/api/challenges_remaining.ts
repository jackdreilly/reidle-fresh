import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async GET(_, ctx) {
    const name = ctx.state.name;
    return new Response(
      await ctx.state.connection.queryArray`
WITH
challenges as (
select distinct
    id as challenge_id
from
    challenges
where
    challenger = ${name}
UNION
select
    challenge_id
from
    challenge_requests
where
    name = ${name}
)
select
count(*)
from
challenges
where
challenge_id not in (
    select
    challenge_id
    from
    challenge_submissions
    where
      name = ${name}
)
`.then((x) => (x.rows[0][0] as boolean) ? "yes" : ""),
    );
  },
};
