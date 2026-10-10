-- Player page v2: one round trip with headline numbers, streaks, a calendar, monthly trend,
-- finish/guess/time distributions, head-to-head records, weekday form and recent games.
-- Places are recomputed from the day's field (not the stored rank) so they always agree with
-- the daily table. Today's word and guess count stay hidden until the viewer has played.
create or replace function player_stats(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  with reveal as (select played_today(me()) as ok),
  mine as (
    select s.submission_id, s.day, s."time" as t, s.penalty, s.word, btrim(s.paste, E'\n ') as paste
    from submissions s where s.name = p_name and s.challenge_id is null),
  field as (
    select f.day, f.name, f."time"
    from submissions f join mine m using (day) where f.challenge_id is null),
  ranks as (
    select day, name, rank() over (partition by day order by "time")::int as place,
           (count(*) over (partition by day))::int as n
    from field),
  g as (
    select m.submission_id, m.day, m.t, m.penalty, r.place, r.n,
      m.day = current_date and not (select ok from reveal) as hidden,
      case when m.day = current_date and not (select ok from reveal) then null else m.word end as word,
      case when m.day = current_date and not (select ok from reveal) then null
           when m.paste = '' then null
           else 1 + length(m.paste) - length(replace(m.paste, E'\n', '')) end as guesses,
      case when r.n > 1 then (r.n - r.place)::float / (r.n - 1) end as beat
    from mine m join ranks r on r.day = m.day and r.name = p_name),
  runs as (
    select min(day) as s, max(day) as e, count(*)::int as len
    from (select day, day - (row_number() over (order by day))::int as grp from g) x group by grp),
  winruns as (
    select min(day) as s, max(day) as e, count(*)::int as len
    from (select day, day - (row_number() over (order by day))::int as grp from g where place = 1) x group by grp),
  spread as (
    select percentile_cont(0.02) within group (order by t) as p02,
           percentile_cont(0.98) within group (order by t) as p98 from g),
  binw as (
    select p02, p98, coalesce((select w from unnest(array[1,2,3,5,10,15,20,30,60,120]) w
                               where w >= (p98 - p02) / 14 order by w limit 1), 300) as bw
    from spread where p02 is not null),
  bins as (
    select bw, floor(p02 / bw) * bw as lo,
           greatest(1, (ceil(p98 / bw) * bw - floor(p02 / bw) * bw) / bw)::int as nb
    from binw)
  select jsonb_build_object(
    'total', (select count(*) from g),
    'since', (select min(day) from g),
    'last', (select max(day) from g),
    'wins', (select count(*) from g where place = 1),
    'podiums', (select count(*) from g where place <= 3),
    'beat', (select avg(beat) from g),
    'beat_30', (select avg(beat) from g where day > current_date - 30),
    'median', (select percentile_cont(0.5) within group (order by t) from g),
    'median_30', (select percentile_cont(0.5) within group (order by t) from g where day > current_date - 30),
    'median_prev_30', (select percentile_cont(0.5) within group (order by t) from g
                       where day > current_date - 60 and day <= current_date - 30),
    'avg_penalty', (select avg(penalty) from g),
    'clean', (select avg((penalty = 0)::int) from g),
    'avg_guesses', (select avg(guesses) from g),
    'weeks_won', (select count(*) from winners where name = p_name),
    'last_week_won', (select max(week) from winners where name = p_name),
    'streak', jsonb_build_object(
      'current', coalesce((select len from runs where e >= current_date - 1), 0),
      'longest', (select jsonb_build_object('len', len, 'from', s, 'to', e) from runs order by len desc, e desc limit 1),
      'current_wins', coalesce((select len from winruns where e = (select max(day) from g)), 0),
      'longest_wins', (select jsonb_build_object('len', len, 'from', s, 'to', e) from winruns order by len desc, e desc limit 1)),
    'fastest', (select jsonb_build_object('time', t, 'day', day, 'submission_id', submission_id, 'word', word,
                                          'place', place, 'n', n)
                from g order by t, day limit 1),
    'calendar', coalesce((select jsonb_agg(jsonb_build_array(day, place, n, submission_id) order by day)
                          from g where day > current_date - 371), '[]'),
    -- Smoothed trend, one point per week: rolling 28-day median time with its middle-half band
    -- (outlier-proof) and the rolling share of the field beaten (cancels out word difficulty).
    'trend', coalesce((select jsonb_agg(jsonb_build_object('week', wk, 'games', c, 'median', med, 'p25', lo,
                                                           'p75', hi, 'beat', b) order by wk)
                       from (select w.wk::date as wk, count(*) as c,
                                    percentile_cont(0.5) within group (order by g.t) as med,
                                    percentile_cont(0.25) within group (order by g.t) as lo,
                                    percentile_cont(0.75) within group (order by g.t) as hi,
                                    avg(g.beat) as b
                             from generate_series(date_trunc('week', (select min(day) from g)) + interval '6 days',
                                                  current_date + 6, interval '7 days') w(wk)
                             join g on g.day > w.wk::date - 28 and g.day <= w.wk::date
                             group by 1 having count(*) >= 4) x), '[]'),
    'places', coalesce((select jsonb_agg(jsonb_build_object('place', p, 'count', c) order by p)
                        from (select least(place, 6) as p, count(*) as c from g group by 1) x), '[]'),
    'guesses', coalesce((select jsonb_agg(jsonb_build_object('guesses', k, 'count', c) order by k)
                         from (select least(guesses, 7) as k, count(*) as c from g
                               where guesses is not null group by 1) x), '[]'),
    -- Even-width solve-time bins over the 2nd..98th percentile; outliers fold into the end bins.
    'times', coalesce((select jsonb_build_object('width', bw, 'from', lo, 'counts', jsonb_agg(c order by k))
                       from (select bw, lo, k, count(t) as c
                             from bins cross join generate_series(0, bins.nb - 1) k
                             left join g on least(greatest(floor((g.t - lo) / bw)::int, 0), nb - 1) = k
                             group by bw, lo, k) x group by bw, lo), 'null'),
    'weekdays', coalesce((select jsonb_agg(jsonb_build_object('dow', d, 'games', c, 'win', w, 'beat', b,
                                                              'median', med) order by d)
                          from (select extract(isodow from day)::int as d, count(*) as c,
                                       avg((place = 1)::int) as w, avg(beat) as b,
                                       percentile_cont(0.5) within group (order by t) as med
                                from g group by 1) x), '[]'),
    'rivals', coalesce((select jsonb_agg(jsonb_build_object('name', opp, 'games', games, 'wins', wins,
                                                            'losses', losses, 'recent_wins', rw, 'recent_games', rg,
                                                            'last', last_day)
                                         order by games desc, opp)
                        from (select f.name as opp, count(*) as games,
                                     count(*) filter (where m.t < f."time") as wins,
                                     count(*) filter (where m.t > f."time") as losses,
                                     count(*) filter (where m.t < f."time" and m.day > current_date - 90) as rw,
                                     count(*) filter (where m.day > current_date - 90) as rg,
                                     max(m.day) as last_day
                              from mine m join field f on f.day = m.day and f.name <> p_name
                              group by 1 having count(*) >= 5
                              order by games desc, 1 limit 8) x), '[]'),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'time', t, 'penalty', penalty,
                                                            'place', place, 'n', n, 'word', word,
                                                            'guesses', guesses,
                                                            'submission_id', case when hidden then null else submission_id end)
                                         order by day desc)
                        from (select * from g order by day desc limit 10) x), '[]'))
$$;
