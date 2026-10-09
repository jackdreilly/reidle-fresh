-- Scoring cutover. Weeks starting on/after 2026-10-05 (the Monday that just passed) use ADDITIVE
-- points, forever. Earlier weeks keep the LEGACY product score and are frozen: computed once from the
-- (historical, immutable) submissions, then served from week_snapshots, so they can never change.

create table week_snapshots (
  week date primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table week_snapshots enable row level security;
revoke all on week_snapshots from anon, authenticated;

create function scoring_cutover() returns date
language sql immutable set search_path = public as $$ select date '2026-10-05' $$;

-- the scoring maths, with the scheme chosen explicitly (it used to be inferred from "today")
create function week_scores_calc(p_week date, p_additive boolean) returns jsonb
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
      case when not played then 0 when day_rank = 1 then 4 when day_rank = 2 then 2
           when day_rank = 3 then 1 else greatest(0, 1.1 - 0.1 * day_rank) end as points
    from ranked, params),
  agg as (
    select name,
      jsonb_agg(jsonb_build_object(
        'day', day, 'time', round_time,
        'score', case when is_new then round(points::numeric, 1) else score end,
        'submission_id', submission_id) order by day) as days,
      round(sum(round_time))::int as total_time,
      case when bool_or(is_new) then round(sum(points)::numeric, 1)
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

create or replace function week_scores(p_week date) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare w date := week_start(p_week); r jsonb;
begin
  if w >= scoring_cutover() then
    return week_scores_calc(w, true);
  end if;
  select results into r from week_snapshots where week = w;
  if r is null then
    r := week_scores_calc(w, false);
    if r <> '[]'::jsonb then
      insert into week_snapshots (week, results) values (w, r) on conflict do nothing;
    end if;
  end if;
  return r;
end $$;

create or replace function weekly_page(p_week date) returns jsonb
language sql volatile security definer set search_path = public as $$
  select jsonb_build_object('players', week_scores(p_week),
                            'additive', week_start(p_week) >= scoring_cutover())
$$;

-- new functions are executable by PUBLIC until revoked
revoke execute on function scoring_cutover(), week_scores_calc(date, boolean)
  from public, anon, authenticated;
