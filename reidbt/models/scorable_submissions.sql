SELECT
    challenge_id,
    "name",
    "time"
FROM
    {{ ref("last_two_days_submissions") }}
WHERE
    player_count > 1
