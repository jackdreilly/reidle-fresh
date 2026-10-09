-- Additive (post-cutover) weekly points x10 so they are whole numbers: 1st 40, 2nd 20, 3rd 10,
-- rank r>=4 max(0, 11-r), no-show 0. Legacy (frozen) weeks are untouched. Additive weeks are
-- computed live, so this rescores the current week immediately.
create or replace function week_scores_calc(p_week date, p_additive boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  with params as (
    select week_start(p_week) as s, p_additive as is_new),
  subs as (
    select sb.day, sb.name, sb."time", sb.submission_id
    from submissions sb, params
    where sb.challenge_id is null and sb.day between params.s and params.s + 6),
  names as (select distinct name from subs),
  days as (select distinct day from subs),
  pen as (select day, least(300, max("time") + 120) as pt from subs group by day),
  grid as (
    select n.name, d.day, s.submission_id, s."time" is not null as played,
           coalesce(s."time", pen.pt) as round_time
    from names n cross join days d
    join pen on pen.day = d.day
    left join subs s on s.name = n.name and s.day = d.day),
  ranked as (
    select *, case when played then row_number() over (
      partition by day order by played desc, round_time, name) end as day_rank
    from grid),
  scored as (
    select name, day, round_time, submission_id, is_new,
      case when played then least(day_rank, 9) else 10 end as score,
      case when not played then 0 when day_rank = 1 then 40 when day_rank = 2 then 20
           when day_rank = 3 then 10 else greatest(0, 11 - day_rank) end as points
    from ranked, params),
  agg as (
    select name,
      jsonb_agg(jsonb_build_object(
        'day', day, 'time', round_time,
        'score', case when is_new then points else score end,
        'submission_id', submission_id) order by day) as days,
      round(sum(round_time))::int as total_time,
      case when bool_or(is_new) then sum(points)::numeric
           else round(exp(sum(ln(score))))::numeric end as total_score,
      bool_or(is_new) as is_new,
      sum(points) as pts, exp(sum(ln(score))) as prod
    from scored group by name)
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', name,
      'results', jsonb_build_object('days', days, 'totals',
        jsonb_build_object('time', total_time, 'score', total_score)))
    order by case when is_new then pts end desc nulls last,
             case when not is_new then prod end nulls last,
             total_time, name), '[]')
  from agg
$$;

revoke execute on function week_scores_calc(date, boolean) from public, anon, authenticated;
