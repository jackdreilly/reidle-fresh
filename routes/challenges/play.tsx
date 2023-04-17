import { SessionHandler } from "@/utils/utils.ts";

export const handler: SessionHandler<null> = {
  async GET(req, ctx) {
    const challenge_id = await ctx.state.connection.queryObject<
      { challenge_id: number }
    >`
    with
a as (
    select
        challenge_id
    from
        submissions
    WHERE
        challenge_id IS NOT NULL
    AND
        date_trunc('week', created_at) = date_trunc('week', now())
    AND
        NOT EXISTS (
            SELECT
                1
            FROM
                submissions b
            WHERE
                b.challenge_id = submissions.challenge_id
            AND
                b.name = ${ctx.state.name}
        )
),
b as (
    INSERT INTO challenges (starting_word, answer)
    SELECT
        (SELECT word from words order by random() limit 1),
        (SELECT answer from answers order by random() limit 1)
    WHERE NOT EXISTS (SELECT 1 FROM a)
    RETURNING
        challenge_id
)
SELECT COALESCE(a.challenge_id, b.challenge_id) AS challenge_id FROM a FULL OUTER JOIN b ON TRUE
`.then((x) => x.rows[0].challenge_id);
    return new Response("Go to next challenge", {
      status: 307,
      headers: { location: `/challenges/challenge/${challenge_id}/play` },
    });
  },
};
