with
existing as (
    select name
    from
        {{ source('reidle', 'winners') }}
    where
        {{ is_previous_week('week') }}
),

computed as (
    select
        name,
        date_trunc('week', {{ week() }})::DATE as "week"
    from {{ ref("week_json") }} where not exists (select 1 from existing)
    limit 1
),

inserted as ( -- noqa: ST03
    insert into {{ source('reidle', 'winners') }} (name, week)
    select
        name,
        "week"
    from computed
)
{{ coalesce_tables('name', ['existing', 'computed']) }}
