with source as (
    select * from {{ source('reidle', 'message_reads_source') }}
),

renamed as (
    select


    from source
)

select * from renamed
