select
    name,
    json_build_object(
        'days', json_agg(
            json_build_object(
                'day', day,
                'time', round_time,
                'score', score,
                'submission_id', submission_id
            )
        ),
        'totals', json_build_object(
            'time', round(sum(round_time)),
            'score', round(exp(sum(ln(score))))
        )
    ) as results
from
    {{ ref("week_table") }}
group by name
order by round(exp(sum(ln(score)))) asc, sum(round_time) asc
