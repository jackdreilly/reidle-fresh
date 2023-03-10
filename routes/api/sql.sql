WITH last_day AS (
    SELECT
        CURRENT_DATE - EXTRACT(
            DOW FROM CURRENT_DATE
        )::INTEGER AS last_day,
        CURRENT_DATE - EXTRACT(
            DOW FROM CURRENT_DATE
        )::INTEGER - 6::INTEGER AS start_day

),

last_week AS (
    SELECT
        name,
        time,
        score,
        day
    FROM
        submissions, last_day
    WHERE
        day BETWEEN start_day AND last_day
),

all_days AS (
    SELECT DISTINCT day
    FROM last_week
    ORDER BY 1
),

all_names AS (
    SELECT DISTINCT name FROM last_week
),

crossed AS (
    SELECT * FROM all_days, all_names
),

expanded AS (
    SELECT
        *,
        COALESCE(score, 5) AS score_filled,
        COALESCE(time, 300) AS time_filled
    FROM
        last_week NATURAL FULL OUTER JOIN crossed
),

winner AS (
    SELECT name
    FROM
        expanded
    GROUP BY
        1
    ORDER BY
        EXP(SUM(LN(score_filled))),
        SUM(time_filled)
    LIMIT
        1
)

INSERT INTO
winners(
    name,
    week
)
SELECT
    name,
    start_day
FROM
    winner,
    last_day
