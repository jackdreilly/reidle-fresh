with subs as (
    select
        "submission_id",
        "time",
        "penalty",
        "name",
        "paste"
    from {{ source("reidle", "submissions") }}
    where "challenge_id" = {{ challenge_id() }}
)

select
    json_agg(
        {{ to_json(['submission_id', 'time', 'penalty', 'name', 'paste']) }}
        order by "time"
    ) as submissions,
    exists(select 1 from subs where name = {{ me() }}) as played
from subs
