WITH
my_next_challenge AS (SELECT challenge_id FROM {{ ref("my_next_challenge") }}),

created AS (
    INSERT INTO {{ reidle("challenges") }} (
        "starting_word", "answer"
    )
    SELECT
        (SELECT word FROM {{ reidle("words") }} ORDER BY random() LIMIT 1),
        (SELECT answer FROM {{ reidle('answers') }} ORDER BY random() LIMIT 1)
    WHERE
        NOT EXISTS (SELECT 1 FROM my_next_challenge
        ) -- noqa: PRS
    RETURNING challenge_id
)
{{ coalesce_tables('challenge_id', ['my_next_challenge', 'created']) }}
