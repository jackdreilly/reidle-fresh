-- Notifications beyond chat. Each player picks what they want pushed on the Settings page (notify_prefs);
-- the browser subscription itself stays per device (push_subscriptions, see *_chat_push.sql).
--
-- Everything to send goes through one outbox (push_outbox: recipients + title/body/url/tag):
--   - triggers on messages and submissions enqueue chat, "finished today", "beat your time" and challenge pushes;
--     the page then pings the `push` edge function, which claims the outbox (push_claim) and sends it;
--   - an hourly pg_cron job (push_tick) enqueues the scheduled ones (reminder before the reset, new word, Monday
--     recap) and pings the edge function itself through pg_net. The function records its own URL in push_config
--     on every call, so no project needs it configured by hand.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table notify_prefs (
  name text primary key references players (name) on delete cascade,
  chat boolean not null default true,
  results boolean not null default false,
  beaten boolean not null default false,
  challenges boolean not null default false,
  new_day boolean not null default false,
  recap boolean not null default false,
  -- remind me this many hours before the daily word resets (UTC midnight) if I haven't played; null = off
  reminder_before integer check (reminder_before between 1 and 23),
  updated_at timestamptz not null default now()
);

create table push_outbox (
  id bigint generated always as identity primary key,
  recipients text[] not null,
  title text not null,
  body text not null,
  url text not null,
  tag text,
  created_at timestamptz not null default now()
);

-- Scheduled jobs already done (so a re-run of the same hour never sends twice).
create table push_jobs (
  job text not null,
  day date not null,
  primary key (job, day)
);

create table push_config (
  id boolean primary key default true check (id),
  url text not null
);

alter table notify_prefs enable row level security;
alter table push_outbox enable row level security;
alter table push_jobs enable row level security;
alter table push_config enable row level security;
revoke all on notify_prefs, push_outbox, push_jobs, push_config from anon, authenticated;

-- Chat now goes through the outbox too.
drop function push_claim();
drop table push_sent;

-- Helpers (private) -----------------------------------------------------------

-- 38.2s / 1:04.5
create function push_secs(t double precision) returns text
language sql immutable as $$
  select case when t < 60 then round(t::numeric, 1) || 's'
              else floor(t / 60)::int || ':' || lpad(to_char(t - floor(t / 60) * 60, 'FM00.0'), 4, '0') end
$$;

create function push_ordinal(n bigint) returns text
language sql immutable as $$
  select n || case when n % 100 between 11 and 13 then 'th'
                   when n % 10 = 1 then 'st' when n % 10 = 2 then 'nd' when n % 10 = 3 then 'rd' else 'th' end
$$;

-- Players with a subscribed browser who want this kind of push.
create function push_wanted(p_kind text) returns setof text
language sql stable security definer set search_path = public as $$
  select distinct s.name from push_subscriptions s left join notify_prefs p using (name)
  where case p_kind
    when 'chat' then coalesce(p.chat, true)
    when 'results' then coalesce(p.results, false)
    when 'beaten' then coalesce(p.beaten, false)
    when 'challenges' then coalesce(p.challenges, false)
    when 'new_day' then coalesce(p.new_day, false)
    when 'recap' then coalesce(p.recap, false)
    else false end
$$;

create function push_enqueue(p_to text[], p_title text, p_body text, p_url text, p_tag text) returns void
language sql volatile security definer set search_path = public as $$
  insert into push_outbox (recipients, title, body, url, tag)
  select p_to, p_title, p_body, p_url, p_tag where cardinality(p_to) > 0
$$;

-- Triggers ---------------------------------------------------------------------
-- Only live rows notify: bulk loads (imports, clones) carry old created_at values.

create function push_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_at > now() - interval '10 minutes' then
    perform push_enqueue(array(select push_wanted('chat') except select new.name), new.name,
      case when new.message ~* '^/gif\M' then 'sent a GIF'
           else left(btrim(regexp_replace(new.message, '\s+', ' ', 'g')), 160) end,
      '/messages', 'chat-' || new.message_id);
  end if;
  return null;
end $$;
create trigger push_on_message after insert on messages
  for each row execute function push_on_message();

create function push_on_submission() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r bigint; total bigint; leader text; beaten text[];
  b record;
