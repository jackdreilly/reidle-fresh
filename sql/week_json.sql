with __dbt__cte__week_table as (
with
start_of_week as (
    select
        date_trunc(
            'week', $week::DATE
        )::date as start_of_week
),

end_of_week as (
    select (start_of_week + interval '6 days')::date as end_of_week
    from start_of_week
),

is_new as (
    select
        start_of_week >= date_trunc('week', current_date)::date as value
    from start_of_week
),

subs as (
    select
        submissions.day,
        submissions.name,
        submissions.time,
        submissions.submission_id
    from
        "postgres"."public"."submissions"
        as submissions, start_of_week, end_of_week
    where
        submissions.challenge_id is null
        and submissions.day
        between start_of_week.start_of_week and end_of_week.end_of_week
),

names as (select distinct name from subs),

days as (select distinct day from subs),

name_days as (
    select
        names.name,
        days.day
    from names cross join days
),

penalties as (
    select
        day,
        least(300, max(time) + 120) as penalty_time
    from subs group by day
),

full_subs as (
    select
        name_days.name,
        name_days.day,
        subs.submission_id,
        subs.time is not null as played,
        coalesce(subs.time, penalties.penalty_time) as round_time
    from
        name_days
    natural full outer join
        penalties
    natural full outer join
        subs
),

ranked as (
    select
        name,
        day,
        round_time,
        submission_id,
        played,
        is_new.value as is_new,
        case
            when played
                then
                    row_number()
                        over (
                            partition by day
                            order by played desc, round_time asc
                        )
        end as day_rank
    from full_subs
    inner join is_new on true
)

select
    name,
    day,
    round_time,
    submission_id,
    played,
    is_new,
    case
        when played then least(day_rank, 9)
        else 10
    end as score,
    case
        when not played then 0
        when day_rank = 1 then 4
        when day_rank = 2 then 2
        when day_rank = 3 then 1
        else greatest(0, 1.1 - 0.1 * day_rank)
    end as points
from
    ranked
)select
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
    __dbt__cte__week_table
group by name
order by
    case when bool_or(is_new) then sum(points) end desc nulls last,
    case when not bool_or(is_new) then exp(sum(ln(score))) end asc nulls last,
    sum(round_time) asc
