INSERT INTO {{source('reidle', 'checkpoints')}} (
    "day", "name", "history", "created_at", "penalty"
)
SELECT
    CURRENT_DATE,
    $name,
    $history,
    NOW(),
    $penalty
ON CONFLICT ("name")
DO UPDATE SET
    {% for field in ["history", "penalty"] %}
    {{field}} = EXCLUDED.{{field}}{% if not loop.last %},{% endif %}
    {% endfor %}