begin
  if new.created_at < now() - interval '10 minutes' then return null; end if;

  if new.challenge_id is null then
    if new.day <> current_date then return null; end if;
    select count(*) filter (where s."time" < new."time") + 1, count(*) into r, total
      from submissions s where s.day = new.day and s.challenge_id is null;
    -- who led before this game
    select s.name into leader from submissions s
      where s.day = new.day and s.challenge_id is null and s.submission_id <> new.submission_id
      order by s."time", s.submission_id limit 1;
    -- players who already played, now slower than this game, and want to hear about it
    for b in
      select s.name, s."time" from submissions s
      where s.day = new.day and s.challenge_id is null and s.name <> new.name and s."time" > new."time"
        and s.name in (select push_wanted('beaten'))
    loop
      beaten := beaten || b.name;
      if r = 1 and b.name = leader then
        perform push_enqueue(array[b.name], '👑 ' || new.name || ' took 1st place from you',
          push_secs(new."time") || ' vs your ' || push_secs(b."time"), '/stats/today', 'beaten-' || new.day);
      else
        perform push_enqueue(array[b.name], '⚡ ' || new.name || ' beat your time',
          push_secs(new."time") || ' vs your ' || push_secs(b."time") || ' · ' || new.name || ' is ' || push_ordinal(r) || ' today',
          '/stats/today', 'beaten-' || new.day);
      end if;
    end loop;
    perform push_enqueue(
      array(select push_wanted('results') except select new.name except select unnest(coalesce(beaten, '{}'))),
      new.name || ' finished today''s Reidle',
      push_secs(new."time") || ' · ' || push_ordinal(r) || ' of ' || total || ' so far',
      '/stats/today', 'results-' || new.day);
  else
    select count(*) into total from submissions s where s.challenge_id = new.challenge_id;
    if total = 1 then
      perform push_enqueue(array(select push_wanted('challenges') except select new.name),
        '🎯 ' || new.name || ' set a challenge', push_secs(new."time") || ' · can you beat it?',
        '/challenges/challenge/' || new.challenge_id, 'challenge-' || new.challenge_id);
    else
      for b in
        select s.name, s."time" from submissions s
        where s.challenge_id = new.challenge_id and s.name <> new.name and s."time" > new."time"
          and s.name in (select push_wanted('challenges'))
      loop
        perform push_enqueue(array[b.name], '🎯 ' || new.name || ' beat you on a challenge',
          push_secs(new."time") || ' vs your ' || push_secs(b."time"),
          '/challenges/challenge/' || new.challenge_id, 'challenge-' || new.challenge_id);
      end loop;
    end if;
  end if;
  return null;
end $$;
create trigger push_on_submission after insert on submissions
  for each row execute function push_on_submission();

-- Scheduled (hourly) -------------------------------------------------------------

-- Enqueues whatever is due this UTC hour (each job once per day), then wakes the edge function.
create function push_tick(p_at timestamptz default now()) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  d date := (p_at at time zone 'utc')::date;
  h int := extract(hour from p_at at time zone 'utc');
  last_week date := week_start(d - 7);
  played int; y_name text; y_time double precision; w jsonb; pl record; queued int;
