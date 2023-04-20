SELECT
    loser_points.is_today,
    loser_points.name,
    {% set winner_points %}
    COALESCE(winner_points.winner_points, 0)
    {% endset %}
    loser_points.loser_points
    - COALESCE(winner_points.num_wins, 0) AS num_losses,
    {{ winner_points }} AS winner_points,
    {{ winner_points }} - loser_points.loser_points
    AS total_points,
    COALESCE(winner_points.num_wins, 0) AS num_wins
FROM
    {{ ref('loser_points') }} AS loser_points
NATURAL LEFT JOIN
    {{ ref('winner_points') }} AS winner_points
