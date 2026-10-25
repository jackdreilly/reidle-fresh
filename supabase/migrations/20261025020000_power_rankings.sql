-- Past tab rethink (Jack, 2026-10-25: "1/2/3 finishes for the past in a rev chronological table ... and some sort of
-- power rankings summary and movement like in tennis atp"). past_page now returns every week's podium and an
-- ATP-style ranking: points for each weekly finish over a rolling 8-week window, with movement since last week.
-- p_month is kept (it is in the RPC allowlist) but no longer used.

-- Every week's finishing order for a league, oldest first, including the live week. A completed week's recorded
-- winner (winners table) goes first even if the league's scoring was changed since.
create or replace function league_week_places(p_league bigint)
returns table (week date, name text, place int, players int)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  today date := league_day(p_league);
  w date; r jsonb; champ text;
begin
  for w in select distinct week_start(s.day) from submissions s
           where s.league_id = p_league and s.challenge_id is null and s.day <= today order by 1 loop
    r := week_scores(p_league, w);
    champ := case when w < week_start(today) then
      (select x.name from winners x where x.league_id = p_league and week_start(x.week) = w order by x.week limit 1) end;
    return query
      select w, t.e ->> 'name',
             (row_number() over (order by (t.e ->> 'name') = champ desc nulls last, t.o))::int,
             jsonb_array_length(r)
      from jsonb_array_elements(r) with ordinality t(e, o);
  end loop;
end $$;

-- Points for a weekly finish. Showing up is worth something.
create or replace function finish_points(p_place int) returns int
language sql immutable set search_path = public as $$
  select case p_place when 1 then 10 when 2 then 6 when 3 then 4 when 4 then 3 when 5 then 2 else 1 end
$$;

create or replace function past_page(p_month date) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := require_me();
  l bigint := require_league();
  cur_week date := week_start(league_day(l));
  win int := 8;           -- rolling window, in weeks
  res jsonb;
begin
  perform last_week_winner(l);
  with p as materialized (select * from league_week_places(l)),
  done as (select week, name, place, finish_points(place) as points from p where week < cur_week),
  span as (select min(week) as first, max(week) as last from done),
  -- one ranking per completed week, from the window ending that week
  dates as (select g::date as r from span, generate_series(span.first, span.last, interval '7 days') g),
  standings as (
    select d.r, x.name, sum(x.points)::int as pts,
           count(*) filter (where x.place = 1) as p1, count(*) filter (where x.place = 2) as p2,
           count(*) filter (where x.place = 3) as p3
    from dates d join done x on x.week between d.r - 7 * (win - 1) and d.r
    group by d.r, x.name),
  ranked as (
    select r, name, pts, (rank() over (partition by r order by pts desc, p1 desc, p2 desc, p3 desc))::int as rk
    from standings),
  career as (
    select name, min(rk) as best, count(*) filter (where rk = 1)::int as at1, min(r) as since from ranked group by name),
  board as (
    select k.name, k.rk, k.pts, prev.rk as prev, c.best, c.at1, c.since = k.r as debut,
      (select jsonb_agg(f.place order by g) from span s2,
         generate_series(s2.last - 7 * (win - 1), s2.last, interval '7 days') g
         left join done f on f.week = g::date and f.name = k.name) as form,
      coalesce((select f.points from done f, span s3
                where f.name = k.name and f.week = s3.last - 7 * (win - 1)), 0) as dropping
    from ranked k
    join span on k.r = span.last
    left join ranked prev on prev.r = span.last - 7 and prev.name = k.name
    join career c on c.name = k.name)
  select jsonb_build_object(
    'window', win,
    'as_of', (select last::text from span),
    'rankings', coalesce((select jsonb_agg(jsonb_build_object(
        'name', name, 'rank', rk, 'prev', prev, 'points', pts, 'form', form,
        'best', best, 'weeks_at_1', at1, 'drop', dropping, 'new', debut) order by rk, name) from board), '[]'),
    'weeks_at_1', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'weeks', at1) order by at1 desc, best, name)
      from (select * from career where at1 > 0 order by at1 desc, best, name limit 5) c), '[]'),
    'weeks', coalesce((select jsonb_agg(jsonb_build_object(
        'week', week::text, 'live', week = cur_week, 'players', players, 'podium', podium) order by week desc)
      from (select week, max(players) as players,
                   jsonb_agg(name order by place) filter (where place <= 3) as podium
            from p group by week) w), '[]'))
  into res;

  return res || jsonb_build_object(
    'hall', (
      with titles as (
        select distinct on (week_start(week)) week_start(week) as week, name
        from winners where league_id = l and week_start(week) < cur_week order by week_start(week), week),
      runs as (
        select name, week, week - (row_number() over (partition by name order by week) * 7)::int as grp
        from titles),
      streaks as (
        select name, grp, count(*)::int as len, max(week) as last from runs group by name, grp),
      latest as (select max(week) as w from titles)
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'wins', wins, 'last', last::text, 'best_streak', best,
          'current_streak', coalesce(cur, 0))
        order by wins desc, last desc), '[]')
      from (
        select s.name, sum(s.len)::int as wins, max(s.last) as last, max(s.len) as best,
          max(s.len) filter (where s.last = (select w from latest)) as cur
        from streaks s group by s.name) h));
end $$;

revoke execute on function league_week_places(bigint) from public, anon, authenticated;
revoke execute on function finish_points(int) from public, anon, authenticated;
