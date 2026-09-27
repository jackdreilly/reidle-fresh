select
    name,
    email,
    notifications_enabled
from {{ source("reidle", "players") }}
where name = {{ me() }}
