-- Past tab: one round trip for the archive of a month plus the all-time hall of fame.
--   days:  every played day of the month (newest first) with its starting word, answer, player count,
--          winner and the caller's own finish. Today's answer stays hidden until you've played.
--   weeks: weekly winner of each week touching the month (memoised in `winners`, computed if missing);
--          the current week reports its leader so far instead.
--   hall:  weekly titles per player, with their best and current run of consecutive wins.
create function past_page(p_month date) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := require_me();
  m date := date_trunc('month', coalesce(p_month, current_date))::date;
  cur_week date := week_start(current_date);
  first_day date;
  weeks jsonb;
begin
  perform last_week_winner();
  select min(day) into first_day from submissions where challenge_id is null;
  m := least(greatest(m, date_trunc('month', first_day)::date), date_trunc('month', current_date)::date);
  m := coalesce(m, date_trunc('month', current_date)::date);

  select coalesce(jsonb_agg(jsonb_build_object(
      'week', w::text,
      'live', w = cur_week,
      'winner', case when w = cur_week then null
                     else coalesce((select name from winners where week_start(week) = w order by week limit 1),
                                   week_scores(w) -> 0 ->> 'name') end,
      'leader', case when w = cur_week then week_scores(w) -> 0 ->> 'name' end)
    order by w desc), '[]')
  into weeks
  from generate_series(week_start(m), least(m + interval '1 month' - interval '1 day', current_date)::date,
                       interval '7 days') g, lateral (select g::date as w) x
  where exists (select 1 from submissions s
                where s.challenge_id is null and s.day between w and w + 6);

  return jsonb_build_object(
    'month', m::text,
    'first_month', coalesce(date_trunc('month', first_day)::date, m)::text,
    'weeks', weeks,
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'day', d.day::text,
          'starter', dw.word,
          'answer', case when d.day = current_date and not played_today(n) then null
                         else coalesce(dw.answer, d.word) end,
          'players', d.players,
          'winner', d.winner,
          'winner_time', d.winner_time,
          'my_rank', d.my_rank,
          'my_time', d.my_time)
        order by d.day desc), '[]')
      from (
        select s.day, count(*)::int as players,
          (array_agg(s.name order by s."rank", s."time"))[1] as winner,
          min(s."time") as winner_time,
          min(s."rank") filter (where s.name = n) as my_rank,
          min(s."time") filter (where s.name = n) as my_time,
          min(s.word) as word
        from submissions s
        where s.challenge_id is null and s.day >= m and s.day < m + interval '1 month'
          and s.day <= current_date
        group by s.day) d
      left join daily_words dw on dw.day = d.day),
    'hall', (
      -- legacy rows may not sit on a Monday: normalise every title to its week
      with titles as (
        select distinct on (week_start(week)) week_start(week) as week, name
        from winners where week_start(week) < cur_week order by week_start(week), week),
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

revoke execute on function past_page(date) from public, anon;
grant execute on function past_page(date) to authenticated;
