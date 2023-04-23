with source as (
    select * from {{ source('reidle', 'players') }}
),

renamed as (
    select
        {{ adapter.quote("name") }},
        {{ adapter.quote("email") }},
        {{ adapter.quote("notifications_enabled") }},
        {{ adapter.quote("created_at") }}

    from source
)

select * from renamed
