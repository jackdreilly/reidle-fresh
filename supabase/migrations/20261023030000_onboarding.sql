-- New-player tour: shown once per player (not per device) until they dismiss it.
-- Everyone who already has an account has found their way around, so they start with it seen.

alter table players add column tour_seen boolean not null default true;
alter table players alter column tour_seen set default false;

create function dismiss_tour() returns void
language sql volatile security definer set search_path = public as $$
  update players set tour_seen = true where name = require_me()
$$;
revoke all on function dismiss_tour() from public, anon;
grant execute on function dismiss_tour() to authenticated;

create or replace function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (select me() as n, lg() as l)
  select jsonb_build_object(
    'name', ctx.n,
    'played_today', played_today(ctx.n),
    'unread', coalesce(
      coalesce((select last_read from message_reads where league_id = ctx.l and name = ctx.n), 'epoch')
        < (select max(created_at) from messages where league_id = ctx.l), false),
    'pending_challenges', case when ctx.n is null or ctx.l is null then 0
      else (select count(*) from pending_challenge_ids(ctx.n)) end,
    'account', case when ctx.n is not null then account_kind() end,
    'nickname_set', (select nickname_set from players where name = ctx.n),
    'tour_seen', (select tour_seen from players where name = ctx.n),
    'league', league_brief(ctx.l),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object('id', x.league_id, 'name', x.name)
                                          order by m.joined_at, m.league_id)
                         from league_members m join leagues x using (league_id) where m.name = ctx.n), '[]'))
  from ctx
$$;
