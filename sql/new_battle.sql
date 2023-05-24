with __dbt__cte__random_word as (
select word from "postgres"."public"."words" order by random() limit 1
),  __dbt__cte__random_answer as (
select answer from "postgres"."public"."answers" order by random() limit 1
)INSERT INTO
"postgres"."public"."battles" (state) VALUES (    
JSON_BUILD_OBJECT(
    'history', '[]'::JSON,
    'game', JSON_BUILD_OBJECT(
        'starting_word',
        (select word from __dbt__cte__random_word),
        'answer',
        (select answer from __dbt__cte__random_answer)
    )
)
)
RETURNING battle_id