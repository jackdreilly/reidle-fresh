INSERT INTO {{ source("reidle", "battles") }} (state) VALUES (DEFAULT)
RETURNING battle_id
