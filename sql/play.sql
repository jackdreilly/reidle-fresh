WITH
 __dbt__cte__todays_submissions as (
SELECT
    name,
    time
FROM
    "postgres"."public"."submissions"
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
),  __dbt__cte__todays_leader as (
select
    name,
    time
from
    __dbt__cte__todays_submissions
order by time
limit 1
),  __dbt__cte__todays_word as (
select
    upper(word) as word,
    upper(answer) as answer
from
    "postgres"."public"."daily_words"
where
    day = current_date
limit 1
),name_table AS (
    SELECT $name as name, CURRENT_DATE as day
),
inserting_checkpoint AS (
    INSERT INTO "postgres"."public"."checkpoints" (
        "day", "name", "history", "created_at", "penalty"
    )
    SELECT
        day,
        name,
        '[]'::JSON,
        NOW(),
        0
    FROM
        name_table
    WHERE NOT EXISTS (
        SELECT 1 FROM "postgres"."public"."checkpoints"
        NATURAL INNER JOIN name_table
        LIMIT 1
    )
    ON CONFLICT ("name")
    DO UPDATE SET
        
        day = EXCLUDED.day,
        
        name = EXCLUDED.name,
        
        history = EXCLUDED.history,
        
        created_at = EXCLUDED.created_at,
        
        penalty = EXCLUDED.penalty
        
    RETURNING
        created_at,
        penalty,
        history
),
actual_checkpoint AS (
    SELECT 
json_build_object(
    
    'created_at', created_at,
    
    'penalty', penalty,
    
    'history', history
    
)
 AS checkpoint
    FROM (
        SELECT
            "history", "created_at", "penalty"
        FROM
            "postgres"."public"."checkpoints"
        NATURAL INNER JOIN
            name_table
        UNION ALL
        SELECT
            "history", "created_at", "penalty"
        FROM
            inserting_checkpoint
    ) AS _
    LIMIT 1
)
SELECT
    word.word AS "startingWord",
    word.answer AS "word",
    leader.name AS winner,
    leader.time AS "winnersTime",
    checkpoint
FROM
    actual_checkpoint,
    __dbt__cte__todays_leader AS leader
FULL OUTER JOIN
    __dbt__cte__todays_word AS word
    ON true