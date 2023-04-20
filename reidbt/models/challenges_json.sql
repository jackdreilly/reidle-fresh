-- challenges_json.sql
SELECT
    today_leaderboard.today_leaderboard AS today_leaderboard,
    yesterday_leaderboard.yesterday_leaderboard AS yesterday_leaderboard,
    pending_challenges.pending_challenges AS pending_challenges,
    COALESCE(my_history_json.history, '[]') AS history
FROM
    {{ ref("my_history_json") }} AS my_history_json,
    {{ ref("today_leaderboard") }} AS today_leaderboard,
    {{ ref("yesterday_leaderboard") }} AS yesterday_leaderboard,
    {{ ref("pending_challenges") }} AS pending_challenges
