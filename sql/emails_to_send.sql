with __dbt__cte__todays_submissions as (
SELECT
    name,
    time
FROM
    "postgres"."public"."submissions"
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
)SELECT DISTINCT
    name,
    email
FROM "postgres"."public"."players"
WHERE
    notifications_enabled
    AND email IS NOT NULL
    AND name NOT IN (SELECT name FROM __dbt__cte__todays_submissions)