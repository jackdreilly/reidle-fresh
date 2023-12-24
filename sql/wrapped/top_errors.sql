select 
    errors,
    count::INT as count
from
    wrapped.top_errors
WHERE
    name = $name
ORDER BY
    count DESC