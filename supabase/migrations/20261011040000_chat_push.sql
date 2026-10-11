-- Browser push notifications for chat. Opt-in per browser from the Messages page (push_subscribe /
-- push_unsubscribe). Sending lives in the `push` edge function (supabase/functions/push): the Messages
-- page pings it after posting, it claims the recent not-yet-pushed messages (push_claim, each message
-- once) and Web-Pushes them to every other player's subscribed browsers. Its VAPID key pair is generated
-- on first use and kept in push_vapid, so a fresh project needs no secrets set by hand.

create table push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%'),
  name text not null references players (name) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_name_idx on push_subscriptions (name);

create table push_sent (
  message_id integer primary key references messages on delete cascade,
  sent_at timestamptz not null default now()
);

create table push_vapid (
  id boolean primary key default true check (id),
  public_key text not null,
  private_jwk jsonb not null
);

alter table push_subscriptions enable row level security;
alter table push_sent enable row level security;
alter table push_vapid enable row level security;
revoke all on push_subscriptions, push_sent, push_vapid from anon, authenticated;

-- Client RPCs ----------------------------------------------------------------

-- Re-subscribing (same browser, maybe another player now) just takes the endpoint over.
create function push_subscribe(p_subscription jsonb) returns void
language sql volatile security definer set search_path = public as $$
  insert into push_subscriptions (endpoint, name, subscription)
  values (p_subscription ->> 'endpoint', require_me(),
          jsonb_build_object('endpoint', p_subscription ->> 'endpoint', 'keys', p_subscription -> 'keys'))
  on conflict (endpoint) do update set name = excluded.name, subscription = excluded.subscription, created_at = now()
$$;

-- The endpoint is the browser's own secret: whoever holds it may drop it.
create function push_unsubscribe(p_endpoint text) returns void
language sql volatile security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and require_me() is not null
$$;

revoke execute on function push_subscribe(jsonb), push_unsubscribe(text) from public, anon;
grant execute on function push_subscribe(jsonb), push_unsubscribe(text) to authenticated;

-- Edge function only (service_role) ------------------------------------------

-- Claims messages from the last few minutes that were never pushed and returns, per message, the
-- subscriptions of everyone but its author. A second call returns nothing for the same messages.
create function push_claim() returns jsonb
language sql volatile security definer set search_path = public as $$
  with claimed as (
    insert into push_sent (message_id)
    select message_id from messages where created_at > now() - interval '10 minutes'
    on conflict do nothing
    returning message_id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'message_id', m.message_id, 'name', m.name, 'message', m.message,
      'subscriptions', coalesce((select jsonb_agg(s.subscription) from push_subscriptions s where s.name <> m.name), '[]'))
    order by m.created_at), '[]')
  from claimed c join messages m using (message_id)
$$;

-- Push services answered 404/410: those browsers unsubscribed.
create function push_gone(p_endpoints text[]) returns void
language sql volatile security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = any (p_endpoints)
$$;

-- Returns the stored VAPID keys; with arguments, stores them first unless some already exist.
create function push_keys(p_public text default null, p_private jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if p_public is not null then
    insert into push_vapid (public_key, private_jwk) values (p_public, p_private) on conflict do nothing;
  end if;
  return (select jsonb_build_object('public_key', public_key, 'private_jwk', private_jwk) from push_vapid);
end $$;

revoke execute on function push_claim(), push_gone(text[]), push_keys(text, jsonb) from public, anon, authenticated;
grant execute on function push_claim(), push_gone(text[]), push_keys(text, jsonb) to service_role;
