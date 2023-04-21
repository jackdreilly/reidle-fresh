SELECT DISTINCT
    name,
    email
FROM {{ reidle('players') }}
WHERE
    notifications_enabled
    AND email IS NOT NULL
    AND name NOT IN (SELECT name FROM {{ ref('todays_submissions') }})
