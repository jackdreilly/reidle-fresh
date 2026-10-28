-- Reidog's lookup tools (Jack, 2026-10-28: "add some powerful tool calling readonly capabilities to reidog", "perhaps it
-- can issue readonly sql queries or something as a catch-all"). The `ask` edge function gives Gemini a few targeted
-- tools (the app's own stable page RPCs, called as the player over GET, so PostgREST runs them read-only) plus `query`:
-- one read-only SELECT over the views in schema `reidog`, which show only what the asking player can already see.
--
-- How ask_query stays safe, layer by layer:
--   1. Identity is pinned first: public.ask_query (security definer) resolves me()/lg() from the JWT and writes them to
--      a temp table the reader can't touch; the views read it through reidog.who(). Changing request.jwt.claims later
--      in the same transaction changes nothing.
--   2. The transaction is switched to read-only before the player's SQL runs (and can't be switched back).
--   3. The SQL runs inside reidog.run, a security definer owned by reidog_reader: a NOLOGIN role whose only privileges
--      are the reidog views and functions. Inside a security definer Postgres refuses SET ROLE / set_config('role'), so
--      the session's other roles (authenticator can become service_role) are out of reach.
--   4. Only one SELECT/WITH statement, wrapped in a subquery with a row cap; no ';', and a denylist of functions that run
--      SQL from a string (query_to_xml, ts_stat, ...), set settings, sleep or take locks, and of Supabase's own schemas
--      that grant to PUBLIC (pg_net's net.*). Statement timeout 3s.
--   5. The views hide what the app hides: today's daily answer never appears (answers only for finished days),
--      challenge answers only once you've played that challenge, pastes for today only once you've played today.
--      They are security_barrier views, so a crafted WHERE can't peek under the filter.

create schema reidog;
revoke all on schema reidog from public;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'reidog_reader') then
    create role reidog_reader nologin noinherit;
  end if;
end $$;
grant reidog_reader to current_user;  -- so the migration's role can hand reidog.run to it
grant usage on schema reidog to reidog_reader;

