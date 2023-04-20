select
    starting_word,
    answer
from {{ source("reidle", "challenges") }}
order by created_at desc
limit 10
