-- Reidog: power rankings as a lookup (Jack, 2026-10-29: "check chat logs to see if there's some extra tooling or
-- intelligence you can provide reidog"). Asked "who's the best player in the league", it summed one week's standings
-- for the wrong league. This is the Past tab's power ranking (rolling 8 finished weeks, 10/6/4/3/2/1 points by weekly
-- place, the recorded weekly winner first), computed read-only so it works inside ask_query: past_page itself records
-- last week's winner as it goes, which a read-only transaction refuses.
create function reidog.power_rankings(p_league bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l bigint := coalesce(p_league, (select league_id from reidog.who()));
  cur date;
begin
  if l is null or l not in (select reidog.my_leagues()) then return null; end if;
  cur := week_start(league_day(l));
  return (
    with weeks as (select g::date as w from generate_series(cur - 56, cur - 7, interval '7 days') g),
    places as (
      select wk.w, t.e ->> 'name' as name,
             row_number() over (partition by wk.w order by (t.e ->> 'name') = (
               select x.name from winners x where x.league_id = l and week_start(x.week) = wk.w order by x.week limit 1
             ) desc nulls last, t.o)::int as place
      from weeks wk, jsonb_array_elements(coalesce(reidog.week_standings(wk.w, l), '[]')) with ordinality t(e, o)),
    totals as (
      select name, sum(finish_points(place))::int as points, count(*) filter (where place = 1)::int as week_wins,
             count(*)::int as weeks_played, jsonb_agg(jsonb_build_object('week', w::text, 'place', place) order by w) as finishes
      from places group by name)
    select jsonb_build_object(
      'league_id', l, 'from_week', (cur - 56)::text, 'to_week', (cur - 7)::text,
      'rankings', coalesce(jsonb_agg(jsonb_build_object(
          'rank', rk, 'name', name, 'points', points, 'week_wins', week_wins, 'weeks_played', weeks_played,
          'finishes', finishes) order by rk, name) filter (where rk <= 25), '[]'))
    from (select *, (rank() over (order by points desc, week_wins desc))::int as rk from totals) r);
end $$;

revoke all on function reidog.power_rankings(bigint) from public;
grant execute on function reidog.power_rankings(bigint) to reidog_reader;
