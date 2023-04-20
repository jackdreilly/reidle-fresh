SELECT
    is_today,
    {% set sum_points %}
    SUM(total_points)
    {% endset %}
    {{ sum_points }} AS sum_points
FROM
    {{ ref("total_points") }}
GROUP BY
    1
HAVING
    {{ sum_points }} != 0