begin
  -- reminder: N hours before the word resets, to players who haven't finished today's
  if h > 0 then
    insert into push_jobs values ('reminder-' || h, d) on conflict do nothing;
    if found then
      select count(*) into played from submissions where day = d and challenge_id is null;
      perform push_enqueue(array(
          select p.name from notify_prefs p
          where p.reminder_before = 24 - h and p.name in (select name from push_subscriptions)
            and not exists (select 1 from submissions s where s.day = d and s.challenge_id is null and s.name = p.name)),
        '⏰ Today''s Reidle ends in ' || (24 - h) || (case when h = 23 then ' hour' else ' hours' end),
        case played when 0 then 'Nobody has played yet. Go first!'
                    when 1 then '1 player has played. Your turn!'
                    else played || ' players have played. Your turn!' end,
        '/play', 'reminder-' || d);
    end if;
  end if;

  if h = 0 then
    -- new word, with yesterday's winner
    insert into push_jobs values ('new_day', d) on conflict do nothing;
    if found then
      select name, "time" into y_name, y_time from submissions where day = d - 1 and challenge_id is null
        order by "time", submission_id limit 1;
      perform push_enqueue(array(select push_wanted('new_day')), '🌅 A new Reidle word is up',
        coalesce('Yesterday ' || y_name || ' won in ' || push_secs(y_time) || '.', 'Be the first to play today.'),
        '/play', 'new-day-' || d);
    end if;

    -- Monday: last week's recap, personalised
    if extract(isodow from d) = 1 then
      insert into push_jobs values ('recap', d) on conflict do nothing;
      if found then
        w := week_scores(last_week);
        if jsonb_array_length(w) > 0 then
          for pl in
            select n.name, (select x.i from jsonb_array_elements(w) with ordinality x(e, i) where x.e ->> 'name' = n.name) as place,
                   (select x.e #>> '{results,totals,score}' from jsonb_array_elements(w) x(e) where x.e ->> 'name' = n.name) as pts
            from push_wanted('recap') n(name)
          loop
            perform push_enqueue(array[pl.name], '🏆 ' || (w -> 0 ->> 'name') || ' won the week',
              case when pl.place = 1 then 'That''s you! ' || pl.pts || ' points.'
                   when pl.place is not null then (w -> 0 #>> '{results,totals,score}') || ' points. You came '
                        || push_ordinal(pl.place) || ' of ' || jsonb_array_length(w) || ' with ' || pl.pts || '.'
                   else (w -> 0 #>> '{results,totals,score}') || ' points. You sat this one out.' end,
              '/stats/weekly/' || last_week, 'recap-' || d);
          end loop;
        end if;
      end if;
    end if;
  end if;

  select count(*) into queued from push_outbox where created_at > now() - interval '1 hour';
  if queued > 0 and exists (select 1 from push_config) then
    perform net.http_post(url := (select url from push_config), body := '{}'::jsonb,
                          headers := '{"content-type":"application/json"}'::jsonb);
  end if;
  return queued;
end $$;

select cron.schedule('reidle-push-tick', '0 * * * *', 'select public.push_tick()');

-- Edge function only (service_role) ---------------------------------------------

-- Takes everything queued in the last hour (older leftovers are dropped) with the recipients' subscriptions.
create function push_claim() returns jsonb
language sql volatile security definer set search_path = public as $$
  with claimed as (delete from push_outbox returning *)
  select coalesce(jsonb_agg(jsonb_build_object(
      'title', c.title, 'body', c.body, 'url', c.url, 'tag', c.tag,
      'subscriptions', coalesce((select jsonb_agg(s.subscription) from push_subscriptions s where s.name = any (c.recipients)), '[]'))
    order by c.id), '[]')
  from claimed c where c.created_at > now() - interval '1 hour'
$$;

create function push_endpoint(p_url text) returns void
language sql volatile security definer set search_path = public as $$
  insert into push_config (url) values (p_url) on conflict (id) do update set url = excluded.url
    where push_config.url is distinct from excluded.url
$$;

revoke execute on function push_claim(), push_endpoint(text), push_tick(timestamptz), push_wanted(text),
  push_enqueue(text[], text, text, text, text), push_on_message(), push_on_submission(),
  push_secs(double precision), push_ordinal(bigint) from public, anon, authenticated;
grant execute on function push_claim(), push_endpoint(text) to service_role;

-- Client RPCs ------------------------------------------------------------------

create function settings_page() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', n, 'prefs', jsonb_build_object(
      'chat', coalesce(p.chat, true), 'results', coalesce(p.results, false), 'beaten', coalesce(p.beaten, false),
      'challenges', coalesce(p.challenges, false), 'new_day', coalesce(p.new_day, false),
      'recap', coalesce(p.recap, false), 'reminder_before', p.reminder_before))
  from require_me() n left join notify_prefs p on p.name = n
$$;

-- Saves only the keys given.
create function set_notify_prefs(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  insert into notify_prefs (name) values (n) on conflict do nothing;
  update notify_prefs set
    chat = coalesce((p ->> 'chat')::boolean, chat),
    results = coalesce((p ->> 'results')::boolean, results),
    beaten = coalesce((p ->> 'beaten')::boolean, beaten),
    challenges = coalesce((p ->> 'challenges')::boolean, challenges),
    new_day = coalesce((p ->> 'new_day')::boolean, new_day),
    recap = coalesce((p ->> 'recap')::boolean, recap),
    reminder_before = case when p ? 'reminder_before' then (p ->> 'reminder_before')::int else reminder_before end,
    updated_at = now()
  where name = n;
  return settings_page() -> 'prefs';
end $$;

revoke execute on function settings_page(), set_notify_prefs(jsonb) from public, anon;
grant execute on function settings_page(), set_notify_prefs(jsonb) to authenticated;
