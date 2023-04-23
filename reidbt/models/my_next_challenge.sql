select challenges.challenge_id
from {{ ref('challenges') }} as challenges
natural inner join {{ ref('pending_challenges') }}
order by challenges.created_at
limit 1
