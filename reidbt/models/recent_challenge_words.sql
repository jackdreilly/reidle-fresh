select
    starting_word,
    answer,
    challenge_id
from {{ ref("challenges") }}
order by created_at desc
limit 10
