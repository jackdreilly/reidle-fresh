SELECT DISTINCT ON (challenge_id)
    challenge_id,
    name AS winner,
    time AS winner_time
FROM
    {{ ref('last_two_days_submissions') }}
ORDER BY
    challenge_id ASC,
    time ASC
