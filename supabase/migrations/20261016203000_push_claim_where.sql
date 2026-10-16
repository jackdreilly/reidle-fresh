-- Hosted Supabase runs pg_safeupdate on API requests: a DELETE without a WHERE clause is refused
-- ("DELETE requires a WHERE clause"), which broke push_claim when the edge function called it.
create or replace function push_claim() returns jsonb
language sql volatile security definer set search_path = public as $$
  with claimed as (delete from push_outbox where id is not null returning *)
  select coalesce(jsonb_agg(jsonb_build_object(
      'title', c.title, 'body', c.body, 'url', c.url, 'tag', c.tag,
      'subscriptions', coalesce((select jsonb_agg(s.subscription) from push_subscriptions s where s.name = any (c.recipients)), '[]'))
    order by c.id), '[]')
  from claimed c where c.created_at > now() - interval '1 hour'
$$;
