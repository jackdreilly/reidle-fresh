-- Activity log for the owner (Jack, 2026-10-24: "comprehensive logging and analytics", "lightweight options that
-- just get the job done"). Triggers record the key moments server-side, so the app sends nothing extra:
-- sign_up, sign_in, link (Google/email added to an existing account), game_start, game_finish, message,
-- league_create, league_join. The one thing only the browser knows, its errors, comes in through log_error().
-- admin_stats() feeds the owner-only /admin page; admins are listed in `admins`.

create table events (
  event_id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  user_id uuid,
  name text,          -- player name at the time (no foreign key: the log outlives renames and deletions)
  league_id bigint,
  data jsonb not null default '{}'
);
create index events_at_idx on events (at);
create index events_kind_at_idx on events (kind, at);
alter table events enable row level security;
revoke all on events from anon, authenticated;

create table admins (
  name text primary key references players (name) on update cascade on delete cascade
);
alter table admins enable row level security;
revoke all on admins from anon, authenticated;
insert into admins select name from players where name = 'jack';

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where name = me())
$$;

-- Never lets logging break the thing being logged.
create function log_event(p_kind text, p_user uuid, p_name text, p_league bigint, p_data jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  insert into events (kind, user_id, name, league_id, data)
  values (p_kind, p_user, coalesce(p_name, (select name from players where user_id = p_user)), p_league,
          coalesce(jsonb_strip_nulls(p_data), '{}'));
exception when others then
  raise warning 'log_event(%) failed: %', p_kind, sqlerrm;
end $$;

-- How an auth user signs in: guest, name (the old name-only accounts), google, email.
create function login_method(u auth.users) returns text
language sql stable security definer set search_path = public, auth as $$
  select case
    when coalesce(u.is_anonymous, false) then 'guest'
    when exists (select 1 from auth.identities i where i.user_id = u.id and i.provider <> 'email')
      then (select string_agg(distinct i.provider, '+') from auth.identities i where i.user_id = u.id and i.provider <> 'email')
    when u.email like '%@players.reidle.app' then 'name'
    else 'email' end
$$;

create function device_of(ua text) returns text
language sql immutable set search_path = public as $$
  select case
    when ua is null then null
    when ua ~* 'iphone|ipad' then 'iOS'
    when ua ~* 'android' then 'Android'
    when ua ~* 'macintosh' then 'Mac'
    when ua ~* 'windows' then 'Windows'
    when ua ~* 'linux|cros' then 'Linux'
    else 'other' end
$$;

-- Auth ------------------------------------------------------------------------------------------------------------

create function event_sign_up() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  perform log_event('sign_up', new.id, null, null, jsonb_build_object('method', login_method(new)));
  return new;
end $$;
-- runs after on_auth_user_created (triggers fire in name order), so the player row exists
create trigger reidle_event_sign_up after insert on auth.users
  for each row execute function event_sign_up();

create function event_sign_in() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  perform log_event('sign_in', new.user_id, null, null, jsonb_build_object(
    'method', (select login_method(u) from auth.users u where u.id = new.user_id),
    'device', device_of(new.user_agent)));
  return new;
end $$;
create trigger reidle_event_sign_in after insert on auth.sessions
  for each row execute function event_sign_in();

-- An identity added to an account that already existed = linking (the first identity of a new account is part of sign_up).
create function event_link() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if (select created_at from auth.users where id = new.user_id) < now() - interval '1 minute' then
    perform log_event('link', new.user_id, null, null, jsonb_build_object('provider', new.provider));
  end if;
  return new;
end $$;
create trigger reidle_event_link after insert on auth.identities
  for each row execute function event_link();

-- Games, chat, leagues --------------------------------------------------------------------------------------------

-- start_play (re)writes the checkpoint with a fresh created_at only when a new day's game starts
create function event_game_start() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.created_at is distinct from old.created_at then
    perform log_event('game_start', null, new.name, new.league_id, jsonb_build_object('day', new.day));
  end if;
  return new;
end $$;
create trigger reidle_event_game_start after insert or update on checkpoints
  for each row execute function event_game_start();

create function event_game_finish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform log_event('game_finish', null, new.name, new.league_id, jsonb_build_object(
    'type', case when new.challenge_id is null then 'daily' else 'challenge' end,
    'day', new.day, 'challenge_id', new.challenge_id, 'time', new."time", 'penalty', new.penalty));
  return new;
end $$;
create trigger reidle_event_game_finish after insert on submissions
  for each row execute function event_game_finish();

create function event_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform log_event('message', null, new.name, new.league_id, '{}');
  return new;
end $$;
create trigger reidle_event_message after insert on messages
  for each row execute function event_message();

create function event_league() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'leagues' then
    perform log_event('league_create', null, new.created_by, new.league_id, jsonb_build_object('league', new.name));
  else
    perform log_event('league_join', null, new.name, new.league_id, '{}');
  end if;
  return new;
end $$;
create trigger reidle_event_league_create after insert on leagues
  for each row execute function event_league();
create trigger reidle_event_league_join after insert on league_members
  for each row execute function event_league();

-- Browser errors --------------------------------------------------------------------------------------------------

-- Signed out too (the sign-in page can break). Capped so a crash loop cannot flood the log:
-- 20 an hour per account, 300 an hour from signed-out browsers together.
create function log_error(p_message text, p_data jsonb default '{}') returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  cap integer := 20;
begin
  if u is null then cap := 300; end if;
  if (select count(*) from events where kind = 'error' and at > now() - interval '1 hour'
        and user_id is not distinct from u) >= cap then
    return;
  end if;
  perform log_event('error', u, null, lg(), jsonb_build_object(
    'message', left(coalesce(p_message, ''), 500),
    'info', case when jsonb_typeof(p_data) = 'object' and length(p_data::text) <= 2000 then p_data end));
end $$;
revoke all on function log_error(text, jsonb) from public;
grant execute on function log_error(text, jsonb) to anon, authenticated;

-- Owner page ------------------------------------------------------------------------------------------------------

-- Counts per day (Pacific, where most players are) for the last p_days days, plus recent errors and activity.
create function admin_stats(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  tz constant text := 'America/Los_Angeles';
  since date := (now() at time zone tz)::date - greatest(1, least(p_days, 365)) + 1;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'since', since,
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'active', (select count(distinct e.name) from events e where (e.at at time zone tz)::date = d.day and e.name is not null and e.kind <> 'error'),
        'sign_ins', (select count(*) from events e where (e.at at time zone tz)::date = d.day and e.kind = 'sign_in'),
        'sign_ups', (select count(*) from events e where (e.at at time zone tz)::date = d.day and e.kind = 'sign_up'),
        'starts', (select count(*) from events e where (e.at at time zone tz)::date = d.day and e.kind = 'game_start'),
        -- finished games come from submissions, so the history from before this log counts too
        'daily', (select count(*) from submissions s where (s.created_at at time zone tz)::date = d.day and s.challenge_id is null),
        'challenges', (select count(*) from submissions s where (s.created_at at time zone tz)::date = d.day and s.challenge_id is not null),
        'messages', (select count(*) from messages m where (m.created_at at time zone tz)::date = d.day),
        'errors', (select count(*) from events e where (e.at at time zone tz)::date = d.day and e.kind = 'error')
      ) order by d.day desc), '[]')
      from (select generate_series(since, (now() at time zone tz)::date, interval '1 day')::date as day) d),
    'totals', jsonb_build_object(
      'players', (select count(*) from players),
      'played_7d', (select count(distinct name) from submissions where created_at > now() - interval '7 days'),
      'played_30d', (select count(distinct name) from submissions where created_at > now() - interval '30 days'),
      'leagues', (select count(*) from leagues),
      'accounts', (select coalesce(jsonb_object_agg(m, n), '{}') from (
        select login_method(u) as m, count(*) as n from auth.users u join players p on p.user_id = u.id group by 1) x)),
    'sign_ups', (select coalesce(jsonb_object_agg(m, n), '{}') from (
      select data ->> 'method' as m, count(*) as n from events
      where kind = 'sign_up' and at >= since group by 1) x),
    'devices', (select coalesce(jsonb_object_agg(dv, n), '{}') from (
      select coalesce(data ->> 'device', 'unknown') as dv, count(*) as n from events
      where kind = 'sign_in' and at >= since group by 1) x),
    'errors', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'name', name, 'message', data ->> 'message', 'info', data -> 'info')
                                         order by at desc), '[]')
               from (select * from events where kind = 'error' order by at desc limit 50) x),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'name', name, 'league', league_id, 'data', data)
                                         order by at desc), '[]')
               from (select * from events where kind <> 'error' order by at desc limit 50) x));
end $$;

-- Keep a year of activity (errors: 90 days).
select cron.schedule('reidle-events-cleanup', '17 4 * * *',
  $$delete from public.events where at < now() - interval '1 year' or (kind = 'error' and at < now() - interval '90 days')$$);

-- helpers and trigger functions stay private (only log_error and admin_stats are part of the API)
revoke all on function is_admin(), log_event(text, uuid, text, bigint, jsonb), login_method(auth.users), device_of(text),
  event_sign_up(), event_sign_in(), event_link(), event_game_start(), event_game_finish(), event_message(), event_league(),
  admin_stats(integer) from public, anon, authenticated;
grant execute on function admin_stats(integer) to authenticated;
