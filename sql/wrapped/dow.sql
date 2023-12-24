select 
    *,
    (ROW_NUMBER() OVER (ORDER BY dow_score desc))::INT as dow_rank
from wrapped.dow
    where name = $name
ORDER BY
    dow