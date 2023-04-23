SELECT
    challenge_id,
    answer,
    created_at >= CURRENT_DATE AS is_today
FROM
    {{ ref("challenges") }}
WHERE
    created_at >= CURRENT_DATE - INTERVAL '1 days'
