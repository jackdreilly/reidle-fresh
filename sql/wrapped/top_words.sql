select 
    words,
    count::INT as count
from
    wrapped.top_words
WHERE
    name = $name
ORDER BY
    count DESC