with source as (
    select * from {{ source('reidle', 'daily_words') }}
),

renamed as (
    select
        {{ adapter.quote("day") }},
        {{ adapter.quote("word") }},
        {{ adapter.quote("answer") }}

    from source
)

select * from renamed
