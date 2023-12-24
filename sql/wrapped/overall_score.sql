select 
    *,
    (ROW_NUMBER() OVER (ORDER BY overall_score DESC))::INT as overall_rank
from
    wrapped.overall_score
ORDER BY
    overall_score
        DESC