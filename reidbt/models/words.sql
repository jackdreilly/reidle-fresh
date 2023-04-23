with source as (
    select * from {{ source('reidle', 'words') }}
),

renamed as (
    select
        {{ adapter.quote("word") }}

    from source
)

select * from renamed
