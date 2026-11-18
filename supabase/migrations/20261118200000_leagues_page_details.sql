-- Leagues dashboard cards (design "D1"): each card shows your time today, the leader (or the runner-up when you
-- lead), how far you are from the player just above you in the week (or ahead of the one below), days left in
-- the week, and yesterday's winning time plus yours. Same keys as before, plus the new ones.

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
        'my_time_today', (select s."time" from submissions s where s.league_id = l.league_id and s.day = t.d
                          and s.challenge_id is null and s.name = n),
        'leader_today', (select jsonb_build_object('name', s.name, 'time', s."time") from submissions s
                         where s.league_id = l.league_id and s.day = t.d and s.challenge_id is null
                         order by s."time", s.submission_id limit 1),
        -- best time today that isn't yours: the one to beat, or the runner-up when you lead
        'best_other_today', (select jsonb_build_object('name', s.name, 'time', s."time") from submissions s
                         where s.league_id = l.league_id and s.day = t.d and s.challenge_id is null and s.name <> n
                         order by s."time", s.submission_id limit 1),
        'yesterday', (select jsonb_build_object(
                         'winner', (array_agg(s.name order by s."time", s.submission_id))[1],
                         'winner_time', (array_agg(s."time" order by s."time", s.submission_id))[1],
                         'players', count(*),
                         'my_rank', min(s."rank") filter (where s.name = n),
                         'my_time', min(s."time") filter (where s.name = n))
                       from submissions s where s.league_id = l.league_id and s.day = t.d - 1
                         and s.challenge_id is null having count(*) > 0),
        'open_challenges', (select count(*) from challenges c where c.league_id = l.league_id and c.day = t.d
                              and exists (select 1 from submissions s where s.challenge_id = c.challenge_id)
                              and not exists (select 1 from submissions s
                                              where s.challenge_id = c.challenge_id and s.name = n)),
        'week', (select jsonb_build_object(
                    'leader', w -> 0 ->> 'name',
                    'leader_score', w #> '{0,results,totals,score}',
                    'players', jsonb_array_length(w),
                    'days_left', week_start(t.d) + 6 - t.d,
                    'my_place', me.i,
                    'my_score', me.v #> '{results,totals,score}',
                    -- the player just above you (or just below when you're 1st), for "N pts behind X"
                    'next', case when me.i is not null then (
                      select jsonb_build_object('name', o ->> 'name', 'score', o #> '{results,totals,score}')
                      from jsonb_array_elements(w) with ordinality e(o, k)
                      where k = case when me.i = 1 then 2 else me.i - 1 end) end)
                 from week_scores(l.league_id, t.d) w
                 left join lateral (select v, i from jsonb_array_elements(w) with ordinality e(v, i)
                                    where v ->> 'name' = n) me on true)) as j
      from league_members m join leagues l using (league_id)
      cross join lateral (select league_day(l.league_id) as d) t
      where m.name = n) x), '[]');
end $$;
