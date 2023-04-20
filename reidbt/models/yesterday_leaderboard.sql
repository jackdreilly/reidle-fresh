SELECT COALESCE((
    SELECT leaderboard
    FROM
        {{ ref("leaderboard_json") }}
    WHERE
        NOT is_today
), '[]') AS yesterday_leaderboard
