select state, users, updated_at
from "postgres"."public"."battles"
where battle_id = $battle_id