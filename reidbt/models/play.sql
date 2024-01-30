WITH
name_table AS (
    SELECT {{me()}} as name, CURRENT_DATE as day
),
inserting_checkpoint AS (
    INSERT INTO {{source('reidle', 'checkpoints')}} (
        "day", "name", "history", "created_at", "penalty"
    )
    SELECT
        day,
        name,
        '[]'::JSON,
        NOW(),
        0
    FROM
        name_table
    WHERE NOT EXISTS (
        SELECT 1 FROM {{source('reidle', 'checkpoints')}}
        NATURAL INNER JOIN name_table
        LIMIT 1
    )
    ON CONFLICT ("name")
    DO UPDATE SET
        {% for field in ["day", "name", "history", "created_at", "penalty"] %}
        {{field}} = EXCLUDED.{{field}}{% if not loop.last %},{% endif %}
        {% endfor %}
    RETURNING
        created_at,
        penalty,
        history
),
actual_checkpoint AS (
    SELECT {{to_json(['created_at', 'penalty', 'history'])}} AS checkpoint
    FROM (
        SELECT
            "history", "created_at", "penalty"
        FROM
            {{source('reidle', 'checkpoints')}}
        NATURAL INNER JOIN
            name_table
        UNION ALL
        SELECT
            "history", "created_at", "penalty"
        FROM
            inserting_checkpoint
    ) AS _
    LIMIT 1
)
SELECT
    word.word AS "startingWord",
    word.answer AS "word",
    leader.name AS winner,
    leader.time AS "winnersTime",
    checkpoint
FROM
    actual_checkpoint,
    {{ ref('todays_leader') }} AS leader
FULL OUTER JOIN
    {{ ref("todays_word") }} AS word
    ON true
