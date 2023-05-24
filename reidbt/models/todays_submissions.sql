SELECT
    name,
    time
FROM
    {{ source("reidle", "submissions") }}
WHERE
    challenge_id IS NULL
    AND
    day = CURRENT_DATE
