-- Visits (Jack, 2026-10-24: "see how people are using reidle, how long they stay"): the telemetry chunk in the browser
-- (src/lib/telemetry.ts, loaded after the first page) reports the pages of each visit and the time each was on screen
-- through log_visit(). admin_stats() grows into the full owner dashboard and admin_player() drills into one
-- player. The owner pages need the `admins` name AND a verified login (Google or a confirmed email), so typing the
-- name into the old name-only form never opens them.

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where name = me()) and account_kind() = 'verified'
$$;

-- One row per visit (a tab, until it sits hidden for 30 minutes). active_ms counts only time on screen.
create table visits (
  sid uuid primary key,
  user_id uuid,
  name text,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  active_ms bigint not null default 0,
  pages integer not null default 0,
  device text,
  pwa boolean,
  theme text,
  referrer text,
  entry text
);
create index visits_started_idx on visits (started_at);
create index visits_name_idx on visits (name, started_at);
alter table visits enable row level security;
revoke all on visits from anon, authenticated;

create table page_views (
  view_id bigint generated always as identity primary key,
  sid uuid not null references visits on delete cascade,
  name text,
  at timestamptz not null,
  path text not null,
  ms integer not null default 0
);
create index page_views_at_idx on page_views (at);
create index page_views_sid_idx on page_views (sid);
alter table page_views enable row level security;
revoke all on page_views from anon, authenticated;

-- p_views: [{"p": "/stats/daily/:date", "t": <epoch ms when shown>, "ms": <ms on screen>}], sent in batches; a page
-- still open is sent again later with a bigger ms (same p + t), so rows are keyed by (sid, path, at).
create unique index page_views_once on page_views (sid, path, at);

