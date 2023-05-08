update
{{ source('reidle', 'battles') }}
set
    state = {{ new_battle_state() }}
where battle_id = {{ export_var('battle_id') }}
