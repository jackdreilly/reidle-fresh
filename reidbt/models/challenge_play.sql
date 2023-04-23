WITH
challenge AS (
    SELECT
        challenge_id,
        starting_word,
        answer
    FROM {{ ref("challenges") }}
    WHERE challenge_id = {{ challenge_id() }}
),

subs AS (
    SELECT
        submissions.name,
        submissions.time
    FROM {{ ref("submissions") }} AS submissions
    INNER JOIN challenge ON submissions.challenge_id = challenge.challenge_id
),

leader AS (
    SELECT
        json_build_object(
            'name', name,
            'time', time
        ) AS leader
    FROM subs
    ORDER BY time ASC
    LIMIT 1
)
SELECT
    challenge.starting_word,
    challenge.answer,
    leader.leader,
    exists(SELECT 1 FROM subs WHERE name = {{ me() }}) AS already_played
FROM leader FULL OUTER JOIN challenge ON TRUE
