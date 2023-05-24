WITH _ AS ( -- noqa
    INSERT INTO {{ source("reidle", "message_reads_source") }} (
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
