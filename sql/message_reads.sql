WITH  __dbt__cte__messages as (
SELECT
    message,
    name,
    created_at,
    message_id,
    likes
FROM
    "postgres"."public"."messages"
WHERE
    created_at::DATE
    >=
    (CURRENT_DATE - INTERVAL '1 MONTH')
ORDER BY
    "created_at"
    DESC
),_ AS ( -- noqa
    INSERT INTO "postgres"."public"."message_reads" (
        "name", "last_read"
    )
    VALUES ($name, NOW())
    ON CONFLICT ("name") DO UPDATE SET "last_read" = NOW()
)

SELECT
    "message",
    "name",
    "created_at",
    "message_id",
    "likes"
FROM __dbt__cte__messages