-- Growth (Jack, 2026-10-25: "track new leagues and their names ... cumulative and week over week", "where people may fall
-- off particularly on invite flows and first play and coming back the next day", "a dismissible for new players
-- encouraging daily reminders", "remembered across devices").
--   * log_invite(): the invite page (/join/:code) records each open, signed out too, so the owner page can follow an
--     invite from the link to joining, a first game in that league and a next-day return.
--   * players.reminder_prompt_seen + dismiss_reminder_prompt(): the "want a nudge each day?" card for new players
--     (it links to the notification settings), answered once per player (not per device), like the tour. bootstrap() says when to show it.
--   * admin_growth(): leagues week by week, every league with week-over-week numbers, the new-player funnel (one row
--     per new player, so the page can show where each one stopped) and the invite funnel.

-- Reminder prompt ----------------------------------------------------------------------------------------------------

-- Players from more than two weeks ago are not new; nor is anyone who already set a reminder.
alter table players add column reminder_prompt_seen boolean not null default false;
update players p set reminder_prompt_seen = true
where p.created_at < now() - interval '14 days'
   or exists (select 1 from notify_prefs n where n.name = p.name and n.reminder_before is not null);

-- p_outcome: 'settings' (tapped through to the notification settings) or 'dismissed'
create function dismiss_reminder_prompt(p_outcome text default 'dismissed') returns void
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  update players set reminder_prompt_seen = true where name = n and not reminder_prompt_seen;
  if found then
    perform log_event('reminder_prompt', auth.uid(), n, lg(), jsonb_build_object(
      'outcome', case when p_outcome = 'settings' then 'settings' else 'dismissed' end));
  end if;
end $$;
revoke all on function dismiss_reminder_prompt(text) from public, anon;
grant execute on function dismiss_reminder_prompt(text) to authenticated;

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
    'legacy_until', case when ctx.n is not null and account_kind() = 'legacy'
      then (select case when legacy_logins then legacy_until else 'epoch' end from app_flags) end,
    'nickname_set', (select nickname_set from players where name = ctx.n),
    'tour_seen', (select tour_seen from players where name = ctx.n),
    -- after their first finished game, until they answer it once (or set a reminder in Settings)
    'reminder_prompt', (select not p.reminder_prompt_seen
                          and exists (select 1 from submissions s where s.name = p.name)
                          and not exists (select 1 from notify_prefs np where np.name = p.name and np.reminder_before is not null)
                        from players p where p.name = ctx.n),
    'league', league_brief(ctx.l),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object('id', x.league_id, 'name', x.name)
                                          order by m.joined_at, m.league_id)
                         from league_members m join leagues x using (league_id) where m.name = ctx.n), '[]'))
  from ctx
$$;

-- Invite opens -------------------------------------------------------------------------------------------------------

