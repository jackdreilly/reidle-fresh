INSERT INTO
{{ source("reidle", "battles") }} (state) VALUES (    {{ new_battle_state() }})
RETURNING battle_id
