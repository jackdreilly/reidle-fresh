select 
    errors,
    count::INT as count
from
    wrapped.top_errors_overall
ORDER BY
    count DESC