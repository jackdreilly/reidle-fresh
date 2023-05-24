update
    {{source("reidle", "submissions")}}
set
    score = other.score
from
    {{ref("week_table")}} other
where
    submission_id = other.submission_id