-- who is asking: pinned by ask_query, one row per transaction
create function reidog.who() returns table (name text, league_id bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if to_regclass('pg_temp.reidog_who') is null then return; end if;
  return query execute 'select name, league_id from pg_temp.reidog_who limit 1';
end $$;

create function reidog.my_leagues() returns setof bigint
language sql stable security definer set search_path = public as $$
  select m.league_id from league_members m where m.name = (select name from reidog.who())
$$;

create function reidog.today(p_league bigint) returns date
language sql stable security definer set search_path = public as $$ select league_day(p_league) $$;

create view reidog.me with (security_barrier) as
  select p.name, w.league_id as current_league_id, p.created_at as joined_reidle,
         (select count(*) from league_members m where m.name = p.name) as leagues
  from reidog.who() w join players p on p.name = w.name;

create view reidog.leagues with (security_barrier) as
  select l.league_id, l.name, l.is_public, l.tz, l.reset_hour, l.scoring, l.open_invite, l.created_by, l.created_at,
         reidog.today(l.league_id) as today, m.role as my_role, l.league_id = w.league_id as is_current,
         (select count(*) from league_members x where x.league_id = l.league_id) as members
  from reidog.who() w join league_members m on m.name = w.name join leagues l on l.league_id = m.league_id;

create view reidog.members with (security_barrier) as
  select m.league_id, m.name, m.role, m.joined_at
  from league_members m where m.league_id in (select reidog.my_leagues());

create view reidog.daily_results with (security_barrier) as
  select s.submission_id, s.league_id, s.day, s.name, s."time", s.penalty, s."rank", s.created_at as played_at,
         case when s.day < reidog.today(s.league_id) then upper(s.word) end as answer,
         case when s.day < reidog.today(s.league_id) or exists (
           select 1 from submissions m where m.league_id = s.league_id and m.day = s.day and m.challenge_id is null
             and m.name = (select name from reidog.who())) then s.paste end as paste
  from submissions s
  where s.challenge_id is null and s.league_id in (select reidog.my_leagues());

create view reidog.challenges with (security_barrier) as
  select c.challenge_id, c.league_id, c.day, c.created_at, upper(c.starting_word) as starting_word,
         case when exists (select 1 from submissions m where m.challenge_id = c.challenge_id
                           and m.name = (select name from reidog.who())) then upper(c.answer) end as answer,
         (select s.name from submissions s where s.challenge_id = c.challenge_id order by s.created_at limit 1) as set_by,
         (select count(*) from submissions s where s.challenge_id = c.challenge_id) as players
  from challenges c where c.league_id in (select reidog.my_leagues());

create view reidog.challenge_results with (security_barrier) as
  select s.submission_id, s.challenge_id, s.league_id, s.name, s."time", s.penalty, s."rank", s.created_at as played_at
  from submissions s
  where s.challenge_id is not null and s.league_id in (select reidog.my_leagues());

create view reidog.weekly_winners with (security_barrier) as
  select w.league_id, w.week, w.name from winners w where w.league_id in (select reidog.my_leagues());

create view reidog.messages with (security_barrier) as
  select m.message_id, m.league_id, m.name, m.message, cardinality(m.likes) as likes, m.created_at
  from messages m where m.league_id in (select reidog.my_leagues());

-- A week's standings, as the Leaderboard's week tab computes them (without its lazy writes).
create function reidog.week_standings(p_week date, p_league bigint default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l bigint := coalesce(p_league, (select league_id from reidog.who()));
  w date := week_start(p_week);
begin
  if l is null or l not in (select reidog.my_leagues()) then return null; end if;
  if l <> 1 or w >= scoring_cutover() then return week_scores_calc(l, w, true); end if;
  return coalesce((select results from week_snapshots where league_id = 1 and week = w), week_scores_calc(1, w, false));
end $$;

revoke all on all functions in schema reidog from public;
grant select on all tables in schema reidog to reidog_reader;
grant execute on function reidog.who(), reidog.my_leagues(), reidog.today(bigint), reidog.week_standings(date, bigint) to reidog_reader;

-- Runs the (already checked) query as reidog_reader: see 3. above.
create function reidog.run(p_sql text, p_limit integer) returns jsonb
language plpgsql volatile security definer set search_path = reidog, pg_catalog as $$
declare r jsonb;
begin
  execute format(E'select coalesce(jsonb_agg(to_jsonb(q)), ''[]'') from (select * from (\n%s\n) q limit %s) q', p_sql, p_limit)
    into r;
  return r;
end $$;
revoke all on function reidog.run(text, integer) from public;
grant create on schema reidog to reidog_reader;  -- only for the hand-over
alter function reidog.run(text, integer) owner to reidog_reader;
revoke create on schema reidog from reidog_reader;

create function public.ask_query(p_sql text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp set statement_timeout = '3s' as $$
declare
  n text := me();
  q text := regexp_replace(coalesce(p_sql, ''), '[\s;]+$', '');
  flat text := lower(replace(q, '"', ''));
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if q !~* '^\s*(select|with)\M' then raise exception 'Only a single SELECT (or WITH ... SELECT) is allowed'; end if;
  if position(';' in q) > 0 then raise exception 'One statement only (no ";")'; end if;
  if length(q) > 4000 then raise exception 'Query too long'; end if;
  if flat ~ '(set_config|query_to|_to_xml|xml|ts_stat|ts_rewrite|u&|advisory|pg_sleep|dblink|\mlo_|pg_read|pg_ls|pg_terminate|pg_cancel|pg_notify|nextval|setval|txid|pg_stat_file|\mnet\M|http|\mcron\M|vault|pgsodium|\mauth\M|storage|realtime|supabase_|graphql|extensions)' then
    raise exception 'That function isn''t available here';
  end if;
  if to_regclass('pg_temp.reidog_who') is not null then raise exception 'One query per request'; end if;
  create temp table reidog_who on commit drop as select n as name, lg() as league_id;
  revoke all on pg_temp.reidog_who from public;
  perform set_config('transaction_read_only', 'on', true);
  return reidog.run(q, 50);
end $$;
revoke all on function public.ask_query(text) from public, anon;
grant execute on function public.ask_query(text) to authenticated;

-- Which tools Reidog used for an answer, for the "Asked Reidog" admin card.
alter table ask_log add column tools jsonb;

drop function ask_finish(bigint, text, integer, text);
create function ask_finish(p_id bigint, p_answer text, p_ms integer, p_model text, p_tools jsonb default null) returns void
language sql volatile security definer set search_path = public as $$
  update ask_log set answer = left(p_answer, 8000), ms = p_ms, model = left(p_model, 60),
    tools = case when jsonb_typeof(p_tools) = 'array' and jsonb_array_length(p_tools) > 0 and length(p_tools::text) < 20000 then p_tools end
  where id = p_id and name = me() and answer is null
$$;
revoke all on function ask_finish(bigint, text, integer, text, jsonb) from public, anon;
grant execute on function ask_finish(bigint, text, integer, text, jsonb) to authenticated;

create or replace function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'question', a.question, 'answer', a.answer,
                                                          'ms', a.ms, 'at', a.created_at, 'tools', a.tools) order by a.created_at desc)
                      from (select * from ask_log order by created_at desc limit 100) a), '[]'),
    'asks_7d', (select count(*) from ask_log where created_at > now() - interval '7 days'))
$$;
