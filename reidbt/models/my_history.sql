SELECT
    last_two_days_challenges.challenge_id,
    last_two_days_submissions.time
FROM
    {{ ref("last_two_days_submissions") }} AS last_two_days_submissions
NATURAL INNER JOIN
    {{ ref("last_two_days_challenges") }} AS last_two_days_challenges
WHERE
    last_two_days_submissions.name = {{ me() }}
    AND
    last_two_days_challenges.is_today
