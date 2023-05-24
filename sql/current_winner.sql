with
 __dbt__cte__week_table as (
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
)

select
    name,
    day,
    round_time,
    submission_id,
    case
        when
            played
            then
                least(
                    row_number()
                        over (
                            partition by day
                            order by played desc, round_time asc
                        ),
                    9
                )
        else 10
    end as score
from
    full_subs
),  __dbt__cte__week_json as (
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
    __dbt__cte__week_table
group by name
order by round(exp(sum(ln(score)))) asc, sum(round_time) asc
),existing as (
    select name
    from
        "postgres"."public"."winners"
    where
        
date_trunc('week', week) = date_trunc('week', current_date - interval '1 week')

),

computed as (
    select
        name,
        date_trunc('week', $week::DATE)::DATE as "week"
    from __dbt__cte__week_json where not exists (select 1 from existing)
    limit 1
),

inserted as ( -- noqa: ST03
    insert into "postgres"."public"."winners" (name, week)
    select
        name,
        "week"
    from computed
)

select
    coalesce(
        
        existing.name,
        
        
        computed.name
        
    ) as name
from
    existing

FULL OUTER JOIN
    computed
ON
    TRUE

