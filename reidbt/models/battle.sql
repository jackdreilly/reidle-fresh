select state
from {{ source('reidle', 'battles') }}
where battle_id = {{ export_var('battle_id') }}
