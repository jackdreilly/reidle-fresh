-- Push cooldowns: a burst of events turns into one alert now and one summary later, per person.
--
-- The first event of a kind alerts right away. Further events of that kind for the same person during its
-- cooldown are held (only the latest is kept, with a count); when the cooldown ends, one summary goes out
-- ("🎯 bob beat you on a challenge (+3 more)") and the cooldown starts again. Cooldowns by kind (tag prefix):
--   chat 2 min · challenges 10 min · beaten 15 min (per day) · results 30 min (per day).
-- Reminder, new word and recap are already once a day, so they pass straight through.
-- A held chat summary is dropped if the person has read the chat since.
-- pg_cron now runs every minute (push_minute) to send summaries on time; push_tick's daily jobs are keyed
-- per day, so running it every minute still sends each one once.

create table push_throttle (
  name text not null references players (name) on delete cascade,
  grp text not null,
  last_sent timestamptz not null,
  held integer not null default 0,
  held_at timestamptz,
  title text, body text, url text, tag text,
  primary key (name, grp)
);
alter table push_throttle enable row level security;
revoke all on push_throttle from anon, authenticated;

-- Which cooldown group a push belongs to (null = never throttled).
create function push_group(p_tag text) returns text
language sql immutable as $$
  select case when p_tag like 'chat-%' then 'chat'
              when p_tag like 'challenge-%' then 'challenges'
              when p_tag like 'beaten-%' or p_tag like 'results-%' then p_tag
         end
$$;

create function push_cooldown(p_grp text) returns interval
language sql immutable as $$
  select case when p_grp = 'chat' then interval '2 minutes'
              when p_grp = 'challenges' then interval '10 minutes'
              when p_grp like 'beaten-%' then interval '15 minutes'
              else interval '30 minutes' end
$$;

-- Same signature as before, so the triggers are unchanged: now throttles each recipient.
create or replace function push_enqueue(p_to text[], p_title text, p_body text, p_url text, p_tag text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  g text := push_group(p_tag);
  n text;
  t push_throttle;
begin
  if cardinality(p_to) = 0 then return; end if;
  if g is null then
    insert into push_outbox (recipients, title, body, url, tag) values (p_to, p_title, p_body, p_url, p_tag);
    return;
  end if;
  foreach n in array p_to loop
    select * into t from push_throttle where name = n and grp = g for update;
    if t.name is null or t.last_sent <= now() - push_cooldown(g) then
      -- not cooling down: alert now (folding in anything still held) and restart the clock
      insert into push_outbox (recipients, title, body, url, tag)
      values (array[n], p_title || case when coalesce(t.held, 0) > 0 then ' (+' || t.held || ' more)' else '' end,
              p_body, p_url, p_tag);
      insert into push_throttle (name, grp, last_sent) values (n, g, now())
      on conflict (name, grp) do update set last_sent = now(), held = 0, held_at = null;
    else
      -- cooling down: keep the latest, count the rest
      update push_throttle set held = held + 1, held_at = now(),
        title = p_title, body = p_body, url = p_url, tag = p_tag
      where name = n and grp = g;
    end if;
  end loop;
end $$;

-- Sends the summaries whose cooldown has ended.
create function push_flush_held() returns void
language plpgsql volatile security definer set search_path = public as $$
declare t record;
begin
  for t in
    select * from push_throttle
    where held > 0 and last_sent <= now() - push_cooldown(grp)
    for update skip locked
  loop
    update push_throttle set held = 0, held_at = null, last_sent = now() where name = t.name and grp = t.grp;
    -- already caught up on chat: nothing to say
    if t.grp = 'chat' and coalesce((select last_read from message_reads where name = t.name), 'epoch') >= t.held_at then
      continue;
    end if;
    insert into push_outbox (recipients, title, body, url, tag)
    values (array[t.name], t.title || case when t.held > 1 then ' (+' || (t.held - 1) || ' more)' else '' end,
            t.body, t.url, t.tag);
  end loop;
end $$;

create function push_minute() returns integer
language plpgsql volatile security definer set search_path = public as $$
begin
  perform push_flush_held();
  return push_tick();
end $$;

revoke execute on function push_group(text), push_cooldown(text), push_flush_held(), push_minute()
  from public, anon, authenticated;

select cron.unschedule('reidle-push-tick');
select cron.schedule('reidle-push-minute', '* * * * *', 'select public.push_minute()');
