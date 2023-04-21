select
    name,
    time
from
    {{ ref('todays_submissions') }}
order by time
limit 1
