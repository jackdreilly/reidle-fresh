with __dbt__cte__challenges as (
with source as (
    select * from "postgres"."public"."challenges"
),

renamed as (
    select
        "challenge_id",
        "created_at",
        "starting_word",
        "answer"

    from source
)

select * from renamed
),  __dbt__cte__last_two_days_challenges as (
SELECT
    challenge_id,
    answer,
    created_at >= CURRENT_DATE AS is_today
FROM
    __dbt__cte__challenges
WHERE
    created_at >= CURRENT_DATE - INTERVAL '1 days'
),  __dbt__cte__submissions as (
select * from "postgres"."public"."submissions"
),  __dbt__cte__last_two_days_submissions as (
SELECT
    last_two_days_challenges.challenge_id AS challenge_id,
    submissions.name AS "name",
    submissions.time AS "time",
    COUNT(*) OVER (PARTITION BY challenge_id) AS player_count
FROM
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
NATURAL INNER JOIN
    __dbt__cte__submissions AS submissions
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
)select count(*)::INT as pending_challenges from __dbt__cte__pending_challenges