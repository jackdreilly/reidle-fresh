select EXISTS(
    select 1
    from
        {{ ref('submissions') }}
    where
        name = {{ me() }}
        and day = CURRENT_DATE
        and challenge_id is null
) as played
