INSERT INTO {{source('reidle', 'page_views')}} (
    "name", "url", "method"
)
SELECT
    $name,
    $url,
    $method