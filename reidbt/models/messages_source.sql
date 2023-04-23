with source as (
    select * from {{ source('reidle', 'messages_source') }}
),

renamed as (
    select


    from source
)

select * from renamed
