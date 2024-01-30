INSERT INTO "postgres"."public"."checkpoints" (
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
    
    history = EXCLUDED.history,
    
    penalty = EXCLUDED.penalty
    