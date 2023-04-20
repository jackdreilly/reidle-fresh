WITH
ids AS (
    SELECT DISTINCT
        challenge_id,
        player_count
    FROM {{ ref("last_two_days_submissions") }}
),

players AS (
    SELECT
        w.challenge_id,
        json_agg(s.name ORDER BY s.name) AS players
    FROM {{ ref("last_two_days_submissions") }} AS s
    INNER JOIN
        {{ ref('challenge_winners') }} AS w
        ON s.challenge_id = w.challenge_id
    WHERE
        s.name != {{ me() }}
        AND s.name != w.winner
    GROUP BY w.challenge_id
)

SELECT
    ids.challenge_id,
    ids.player_count,
    {{ or_array('players.players') }} AS players
FROM ids NATURAL FULL OUTER JOIN players
