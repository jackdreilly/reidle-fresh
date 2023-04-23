with source as (
    select * from {{ source('reidle', 'challenges') }}
),

renamed as (
    select
        {{ adapter.quote("challenge_id") }},
        {{ adapter.quote("created_at") }},
        {{ adapter.quote("starting_word") }},
        {{ adapter.quote("answer") }}

    from source
)

select * from renamed
