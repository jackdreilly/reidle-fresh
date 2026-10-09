select
    name,
    json_build_object(
        'days', json_agg(
            json_build_object(
                'day', day,
                'time', round_time,
                'score', case when is_new then points else score end,
                'submission_id', submission_id
            )
            order by day
        ),
        'totals', json_build_object(
            'time', round(sum(round_time)),
            'score',
            case
                when bool_or(is_new) then round(sum(points), 1)
                else round(exp(sum(ln(score))))
            end
        )
    ) as results
from
    {{ ref("week_table") }}
group by name
order by
    case when bool_or(is_new) then sum(points) end desc nulls last,
    case when not bool_or(is_new) then exp(sum(ln(score))) end asc nulls last,
    sum(round_time) asc
