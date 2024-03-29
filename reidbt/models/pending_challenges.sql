WITH
today_challenges AS (
    SELECT
        s.challenge_id,
        s.name
    FROM {{ ref("last_two_days_challenges") }} AS c
    NATURAL INNER JOIN {{ ref("last_two_days_submissions") }} AS s
    WHERE c.is_today
)
SELECT challenge_id FROM today_challenges
EXCEPT
SELECT challenge_id FROM today_challenges WHERE name = {{ me() }}
