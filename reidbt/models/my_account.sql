select
    name,
    email,
    notifications_enabled
from {{ ref("players") }}
where name = {{ me() }}
