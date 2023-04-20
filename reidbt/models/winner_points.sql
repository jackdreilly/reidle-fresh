SELECT
    last_two_days_challenges.is_today,
    challenge_winners.name,
    sum(challenge_players.player_count) AS winner_points,
    count(*) AS num_wins
FROM
    (
        SELECT
            challenge_id,
            winner AS "name"
        FROM {{ ref('challenge_winners') }}
    ) AS challenge_winners
NATURAL INNER JOIN
    {{ ref('challenge_players') }} AS challenge_players
NATURAL INNER JOIN
    {{ ref('last_two_days_challenges') }} AS last_two_days_challenges
NATURAL INNER JOIN
    {{ ref('scorable_submissions') }}
GROUP BY
    1, 2
