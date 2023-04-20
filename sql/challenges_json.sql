with __dbt__cte__last_two_days_challenges as (
SELECT
    challenge_id,
    answer,
    created_at >= CURRENT_DATE AS is_today
FROM
    "postgres"."public"."challenges"
WHERE
    created_at >= CURRENT_DATE - INTERVAL '1 days'
),  __dbt__cte__last_two_days_submissions as (
SELECT
    last_two_days_challenges.challenge_id AS challenge_id,
    submissions.name AS "name",
    submissions.time AS "time",
    COUNT(*) OVER (PARTITION BY challenge_id) AS player_count
FROM
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
NATURAL INNER JOIN
    "postgres"."public"."submissions" AS submissions
),  __dbt__cte__my_history as (
SELECT
    last_two_days_challenges.challenge_id,
    last_two_days_submissions.time
FROM
    __dbt__cte__last_two_days_submissions AS last_two_days_submissions
NATURAL INNER JOIN
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
WHERE
    last_two_days_submissions.name = $name
    AND
    last_two_days_challenges.is_today
),  __dbt__cte__challenge_winners as (
SELECT DISTINCT ON (challenge_id)
    challenge_id,
    name AS winner,
    time AS winner_time
FROM
    __dbt__cte__last_two_days_submissions
ORDER BY
    challenge_id ASC,
    time ASC
),  __dbt__cte__challenge_players as (
WITH
ids AS (
    SELECT DISTINCT
        challenge_id,
        player_count
    FROM __dbt__cte__last_two_days_submissions
),

players AS (
    SELECT
        w.challenge_id,
        json_agg(s.name ORDER BY s.name) AS players
    FROM __dbt__cte__last_two_days_submissions AS s
    INNER JOIN
        __dbt__cte__challenge_winners AS w
        ON s.challenge_id = w.challenge_id
    WHERE
        s.name != $name
        AND s.name != w.winner
    GROUP BY w.challenge_id
)

SELECT
    ids.challenge_id,
    ids.player_count,
    COALESCE(players.players, '[]') AS players
FROM ids NATURAL FULL OUTER JOIN players
),  __dbt__cte__my_history_json as (
select
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'challenge_id', last_two_days_challenges.challenge_id,
            'players', challenge_players.players,
            'winner', JSON_BUILD_OBJECT(
                'name', challenge_winners.winner,
                'time', challenge_winners.winner_time
            ),
            'answer', last_two_days_challenges.answer,
            'time', my_history.time
        )
    ) as history
from
    __dbt__cte__my_history as my_history
natural inner join
    __dbt__cte__challenge_winners as challenge_winners
natural inner join
    __dbt__cte__challenge_players as challenge_players
natural inner join
    __dbt__cte__last_two_days_challenges as last_two_days_challenges
),  __dbt__cte__scorable_submissions as (
SELECT
    challenge_id,
    "name",
    "time"
FROM
    __dbt__cte__last_two_days_submissions
WHERE
    player_count > 1
),  __dbt__cte__loser_points as (
SELECT
    last_two_days_challenges.is_today,
    scorable_submissions.name,
    COUNT(*) AS loser_points
FROM
    __dbt__cte__challenge_players
NATURAL INNER JOIN
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
NATURAL INNER JOIN
    __dbt__cte__scorable_submissions AS scorable_submissions
GROUP BY
    1, 2
),  __dbt__cte__winner_points as (
SELECT
    last_two_days_challenges.is_today,
    challenge_winners.name,
    sum(challenge_players.player_count) AS winner_points,
    count(*) AS num_wins
FROM
    (
        SELECT
            challenge_id,
            winner AS "name"
        FROM __dbt__cte__challenge_winners
    ) AS challenge_winners
NATURAL INNER JOIN
    __dbt__cte__challenge_players AS challenge_players
NATURAL INNER JOIN
    __dbt__cte__last_two_days_challenges AS last_two_days_challenges
NATURAL INNER JOIN
    __dbt__cte__scorable_submissions
GROUP BY
    1, 2
),  __dbt__cte__total_points as (
SELECT
    loser_points.is_today,
    loser_points.name,
    
    loser_points.loser_points
    - COALESCE(winner_points.num_wins, 0) AS num_losses,
    
    COALESCE(winner_points.winner_points, 0)
     AS winner_points,
    
    COALESCE(winner_points.winner_points, 0)
     - loser_points.loser_points
    AS total_points,
    COALESCE(winner_points.num_wins, 0) AS num_wins
FROM
    __dbt__cte__loser_points AS loser_points
NATURAL LEFT JOIN
    __dbt__cte__winner_points AS winner_points
),  __dbt__cte__leaderboard_json as (
SELECT
    is_today,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'name', name,
            'num_wins', num_wins,
            'num_losses', num_losses,
            'total_points', total_points
        )
        ORDER BY
            total_points DESC,
            name ASC
    ) AS leaderboard
FROM
    __dbt__cte__total_points
GROUP BY
    is_today
),  __dbt__cte__today_leaderboard as (
SELECT COALESCE((
    SELECT leaderboard
    FROM
        __dbt__cte__leaderboard_json
    WHERE
        is_today
), '[]') AS today_leaderboard
),  __dbt__cte__yesterday_leaderboard as (
SELECT COALESCE((
    SELECT leaderboard
    FROM
        __dbt__cte__leaderboard_json
    WHERE
        NOT is_today
), '[]') AS yesterday_leaderboard
),  __dbt__cte__pending_challenges as (
WITH
today_challenges AS (
    SELECT
        s.challenge_id,
        s.name
    FROM __dbt__cte__last_two_days_challenges AS c
    NATURAL INNER JOIN __dbt__cte__last_two_days_submissions AS s
    WHERE c.is_today
),

challenge_ids AS (
    SELECT challenge_id FROM today_challenges
    EXCEPT
    SELECT challenge_id FROM today_challenges WHERE name = $name
)

SELECT COUNT(*) AS pending_challenges FROM challenge_ids
)-- challenges_json.sql
SELECT
    today_leaderboard.today_leaderboard AS today_leaderboard,
    yesterday_leaderboard.yesterday_leaderboard AS yesterday_leaderboard,
    pending_challenges.pending_challenges AS pending_challenges,
    COALESCE(my_history_json.history, '[]') AS history
FROM
    __dbt__cte__my_history_json AS my_history_json,
    __dbt__cte__today_leaderboard AS today_leaderboard,
    __dbt__cte__yesterday_leaderboard AS yesterday_leaderboard,
    __dbt__cte__pending_challenges AS pending_challenges