create function log_visit(p_sid uuid, p_views jsonb, p_meta jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  n text := me();
begin
  if p_sid is null or jsonb_typeof(p_views) <> 'array' then return; end if;
  insert into visits (sid, user_id, name, device, pwa, theme, referrer, entry)
  values (p_sid, u, n, left(p_meta ->> 'device', 20), (p_meta ->> 'pwa')::boolean, left(p_meta ->> 'theme', 10),
          left(p_meta ->> 'ref', 100), left(p_meta ->> 'entry', 100))
  on conflict (sid) do update set last_at = now(), user_id = coalesce(visits.user_id, excluded.user_id),
    name = coalesce(visits.name, excluded.name);
  -- a visit that has logged thousands of pages is a runaway tab or a script: stop listening to it
  if (select pages from visits where sid = p_sid) > 2000 then return; end if;
  insert into page_views (sid, name, at, path, ms)
  select p_sid, n, to_timestamp((v ->> 't')::double precision / 1000), left(v ->> 'p', 100),
         least(greatest(coalesce((v ->> 'ms')::integer, 0), 0), 3600000)
  from jsonb_array_elements(p_views) with ordinality x(v, i)
  where i <= 50 and v ->> 'p' like '/%' and (v ->> 't') ~ '^\d{13}$'
    -- shown within the last day (a clock far off, or a replay, is ignored)
    and to_timestamp((v ->> 't')::double precision / 1000) between now() - interval '1 day' and now() + interval '5 minutes'
  on conflict (sid, path, at) do update set ms = greatest(page_views.ms, excluded.ms);
  update visits set
    active_ms = (select coalesce(sum(ms), 0) from page_views where sid = p_sid),
    pages = (select count(*) from page_views where sid = p_sid),
    started_at = least(started_at, (select min(at) from page_views where sid = p_sid))
  where sid = p_sid;
exception when others then
  raise warning 'log_visit failed: %', sqlerrm;
end $$;
revoke all on function log_visit(uuid, jsonb, jsonb) from public;
grant execute on function log_visit(uuid, jsonb, jsonb) to anon, authenticated;

-- The owner dashboard ---------------------------------------------------------------------------------------------

drop function admin_stats(integer);
create function admin_stats(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  tz constant text := 'America/Los_Angeles';
  today date := (now() at time zone tz)::date;
  span integer := greatest(1, least(coalesce(p_days, 30), 365));
  since date := today - span + 1;
  since_ts timestamptz := (since::timestamp at time zone tz);
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return (
  with
  -- who did anything when: visits, games and logged moments (not errors)
  act as (
    select name, last_at as at from visits where name is not null and last_at >= now() - interval '35 days'
    union all select name, started_at from visits where name is not null and started_at >= now() - interval '35 days'
    union all select name, created_at from submissions where created_at >= now() - interval '35 days'
    union all select name, at from events where name is not null and kind <> 'error' and at >= now() - interval '35 days'),
  act_since as (
    select name, (at at time zone tz)::date as day from visits v, lateral (values (v.started_at), (v.last_at)) t(at)
    where v.name is not null and v.last_at >= since_ts
    union select name, (created_at at time zone tz)::date from submissions where created_at >= since_ts
    union select name, (at at time zone tz)::date from events where name is not null and kind <> 'error' and at >= since_ts),
  first_play as (select name, min(created_at) as first_at from submissions group by name),
  vis as (select * from visits where started_at >= since_ts),
  days as (select generate_series(since, today, interval '1 day')::date as day)
  select jsonb_build_object(
    'since', since, 'today', today, 'days_span', span,
    'kpis', jsonb_build_object(
      'dau', (select count(distinct name) from act where (at at time zone tz)::date = today),
      'wau', (select count(distinct name) from act where at >= now() - interval '7 days'),
      'mau', (select count(distinct name) from act where at >= now() - interval '30 days'),
      'visits_today', (select count(*) from visits where (started_at at time zone tz)::date = today),
      'games_today', (select count(*) from submissions where (created_at at time zone tz)::date = today),
      'new_7d', (select count(*) from first_play where first_at >= now() - interval '7 days'),
      'median_visit_s', (select round(percentile_cont(0.5) within group (order by active_ms) / 1000)
                         from visits where started_at >= now() - interval '7 days' and active_ms > 0),
      'minutes_per_player_day', (select round(sum(active_ms) / 60000.0 / greatest(1, count(distinct (name, (started_at at time zone tz)::date))), 1)
                                 from visits where started_at >= now() - interval '7 days' and name is not null),
      'players', (select count(*) from players),
      'leagues', (select count(*) from leagues)),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'active', (select count(distinct a.name) from act_since a where a.day = d.day),
        'visits', (select count(*) from vis where (vis.started_at at time zone tz)::date = d.day),
        'minutes', (select round(coalesce(sum(active_ms), 0) / 60000.0) from vis where (vis.started_at at time zone tz)::date = d.day),
        'views', (select count(*) from page_views p where p.at >= since_ts and (p.at at time zone tz)::date = d.day),
        'daily', (select count(*) from submissions s where s.created_at >= since_ts and (s.created_at at time zone tz)::date = d.day and s.challenge_id is null),
        'challenges', (select count(*) from submissions s where s.created_at >= since_ts and (s.created_at at time zone tz)::date = d.day and s.challenge_id is not null),
        'starts', (select count(*) from events e where e.at >= since_ts and (e.at at time zone tz)::date = d.day and e.kind = 'game_start'),
        'new_players', (select count(*) from first_play f where (f.first_at at time zone tz)::date = d.day),
        'sign_ins', (select count(*) from events e where e.at >= since_ts and (e.at at time zone tz)::date = d.day and e.kind = 'sign_in'),
        'sign_ups', (select count(*) from events e where e.at >= since_ts and (e.at at time zone tz)::date = d.day and e.kind = 'sign_up'),
        'messages', (select count(*) from messages m where m.created_at >= since_ts and (m.created_at at time zone tz)::date = d.day),
        'errors', (select count(*) from events e where e.at >= since_ts and (e.at at time zone tz)::date = d.day and e.kind = 'error')
      ) order by d.day), '[]') from days d),
    -- when people play: weekday (0 = Sunday) x hour, Pacific
    'heatmap', (select coalesce(jsonb_agg(jsonb_build_array(dow, hr, n)), '[]') from (
      select extract(dow from created_at at time zone tz)::int as dow, extract(hour from created_at at time zone tz)::int as hr, count(*) as n
      from submissions where created_at >= since_ts group by 1, 2) h),
    'visit_lengths', (select jsonb_build_object(
        'under_1m', count(*) filter (where active_ms < 60000),
        '1_3m', count(*) filter (where active_ms >= 60000 and active_ms < 180000),
        '3_10m', count(*) filter (where active_ms >= 180000 and active_ms < 600000),
        '10_30m', count(*) filter (where active_ms >= 600000 and active_ms < 1800000),
        'over_30m', count(*) filter (where active_ms >= 1800000)) from vis where active_ms > 0),
    'pages', (select coalesce(jsonb_agg(x order by x.views desc), '[]') from (
      select path, count(*) as views, count(distinct coalesce(name, sid::text)) as visitors,
             round(avg(ms) / 1000.0) as avg_s, round(sum(ms) / 60000.0) as minutes
      from page_views where at >= since_ts group by path order by count(*) desc limit 25) x),
    'entries', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select coalesce(entry, '?') as entry, count(*) as n from vis group by 1 order by 2 desc limit 10) x),
    'referrers', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
      select referrer, count(*) as n from vis where referrer is not null group by 1 order by 2 desc limit 10) x),
    'devices', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select coalesce(device, 'unknown') as k, count(*) as n from vis group by 1) x),
    'app_share', (select jsonb_build_object('app', count(*) filter (where pwa), 'browser', count(*) filter (where not pwa),
                                            'dark', count(*) filter (where theme = 'dark'), 'total', count(*)) from vis),
    -- weekly cohorts by first game ever: how many were back 1..4 weeks later
    'retention', (select coalesce(jsonb_agg(c order by c.week desc), '[]') from (
      select date_trunc('week', f.first_at at time zone tz)::date as week, count(*) as size,
        jsonb_build_array(
          count(*) filter (where exists (select 1 from submissions s where s.name = f.name and (s.created_at at time zone tz)::date >= date_trunc('week', f.first_at at time zone tz)::date + 7 and (s.created_at at time zone tz)::date < date_trunc('week', f.first_at at time zone tz)::date + 14)),
          count(*) filter (where exists (select 1 from submissions s where s.name = f.name and (s.created_at at time zone tz)::date >= date_trunc('week', f.first_at at time zone tz)::date + 14 and (s.created_at at time zone tz)::date < date_trunc('week', f.first_at at time zone tz)::date + 21)),
          count(*) filter (where exists (select 1 from submissions s where s.name = f.name and (s.created_at at time zone tz)::date >= date_trunc('week', f.first_at at time zone tz)::date + 21 and (s.created_at at time zone tz)::date < date_trunc('week', f.first_at at time zone tz)::date + 28)),
          count(*) filter (where exists (select 1 from submissions s where s.name = f.name and (s.created_at at time zone tz)::date >= date_trunc('week', f.first_at at time zone tz)::date + 28 and (s.created_at at time zone tz)::date < date_trunc('week', f.first_at at time zone tz)::date + 35))
        ) as back
      from first_play f where f.first_at >= now() - interval '10 weeks' group by 1) c),
    -- new accounts in the period: did they play, come back on another day, save their account?
    'funnel', (select jsonb_build_object(
        'signed_up', count(*),
        'played', count(*) filter (where exists (select 1 from submissions s where s.name = p.name)),
        'returned', count(*) filter (where (select count(distinct (s.created_at at time zone tz)::date) from submissions s where s.name = p.name) >= 2),
        'verified', count(*) filter (where u.id is not null and login_method(u) not in ('guest', 'name')))
      from players p left join auth.users u on u.id = p.user_id where p.created_at >= since_ts),
    'features', jsonb_build_object(
      'dailies', (select count(*) from submissions where created_at >= since_ts and challenge_id is null),
      'challenges', (select count(*) from submissions where created_at >= since_ts and challenge_id is not null),
      'practice_views', (select count(*) from page_views where at >= since_ts and path = '/practice'),
      'battles', (select count(*) from battles where updated_at >= since_ts),
      'messages', (select count(*) from messages where created_at >= since_ts),
      'chatters', (select count(distinct name) from messages where created_at >= since_ts),
      'push_players', (select count(distinct name) from push_subscriptions)),
    'accounts', (select coalesce(jsonb_object_agg(m, n), '{}') from (
      select coalesce(login_method(u), 'no login yet') as m, count(*) as n
      from players p left join auth.users u on u.id = p.user_id group by 1) x),
    'leagues', (select coalesce(jsonb_agg(x order by x.games desc, x.members desc), '[]') from (
      select l.league_id as id, l.name, l.is_public,
             (select count(*) from league_members m where m.league_id = l.league_id) as members,
             (select count(*) from submissions s where s.league_id = l.league_id and s.created_at >= since_ts) as games,
             (select count(distinct s.name) from submissions s where s.league_id = l.league_id and s.created_at >= since_ts) as players,
             (select count(*) from messages m where m.league_id = l.league_id and m.created_at >= since_ts) as messages
      from leagues l) x),
    'players', (select coalesce(jsonb_agg(x order by x.last_seen desc nulls last), '[]') from (
      select p.name, p.created_at as joined,
             coalesce(login_method(u), 'no login yet') as login,
             (select max(at) from act a where a.name = p.name) as last_seen,
             (select count(*) from submissions s where s.name = p.name and s.created_at >= now() - interval '7 days') as games_7d,
             (select count(*) from submissions s where s.name = p.name and s.created_at >= now() - interval '30 days') as games_30d,
             (select count(*) from submissions s where s.name = p.name) as games_all,
             (select count(*) from visits v where v.name = p.name and v.started_at >= now() - interval '7 days') as visits_7d,
             (select round(coalesce(sum(active_ms), 0) / 60000.0) from visits v where v.name = p.name and v.started_at >= now() - interval '7 days') as minutes_7d,
             (select v.device from visits v where v.name = p.name order by v.last_at desc limit 1) as device,
             (select count(*) from league_members m where m.name = p.name) as leagues
      from players p left join auth.users u on u.id = p.user_id
      where exists (select 1 from act a where a.name = p.name) or p.created_at >= now() - interval '35 days') x),
    'errors', (select coalesce(jsonb_agg(x order by x.last_at desc), '[]') from (
      select data ->> 'message' as message, count(*) as n, count(distinct coalesce(name, '')) as players,
             max(at) as last_at, (array_agg(data -> 'info' ->> 'path' order by at desc))[1] as path
      from events where kind = 'error' and at >= since_ts group by 1 order by max(at) desc limit 30) x),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'name', name, 'league', league_id, 'data', data)
                                         order by at desc), '[]')
               from (select * from events where kind <> 'error' order by at desc limit 80) x))
  );
