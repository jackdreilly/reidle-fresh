SELECT COALESCE((
    SELECT leaderboard
    FROM
        {{ ref("leaderboard_json") }}
    WHERE
        is_today
), '[]') AS today_leaderboard
