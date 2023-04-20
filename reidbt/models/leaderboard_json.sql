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
    {{ ref('total_points') }}
GROUP BY
    is_today
