with subs as (
    select
        "submission_id",
        "time",
        "penalty",
        "name",
        "paste"
    from "postgres"."public"."submissions"
    where "challenge_id" = 
$challenge_id

)

select
    json_agg(
        
json_build_object(
    
    'submission_id', submission_id,
    
    'time', time,
    
    'penalty', penalty,
    
    'name', name,
    
    'paste', paste
    
)

        order by "time"
    ) as submissions,
    exists(select 1 from subs where name = $name) as played
from subs