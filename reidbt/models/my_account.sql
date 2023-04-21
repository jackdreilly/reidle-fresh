select
    name,
    email,
    notifications_enabled
from {{ reidle("players") }}
where name = {{ me() }}
