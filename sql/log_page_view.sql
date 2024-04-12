INSERT INTO "postgres"."public"."page_views" (
    "name", "url", "method"
)
SELECT
    $name,
    $url,
    $method