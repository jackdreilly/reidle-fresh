select 
    name,
    image
from
    wrapped.wordcloud_images
WHERE
    name IN ($name, 'all')