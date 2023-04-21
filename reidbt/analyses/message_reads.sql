WITH _ AS ( -- noqa
    INSERT INTO {{ reidle("message_reads") }} (
        "name", "last_read"
    )
    VALUES ({{ me() }}, NOW())
    ON CONFLICT ("name") DO UPDATE SET "last_read" = NOW()
)

SELECT
    "message",
    "name",
    "created_at",
    "message_id"
FROM {{ ref("messages") }}
