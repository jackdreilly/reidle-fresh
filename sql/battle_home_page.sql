select
    users,
    updated_at,
    COALESCE((
        select
            JSON_AGG(JSON_BUILD_OBJECT(
                'battle_id', battle_id,
                'users', users
            ) order by updated_at desc)
        from battles
        where
            updated_at > NOW() - interval '20 second'
            and JSON_ARRAY_LENGTH(users) > 0
            and battle_id != 7
    ), '[]') as active_battles
from
    "postgres"."public"."battles"
where
    battle_id = 7