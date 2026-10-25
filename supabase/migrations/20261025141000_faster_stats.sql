-- Faster player_stats() and rankings(), same results (checked against prod data).
-- player_stats: the time histogram's bin width was re-derived for every row and bin (the planner inlined the
-- one-row binw/bins CTEs into a nested loop: ~16k subquery runs), and the 4-week trend joined every week to every
-- game. Prod, a ~1400-game player: ~420ms -> ~75ms.
-- rankings: ~430ms -> ~95ms.

create or replace function player_stats(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (select lg() as l, lg_today() as today),
  reveal as (select played_today(me()) as ok),
  mine as (
    select s.submission_id, s.day, s."time" as t, s.penalty, s.word, btrim(s.paste, E'\n ') as paste
    from submissions s, ctx where s.name = p_name and s.league_id = ctx.l and s.challenge_id is null),
  field as (
    select f.day, f.name, f."time"
    from submissions f join mine m using (day), ctx where f.league_id = ctx.l and f.challenge_id is null),
  ranks as (
    select day, name, rank() over (partition by day order by "time")::int as place,
           (count(*) over (partition by day))::int as n
    from field),
  g as (
    select m.submission_id, m.day, m.t, m.penalty, r.place, r.n,
      m.day = (select today from ctx) and not (select ok from reveal) as hidden,
      case when m.day = (select today from ctx) and not (select ok from reveal) then null else m.word end as word,
      case when m.day = (select today from ctx) and not (select ok from reveal) then null
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
  binw as materialized (
    select p02, p98, coalesce((select w from unnest(array[1,2,3,5,10,15,20,30,60,120]) w
                               where w >= (p98 - p02) / 14 order by w limit 1), 300) as bw
    from spread where p02 is not null),
  bins as materialized (
    select bw, floor(p02 / bw) * bw as lo,
           greatest(1, (ceil(p98 / bw) * bw - floor(p02 / bw) * bw) / bw)::int as nb
    from binw),
  mywins as (select w.week from winners w, ctx where w.league_id = ctx.l and w.name = p_name)
  select jsonb_build_object(
    'total', (select count(*) from g),
    'since', (select min(day) from g),
    'last', (select max(day) from g),
    'wins', (select count(*) from g where place = 1),
    'podiums', (select count(*) from g where place <= 3),
    'beat', (select avg(beat) from g),
    'beat_30', (select avg(beat) from g where day > (select today from ctx) - 30),
    'median', (select percentile_cont(0.5) within group (order by t) from g),
    'median_30', (select percentile_cont(0.5) within group (order by t) from g where day > (select today from ctx) - 30),
    'median_prev_30', (select percentile_cont(0.5) within group (order by t) from g
                       where day > (select today from ctx) - 60 and day <= (select today from ctx) - 30),
    'avg_penalty', (select avg(penalty) from g),
    'clean', (select avg((penalty = 0)::int) from g),
    'avg_guesses', (select avg(guesses) from g),
    'weeks_won', (select count(*) from mywins),
    'last_week_won', (select max(week) from mywins),
    'streak', jsonb_build_object(
      'current', coalesce((select len from runs where e >= (select today from ctx) - 1), 0),
      'longest', (select jsonb_build_object('len', len, 'from', s, 'to', e) from runs order by len desc, e desc limit 1),
      'current_wins', coalesce((select len from winruns where e = (select max(day) from g)), 0),
      'longest_wins', (select jsonb_build_object('len', len, 'from', s, 'to', e) from winruns order by len desc, e desc limit 1)),
    'fastest', (select jsonb_build_object('time', t, 'day', day, 'submission_id', submission_id, 'word', word,
                                          'place', place, 'n', n)
                from g order by t, day limit 1),
    'calendar', coalesce((select jsonb_agg(jsonb_build_array(day, place, n, submission_id) order by day)
                          from g where day > (select today from ctx) - 371), '[]'),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('week', wk, 'games', c, 'median', med, 'p25', lo,
                                                           'p75', hi, 'beat', b) order by wk)
                       from (select w.wk::date as wk, count(*) as c,
                                    percentile_cont(0.5) within group (order by g.t) as med,
                                    percentile_cont(0.25) within group (order by g.t) as lo,
                                    percentile_cont(0.75) within group (order by g.t) as hi,
                                    avg(g.beat) as b
                             -- each game counts toward the 4 week-ends (Sundays) from its day to 27 days later
                             from g cross join generate_series(0, 21, 7) o,
                                  lateral (select (g.day + (7 - extract(isodow from g.day)::int) % 7 + o)::timestamp as wk) w
                             where w.wk::date <= (select today from ctx) + 6
                             group by 1 having count(*) >= 4) x), '[]'),
    'places', coalesce((select jsonb_agg(jsonb_build_object('place', p, 'count', c) order by p)
                        from (select least(place, 6) as p, count(*) as c from g group by 1) x), '[]'),
    'guesses', coalesce((select jsonb_agg(jsonb_build_object('guesses', k, 'count', c) order by k)
                         from (select least(guesses, 7) as k, count(*) as c from g
                               where guesses is not null group by 1) x), '[]'),
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
                                     count(*) filter (where m.t < f."time" and m.day > (select today from ctx) - 90) as rw,
                                     count(*) filter (where m.day > (select today from ctx) - 90) as rg,
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

create or replace function rankings() returns jsonb
language sql stable security definer set search_path = public as $$
  -- Each player's score on a day: their finishing scores (last place 1, then up) over the 31 days ending there,
  -- weighted 32 for that day down to 2 for 30 days back. Running sums over one row per player per day replace
  -- joining every game to every window (same numbers, a fraction of the work).
  with ctx as (select lg() as l, lg_today() as today),
  matches as (
    select name, day, row_number() over (partition by day order by "time" desc) as score
    from submissions, ctx where league_id = ctx.l and challenge_id is null),
  recently_played as (
    select name from matches where day > (select today from ctx) - 30
    group by 1 having count(*) > 8),
  theirs as (select m.* from matches m join recently_played using (name)),
  sums as (
    select x.name, x.day,
           count(t.score) over (partition by x.name order by x.day rows between 10 preceding and current row) as recent,
           sum(t.score) over w as s0, sum(t.score * (x.day - date '2000-01-01')) over w as s1
    from (select rp.name, d::date as day from recently_played rp,
            generate_series((select min(day) from theirs), (select today from ctx), interval '1 day') d) x
    left join theirs t on t.name = x.name and t.day = x.day
    window w as (partition by x.name order by x.day rows between 30 preceding and current row)),
  -- ranked days: every third day back from today, up to 30 days after a game anyone played; a player is ranked
  -- on a day when they played in the 10 days before it
  scores as (
    select s.name, s.day, 32 * s.s0 - ((s.day - date '2000-01-01') * s.s0 - s.s1) as score
    from sums s
    where s.recent > 0 and (s.day - (select today from ctx)) % 3 = 0
      and (s.day = (select today from ctx) or exists (select 1 from matches m where m.day = s.day - 30))),
  ranks as (
    select name, day, (row_number() over (partition by day order by score desc))::int as rank
    from scores)
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'day', days, 'rank', rks)
           order by last_rank desc nulls first), '[]')
  from (
    select r.name, array_agg(r.day order by r.day) as days,
           array_agg(r.rank order by r.day) as rks,
           min(r.rank) filter (where r.day = (select today from ctx)) as last_rank
    from ranks r group by r.name) q
$$;
