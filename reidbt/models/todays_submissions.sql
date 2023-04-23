SELECT
    name,
    time
FROM
    {{ ref('submissions') }}
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
