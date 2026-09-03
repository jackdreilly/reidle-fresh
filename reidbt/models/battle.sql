select state, users, updated_at
from {{ source('reidle', 'battles') }}
where battle_id = {{ export_var('battle_id') }}
