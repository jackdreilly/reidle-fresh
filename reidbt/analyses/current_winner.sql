{% set week %}
NOW() - INTERVAL '7 days'
{% endset %}
with
existing as (
    select name
    from
        {{ reidle('winners') }}
    where
        {{ is_previous_week('week') }}
),

computed as (
    select
        name,
        date_trunc('week', {{ week }})::DATE as "week"
    from {{ week_json(week) }} as week_json
    where not exists (select 1 from existing)
    limit 1
),

inserted as ( -- noqa: ST03
    insert into {{ reidle('winners') }} (name, week)
    select
        name,
        "week"
    from computed
)
{{ coalesce_tables('name', ['existing', 'computed']) }}
