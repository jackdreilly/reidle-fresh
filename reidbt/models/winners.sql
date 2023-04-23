with source as (
    select * from {{ source('reidle', 'winners') }}
),

renamed as (
    select
        {{ adapter.quote("week") }},
        {{ adapter.quote("name") }}

    from source
)

select * from renamed
