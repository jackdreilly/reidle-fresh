select challenges.challenge_id
from {{ source("reidle", "challenges") }} as challenges
natural inner join {{ ref('pending_challenges') }}
order by challenges.created_at
limit 1
