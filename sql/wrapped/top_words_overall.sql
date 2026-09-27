select 
    words,
    count::INT as count
from
    wrapped.top_words_overall
ORDER BY
    count DESC