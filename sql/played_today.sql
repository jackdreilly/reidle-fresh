select EXISTS(
    select 1
    from
        "postgres"."public"."submissions"
    where
        name = $name
        and day = CURRENT_DATE
        and challenge_id is null
) as played