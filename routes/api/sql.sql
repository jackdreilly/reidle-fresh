with MYSUBMISSIONS as (
    select
        TIME,
        PENALTY,
        SCORE,
        "rank"
    from SUBMISSIONS where NAME = 'jack'
),

TOTAL_SUBMISSIONS as (
    select count(*) as TOTAL from MYSUBMISSIONS
),

BY_SCORE as (
    select
        SCORE,
        count(*) as SCORE_COUNT
    from MYSUBMISSIONS group by 1
),

BY_TIME as (
    select
        width_bucket(TIME, 0, 300, 20) as BUCKET,
        count(*) as C
    from MYSUBMISSIONS group by 1
),

BY_TIME_JSON as (
    select json_agg(json_build_object('bucket', BUCKET, 'count', C)) as BY_TIME
    from BY_TIME
),

BY_PENALTY as (
    select
        PENALTY,
        count(*) as PENALTY_COUNT
    from MYSUBMISSIONS group by 1
),

BY_PENALTY_JSON as (
    select json_agg(
            json_build_object('bucket', PENALTY, 'count', PENALTY_COUNT)
        ) as BY_PENALTY
    from BY_PENALTY
),

BY_SCORE_JSON as (
    select json_agg(
            json_build_object('bucket', SCORE, 'count', SCORE_COUNT)
        ) as BY_SCORE
    from BY_SCORE
)

select json_build_object(
        'total', TOTAL_SUBMISSIONS.TOTAL,
        'score', BY_SCORE_JSON.BY_SCORE,
        'penalty', BY_PENALTY_JSON.BY_PENALTY,
        'time', BY_TIME_JSON.BY_TIME
)
from
    BY_SCORE_JSON
full outer join
    BY_PENALTY_JSON
full outer join
    BY_TIME_JSON
full outer join
    TOTAL_SUBMISSIONS