end $$;

-- One player: summary, recent visits with their pages, and their latest moments.
create function admin_player(p_name text) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return (select jsonb_build_object(
    'name', p.name, 'joined', p.created_at, 'login', coalesce(login_method(u), 'no login yet'),
    'leagues', (select coalesce(jsonb_agg(l.name order by m.joined_at), '[]') from league_members m join leagues l using (league_id) where m.name = p.name),
    'games', (select jsonb_build_object('all', count(*), 'dailies', count(*) filter (where challenge_id is null),
                                        'challenges', count(*) filter (where challenge_id is not null),
                                        'days', count(distinct day), 'best', min("time") filter (where challenge_id is null),
                                        'median', round(percentile_cont(0.5) within group (order by "time")::numeric, 1),
                                        'wins', count(*) filter (where challenge_id is null and "rank" = 1),
                                        'first', min(created_at), 'last', max(created_at))
              from submissions where name = p.name),
    'time', (select jsonb_build_object('visits_30d', count(*), 'minutes_30d', round(coalesce(sum(active_ms), 0) / 60000.0),
                                       'median_visit_s', round(percentile_cont(0.5) within group (order by active_ms) / 1000))
             from visits where name = p.name and started_at >= now() - interval '30 days'),
    'pages', (select coalesce(jsonb_agg(x order by x.views desc), '[]') from (
      select path, count(*) as views, round(sum(ms) / 60000.0, 1) as minutes from page_views
      where name = p.name and at >= now() - interval '30 days' group by path order by 2 desc limit 12) x),
    'visits', (select coalesce(jsonb_agg(x order by x.started_at desc), '[]') from (
      select v.started_at, v.active_ms, v.pages, v.device, v.pwa,
             (select coalesce(jsonb_agg(pv.path order by pv.at), '[]') from (select path, at from page_views where sid = v.sid order by at limit 30) pv) as path
      from visits v where v.name = p.name order by v.started_at desc limit 30) x),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'league', league_id, 'data', data) order by at desc), '[]')
               from (select * from events where name = p.name order by at desc limit 60) x))
    from players p left join auth.users u on u.id = p.user_id where p.name = p_name);
end $$;

revoke all on function admin_stats(integer), admin_player(text) from public, anon;
grant execute on function admin_stats(integer), admin_player(text) to authenticated;
revoke all on function is_admin() from public, anon, authenticated;

-- keep a year of visits, like events
select cron.schedule('reidle-visits-cleanup', '23 4 * * *',
  $$delete from public.visits where started_at < now() - interval '1 year'$$);
