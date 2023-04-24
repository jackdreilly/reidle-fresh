with __dbt__cte__players as (
with source as (
    select * from "postgres"."public"."players"
),

renamed as (
    select
        "name",
        "email",
        "notifications_enabled",
        "created_at"

    from source
)

select * from renamed
),  __dbt__cte__submissions as (
select * from "postgres"."public"."submissions"
),  __dbt__cte__todays_submissions as (
SELECT
    name,
    time
FROM
    __dbt__cte__submissions
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
)SELECT DISTINCT
    name,
    email
FROM __dbt__cte__players
WHERE
    notifications_enabled
    AND email IS NOT NULL
    AND name NOT IN (SELECT name FROM __dbt__cte__todays_submissions)