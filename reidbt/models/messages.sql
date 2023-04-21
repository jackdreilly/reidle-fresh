SELECT
    message,
    name,
    created_at,
    message_id
FROM
    {{ reidle('messages') }}
WHERE
    created_at::DATE
    >=
    (CURRENT_DATE - INTERVAL '1 MONTH')
ORDER BY
    "created_at"
    DESC
