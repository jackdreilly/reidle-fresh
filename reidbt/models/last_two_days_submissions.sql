SELECT
    last_two_days_challenges.challenge_id AS challenge_id,
    submissions.name AS "name",
    submissions.time AS "time",
    COUNT(*) OVER (PARTITION BY challenge_id) AS player_count
FROM
    {{ ref("last_two_days_challenges") }} AS last_two_days_challenges
NATURAL INNER JOIN
    {{ source("reidle", "submissions") }} AS submissions
