SELECT DISTINCT
    name,
    email
FROM {{ source("reidle", "players") }}
WHERE
    notifications_enabled
    AND email IS NOT NULL
    AND name NOT IN (SELECT name FROM {{ ref('todays_submissions') }})
