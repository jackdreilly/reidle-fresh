with __dbt__cte__words as (
with source as (
    select * from "postgres"."public"."words"
),

renamed as (
    select
        "word"

    from source
)

select * from renamed
),  __dbt__cte__random_word as (
select word from __dbt__cte__words order by random() limit 1
),  __dbt__cte__answers as (
with source as (
    select * from "postgres"."public"."answers"
),

renamed as (
    select
        "answer"

    from source
)

select * from renamed
),  __dbt__cte__random_answer as (
select answer from __dbt__cte__answers order by random() limit 1
)update
"postgres"."public"."battles"
set
    state = 
JSON_BUILD_OBJECT(
    'history', '[]'::JSON,
    'game', JSON_BUILD_OBJECT(
        'starting_word',
        (select word from __dbt__cte__random_word),
        'answer',
        (select answer from __dbt__cte__random_answer)
    )
)

where battle_id = $battle_id