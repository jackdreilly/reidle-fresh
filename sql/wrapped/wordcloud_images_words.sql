select 
    name,
    image
from
    wrapped.wordcloud_images_words
WHERE
    name IN ($name, 'all')