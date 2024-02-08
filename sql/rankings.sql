with matches as (
  select name, day, ROW_NUMBER() over (partition by day order by time desc) AS score
  from submissions where day is not null and challenge_id is null
),
days as (
  select distinct LEAST(CURRENT_DATE, day + 30) as end_day from matches
),
ranges as (
  select end_day, end_day + o as day
  FROM days, generate_series(-30,0) as o
  WHERE (end_day - CURRENT_DATE) % 3 = 0
),
recently_played as (
    select name from matches
    where day > CURRENT_DATE - 30
    GROUP BY 1
    HAVING COUNT(*) > 14
),
name_days as (
  select distinct name, day + o as end_day
  from 
    recently_played
  natural inner join 
    matches,
    generate_series(0,10) o
),
scores as (
  select name, end_day as day, sum(score * (32 - (end_day - day))) as score
  from name_days natural inner join ranges natural inner join matches
  group by 1,2
),
ranks as (
select name,day, ROW_NUMBER() over (partition by day order by score desc) as rank
from scores order by day desc, rank
  )
  select name, array_agg(day order by day) as day, array_agg(rank::INT order by day) as rank
  from ranks group by 1