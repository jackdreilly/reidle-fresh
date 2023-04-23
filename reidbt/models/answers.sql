with source as (
    select * from {{ source('reidle', 'answers') }}
),

renamed as (
    select
        {{ adapter.quote("answer") }}

    from source
)

select * from renamed
