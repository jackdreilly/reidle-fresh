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
)SELECT
    word.word AS "startingWord",
    word.answer AS "word",
    leader.name AS winner,
    leader.time AS "winnersTime"
FROM
    __dbt__cte__todays_leader AS leader
FULL OUTER JOIN
    __dbt__cte__todays_word AS word
    ON true