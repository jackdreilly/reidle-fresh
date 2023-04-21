select EXISTS(
    select 1
    from
        {{ reidle('submissions') }}
    where
        name = {{ me() }}
        and day = CURRENT_DATE
        and challenge_id is null
) as played
