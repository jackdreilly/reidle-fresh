SELECT
    last_two_days_challenges.is_today,
    scorable_submissions.name,
    COUNT(*) AS loser_points
FROM
    {{ ref('challenge_players') }}
NATURAL INNER JOIN
    {{ ref('last_two_days_challenges') }} AS last_two_days_challenges
NATURAL INNER JOIN
    {{ ref('scorable_submissions') }} AS scorable_submissions
GROUP BY
    1, 2
