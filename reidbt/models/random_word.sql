select word from {{ source("reidle", "words") }} order by random() limit 1