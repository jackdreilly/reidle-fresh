WITH
my_next_challenge AS (SELECT challenge_id FROM {{ ref("my_next_challenge") }}),

created AS (
    INSERT INTO {{ ref("challenges") }} (
        "starting_word", "answer"
    )
    SELECT
        (SELECT word FROM {{ ref("words") }} ORDER BY random() LIMIT 1),
        (SELECT answer FROM {{ ref('answers') }} ORDER BY random() LIMIT 1)
    WHERE
        NOT EXISTS (SELECT 1 FROM my_next_challenge
        ) -- noqa: PRS
    RETURNING challenge_id
)
{{ coalesce_tables('challenge_id', ['my_next_challenge', 'created']) }}
