select count(*)::INT as pending_challenges from {{ ref("pending_challenges") }}