-- Called by the invite page, signed out too. p_sid is the browser tab's visit id (src/lib/telemetry.ts), which ties a
-- signed-out open to the account it becomes. One open per tab (or account) per league per 12 hours; 500 an hour overall.
create function log_invite(p_code text, p_sid uuid default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  l bigint := (select league_id from leagues where invite_code = lower(btrim(p_code)));
  n text := me();
begin
  if l is null then return; end if;
  if (select count(*) from events where kind = 'invite_open' and at > now() - interval '1 hour') >= 500 then return; end if;
  if exists (select 1 from events where kind = 'invite_open' and league_id = l and at > now() - interval '12 hours'
               and ((p_sid is not null and data ->> 'sid' = p_sid::text) or (u is not null and user_id = u))
               and (n is null or name is not null)) then
    return;
  end if;
  perform log_event('invite_open', u, n, l, jsonb_build_object('sid', p_sid, 'member', is_member(l, n)));
exception when others then
  raise warning 'log_invite failed: %', sqlerrm;
end $$;
revoke all on function log_invite(text, uuid) from public;
grant execute on function log_invite(text, uuid) to anon, authenticated;

-- Owner page: growth -------------------------------------------------------------------------------------------------

-- Weeks start Monday, Pacific. "Made" leagues are the ones players created (not Reidle OG or Reidle Global).
create function admin_growth(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  pt constant text := 'America/Los_Angeles';
  today date := (now() at time zone pt)::date;
  span integer := greatest(1, least(coalesce(p_days, 30), 365));
  since_ts timestamptz := ((today - span + 1)::timestamp at time zone pt);
  this_week date := date_trunc('week', today)::date;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return (
  with
  made as (select * from leagues where league_id not in (1, 2)),
  weeks as (select generate_series(this_week - 7 * 11, this_week, interval '7 days')::date as wk),
  -- who opened an invite: the account when known (then or later in the same tab), else the tab
  opens as (
    select e.league_id, e.at, w.name as who_name, coalesce(w.name, e.data ->> 'sid', e.event_id::text) as who,
           coalesce((e.data ->> 'member')::boolean, false) as member
    from events e
    left join players p on p.user_id = e.user_id
    -- a signed-out open: whoever that tab later signed in as (on the invite page again, or anywhere in the visit)
    left join lateral (select pl.name from events e2 join players pl on pl.user_id = e2.user_id
                       where e2.kind = 'invite_open' and e2.data ->> 'sid' = e.data ->> 'sid' limit 1) sn on p.name is null
    left join lateral (select pl.name from visits v join players pl on pl.user_id = v.user_id
                       where v.sid::text = e.data ->> 'sid' limit 1) pv on p.name is null
    cross join lateral (select coalesce(p.name, sn.name, pv.name) as name) w
    where e.kind = 'invite_open'),
  invitees as (
    select o.league_id, o.who, min(o.who_name) as name, min(o.at) as first_at, bool_and(o.member) as member_all
    from opens o group by 1, 2),
  inv as (
    select i.league_id, i.who, i.name, i.first_at,
      i.name is not null as signed_in,
      m.joined_at is not null and m.joined_at >= i.first_at - interval '1 minute' as joined,
      fp.day as first_day,
      exists (select 1 from submissions s where s.league_id = i.league_id and s.name = i.name
                and (s.created_at at time zone pt)::date = fp.day + 1) as next_day
    from invitees i
    left join league_members m on m.league_id = i.league_id and m.name = i.name
    left join lateral (select (min(s.created_at) at time zone pt)::date as day from submissions s
                       where s.league_id = i.league_id and s.name = i.name and s.created_at >= i.first_at) fp on true
    -- members who were already in (the commissioner checking their own link) are not invitees
    where not i.member_all),
  -- every player's first finished game and the days they played (Pacific)
  newp as (
    select p.name, p.created_at, p.reminder_prompt_seen, coalesce(login_method(u), 'no login yet') as login,
           (select min(s.created_at) from submissions s where s.name = p.name) as first_play
    from players p left join auth.users u on u.id = p.user_id
    where p.created_at >= since_ts)
  select jsonb_build_object(
    'today', today, 'days_span', span,
    'league_kpis', jsonb_build_object(
      'made', (select count(*) from made),
      'new_7d', (select count(*) from made where created_at >= now() - interval '7 days'),
      'new_prev_7d', (select count(*) from made where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
      'active_7d', (select count(distinct s.league_id) from submissions s where s.league_id not in (1, 2) and s.created_at >= now() - interval '7 days'),
      'active_prev_7d', (select count(distinct s.league_id) from submissions s where s.league_id not in (1, 2)
                         and s.created_at >= now() - interval '14 days' and s.created_at < now() - interval '7 days'),
      'with_friends', (select count(*) from made l where (select count(*) from league_members m where m.league_id = l.league_id) >= 2),
      'players_in_made', (select count(distinct m.name) from league_members m where m.league_id not in (1, 2)),
      'invite_opens_7d', (select count(*) from inv where first_at >= now() - interval '7 days'),
      'invite_joins_7d', (select count(*) from inv where joined and first_at >= now() - interval '7 days')),
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object(
        'week', w.wk,
        'new_leagues', (select count(*) from made l where (l.created_at at time zone pt)::date >= w.wk and (l.created_at at time zone pt)::date < w.wk + 7),
        'total_leagues', (select count(*) from made l where (l.created_at at time zone pt)::date < w.wk + 7),
        'names', (select coalesce(jsonb_agg(l.name order by l.created_at), '[]') from made l
                  where (l.created_at at time zone pt)::date >= w.wk and (l.created_at at time zone pt)::date < w.wk + 7),
        'joins', (select count(*) from league_members m where m.league_id not in (1, 2)
                  and (m.joined_at at time zone pt)::date >= w.wk and (m.joined_at at time zone pt)::date < w.wk + 7),
        'members', (select count(distinct m.name) from league_members m where m.league_id not in (1, 2) and (m.joined_at at time zone pt)::date < w.wk + 7),
        'active_leagues', (select count(distinct s.league_id) from submissions s where s.league_id not in (1, 2)
                           and (s.created_at at time zone pt)::date >= w.wk and (s.created_at at time zone pt)::date < w.wk + 7),
        'games', (select count(*) from submissions s where s.league_id not in (1, 2)
                  and (s.created_at at time zone pt)::date >= w.wk and (s.created_at at time zone pt)::date < w.wk + 7),
        'new_players', (select count(*) from players p where (p.created_at at time zone pt)::date >= w.wk and (p.created_at at time zone pt)::date < w.wk + 7),
        'invite_opens', (select count(*) from inv where (inv.first_at at time zone pt)::date >= w.wk and (inv.first_at at time zone pt)::date < w.wk + 7)
      ) order by w.wk), '[]') from weeks w),
    'leagues', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select l.league_id as id, l.name, l.is_public, l.created_at, l.created_by,
             (select coalesce(jsonb_agg(m.name order by m.joined_at), '[]') from league_members m
              where m.league_id = l.league_id and m.role = 'commissioner') as commissioners,
             (select count(*) from league_members m where m.league_id = l.league_id) as members,
             (select count(*) from league_members m where m.league_id = l.league_id and m.joined_at >= now() - interval '7 days') as joined_7d,
             (select count(*) from league_members m where m.league_id = l.league_id
                and m.joined_at >= now() - interval '14 days' and m.joined_at < now() - interval '7 days') as joined_prev_7d,
             (select count(distinct s.name) from submissions s where s.league_id = l.league_id and s.created_at >= now() - interval '7 days') as players_7d,
             (select count(distinct s.name) from submissions s where s.league_id = l.league_id
                and s.created_at >= now() - interval '14 days' and s.created_at < now() - interval '7 days') as players_prev_7d,
             (select count(*) from submissions s where s.league_id = l.league_id and s.created_at >= now() - interval '7 days') as games_7d,
             (select count(*) from submissions s where s.league_id = l.league_id
                and s.created_at >= now() - interval '14 days' and s.created_at < now() - interval '7 days') as games_prev_7d,
             (select count(*) from messages m where m.league_id = l.league_id and m.created_at >= now() - interval '7 days') as messages_7d,
             (select max(s.created_at) from submissions s where s.league_id = l.league_id) as last_game,
             (select count(*) from inv where inv.league_id = l.league_id) as invite_opens,
             (select count(*) from inv where inv.league_id = l.league_id and inv.joined) as invite_joins
      from leagues l) x),
    -- one row per new player in the period: how far they got
    'new_players', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', np.name, 'joined', np.created_at, 'login', np.login,
        'via', (select l.name from league_members m join leagues l using (league_id)
                where m.name = np.name and m.league_id <> 2 order by m.joined_at limit 1),
        'started', np.first_play is not null or exists (select 1 from checkpoints c where c.name = np.name)
                   or exists (select 1 from events e where e.kind = 'game_start' and e.name = np.name),
        'played', np.first_play is not null,
        'first_play', np.first_play,
        'next_day', exists (select 1 from submissions s where s.name = np.name
                              and (s.created_at at time zone pt)::date = (np.first_play at time zone pt)::date + 1),
        'week', exists (select 1 from submissions s where s.name = np.name
                          and (s.created_at at time zone pt)::date between (np.first_play at time zone pt)::date + 1 and (np.first_play at time zone pt)::date + 7),
        'days', (select count(distinct (s.created_at at time zone pt)::date) from submissions s where s.name = np.name),
        'saved', np.login not in ('guest', 'name', 'no login yet'),
        'reminder', exists (select 1 from notify_prefs n where n.name = np.name and n.reminder_before is not null)
                    and exists (select 1 from push_subscriptions ps where ps.name = np.name),
        'prompt', (select e.data ->> 'outcome' from events e join players pl on pl.user_id = e.user_id
                   where e.kind = 'reminder_prompt' and pl.name = np.name order by e.at desc limit 1)
      ) order by np.created_at desc), '[]') from newp np),
    -- signed-out arrivals in the period: how many reached sign-in, how many became a player in that visit
    'arrivals', (select jsonb_build_object(
        'signed_out', count(*),
        'saw_sign_in', count(*) filter (where exists (select 1 from page_views pv where pv.sid = v.sid and pv.path = '/sign-in')),
        'became_player', count(*) filter (where v.user_id is not null))
      from visits v
      where v.started_at >= since_ts
        and (select pv.name from page_views pv where pv.sid = v.sid order by pv.at limit 1) is null),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object(
        'league', l.name, 'league_id', inv.league_id, 'who', coalesce(inv.name, 'signed-out visitor'), 'at', inv.first_at,
        'signed_in', inv.signed_in, 'joined', inv.joined, 'played', inv.first_day is not null, 'next_day', inv.next_day
      ) order by inv.first_at desc), '[]')
      from inv join leagues l using (league_id) where inv.first_at >= since_ts)
  ));
end $$;
revoke all on function admin_growth(integer) from public, anon;
grant execute on function admin_growth(integer) to authenticated;
