select
    name,
    email,
    notifications_enabled
from "postgres"."public"."players"
where name = $name