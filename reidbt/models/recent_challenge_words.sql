select
    starting_word,
    answer,
    challenge_id
from {{ source("reidle", "challenges") }}
order by created_at desc
limit 10
