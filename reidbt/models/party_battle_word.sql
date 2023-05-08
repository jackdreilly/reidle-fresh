select state->'game'->'answer'
from {{source('reidle', 'battles')}}
where battle_id = 7