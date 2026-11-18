-- Play -> Resume: the shell (bootstrap) and the leagues dashboard say when today's daily is started but not finished,
-- so the client labels its Play buttons Resume. A checkpoint row for today = started (start_play); a submission = finished.

create or replace function started_today(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not played_today(p_name) and exists (
    select 1 from checkpoints where name = p_name and league_id = (select lg()) and day = (select lg_today()))
$$;
revoke all on function started_today(text) from public, anon, authenticated;

create or replace function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (select me() as n, lg() as l)
  select jsonb_build_object(
    'name', ctx.n,
    'played_today', played_today(ctx.n),
    'started_today', started_today(ctx.n),
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

create or replace function leagues_page() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  return coalesce((
    select jsonb_agg(x.j order by x.joined_at, x.league_id) from (
      select m.joined_at, l.league_id, jsonb_build_object(
        'id', l.league_id, 'name', l.name, 'role', m.role, 'is_public', l.is_public,
        'today', t.d, 'reset_at', league_reset_at(l.league_id),
        'members', (select count(*) from league_members mm where mm.league_id = l.league_id),
        'played', exists (select 1 from submissions s where s.league_id = l.league_id and s.day = t.d
                          and s.challenge_id is null and s.name = n),
        'started', not exists (select 1 from submissions s where s.league_id = l.league_id and s.day = t.d
                                  and s.challenge_id is null and s.name = n)
                   and exists (select 1 from checkpoints c where c.league_id = l.league_id and c.name = n and c.day = t.d),
        'players_today', (select count(*) from submissions s where s.league_id = l.league_id and s.day = t.d
                          and s.challenge_id is null),
        'my_rank_today', (select s."rank" from submissions s where s.league_id = l.league_id and s.day = t.d
                          and s.challenge_id is null and s.name = n),
        'leader_today', (select jsonb_build_object('name', s.name, 'time', s."time") from submissions s
                         where s.league_id = l.league_id and s.day = t.d and s.challenge_id is null
                         order by s."time", s.submission_id limit 1),
        'yesterday', (select jsonb_build_object(
                         'winner', (array_agg(s.name order by s."time", s.submission_id))[1],
                         'players', count(*),
                         'my_rank', min(s."rank") filter (where s.name = n))
                       from submissions s where s.league_id = l.league_id and s.day = t.d - 1
                         and s.challenge_id is null having count(*) > 0),
        'open_challenges', (select count(*) from challenges c where c.league_id = l.league_id and c.day = t.d
                              and exists (select 1 from submissions s where s.challenge_id = c.challenge_id)
                              and not exists (select 1 from submissions s
                                              where s.challenge_id = c.challenge_id and s.name = n)),
        'week', (select jsonb_build_object(
                    'leader', w -> 0 ->> 'name',
                    'players', jsonb_array_length(w),
                    'my_place', (select i from jsonb_array_elements(w) with ordinality e(v, i)
                                 where v ->> 'name' = n),
                    'my_score', (select v #> '{results,totals,score}' from jsonb_array_elements(w) v
                                 where v ->> 'name' = n))
                 from week_scores(l.league_id, t.d) w)) as j
      from league_members m join leagues l using (league_id)
      cross join lateral (select league_day(l.league_id) as d) t
      where m.name = n) x), '[]');
end $$;
