SELECT
    name,
    time
FROM
    {{ reidle('submissions') }}
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
