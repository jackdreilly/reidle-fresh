WITH
 __dbt__cte__last_two_days_challenges as (
SELECT
    challenge_id,
    answer,
    created_at >= CURRENT_DATE AS is_today
FROM
    "postgres"."public"."challenges"
WHERE
    created_at >= CURRENT_DATE - INTERVAL '1 days'
),  __dbt__cte__last_two_days_submissions as (
SELECT
    last_two_days_challenges.challenge_id AS challenge_id,
    submissions.name AS "name",
    submissions.time AS "time",
    COUNT(*) OVER (PARTITION BY challenge_id) AS player_count
FROM
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
NATURAL INNER JOIN
    "postgres"."public"."submissions" AS submissions
),  __dbt__cte__pending_challenges as (
WITH
today_challenges AS (
    SELECT
        s.challenge_id,
        s.name
    FROM __dbt__cte__last_two_days_challenges AS c
    NATURAL INNER JOIN __dbt__cte__last_two_days_submissions AS s
    WHERE c.is_today
)
SELECT challenge_id FROM today_challenges
EXCEPT
SELECT challenge_id FROM today_challenges WHERE name = $name
),  __dbt__cte__my_next_challenge as (
select challenges.challenge_id
from "postgres"."public"."challenges" as challenges
natural inner join __dbt__cte__pending_challenges
order by challenges.created_at
limit 1
),my_next_challenge AS (SELECT challenge_id FROM __dbt__cte__my_next_challenge),

created AS (
    INSERT INTO "postgres"."public"."challenges" (
        "starting_word", "answer"
    )
    SELECT
        (SELECT word FROM "postgres"."public"."words" ORDER BY random() LIMIT 1),
        (SELECT answer FROM "postgres"."public"."answers" ORDER BY random() LIMIT 1)
    WHERE
        NOT EXISTS (SELECT 1 FROM my_next_challenge
        ) -- noqa: PRS
    RETURNING challenge_id
)

select
    coalesce(
        
        my_next_challenge.challenge_id,
        
        
        created.challenge_id
        
    ) as challenge_id
from
    my_next_challenge

FULL OUTER JOIN
    created
ON
    TRUE

