with MYSUBMISSIONS as (
    select
        TIME,
        PENALTY,
        RANK,
        DAY
    from {{ reidle('submissions') }}
    where NAME = {{ me() }} and CHALLENGE_ID is null
),

TOTAL_SUBMISSIONS as (
    select count(*) as TOTAL from MYSUBMISSIONS
),

BY_SCORE as (
    select
        RANK,
        count(*) as SCORE_COUNT
    from MYSUBMISSIONS group by 1
),

BY_TIME as (
    select
        width_bucket(
            TIME,
            array[
                0,
                5,
                10,
                15,
                20,
                30,
                40,
                50,
                60,
                80,
                100,
                120,
                180,
                240,
                300,
                360,
                420,
                480,
                540,
                600,
                1200
            ]
        ) as BUCKET,
        count(*) as C
    from MYSUBMISSIONS group by 1
),

BY_TIME_JSON as (
    select
        json_agg(
            json_build_object(
                'bucket',
                (
                    array[
                        0,
                        5,
                        10,
                        15,
                        20,
                        30,
                        40,
                        50,
                        60,
                        80,
                        100,
                        120,
                        180,
                        240,
                        300,
                        360,
                        420,
                        480,
                        540,
                        600,
                        1200
                    ]
                )[BUCKET],
                'count',
                C
            )
        ) as BY_TIME
    from BY_TIME
    where
        (
            array[
                0,
                5,
                10,
                15,
                20,
                30,
                40,
                50,
                60,
                80,
                100,
                120,
                180,
                240,
                300,
                360,
                420,
                480,
                540,
                600,
                1200
            ]
        )[BUCKET] is not null
),

BY_PENALTY as (
    select
        PENALTY,
        count(*) as PENALTY_COUNT
    from MYSUBMISSIONS group by 1
),

BY_PENALTY_JSON as (
    select
        json_agg(
            json_build_object('bucket', PENALTY, 'count', PENALTY_COUNT)
        ) as BY_PENALTY
    from BY_PENALTY
),

BY_SCORE_JSON as (
    select
        json_agg(
            json_build_object('bucket', RANK, 'count', SCORE_COUNT)
        ) as BY_SCORE
    from BY_SCORE
),

BY_WEEK as (
    select
        date_trunc('week', DAY) as "week",
        avg(TIME) as "time",
        avg(PENALTY) as PENALTY,
        avg(RANK) as RANK
    from
        MYSUBMISSIONS
    group by
        1
    order by
        1
),

BY_WEEK_JSON as (
    select
        json_agg(
            json_build_object(
                'week', "week", 'time', "time", 'rank', RANK, 'penalty', PENALTY
            )
        )
        as BY_WEEK
    from
        BY_WEEK
)

select
    TOTAL_SUBMISSIONS.TOTAL as "total",
    {{ or_array('BY_SCORE_JSON.BY_SCORE') }} as "rank",
    {{ or_array('BY_PENALTY_JSON.BY_PENALTY') }} as "penalty",
    {{ or_array('BY_TIME_JSON.BY_TIME') }} as "time",
    {{ or_array('BY_WEEK_JSON.BY_WEEK') }} as "week"
from
    BY_SCORE_JSON,
    BY_PENALTY_JSON,
    BY_TIME_JSON,
    TOTAL_SUBMISSIONS,
    BY_WEEK_JSON
limit 1
