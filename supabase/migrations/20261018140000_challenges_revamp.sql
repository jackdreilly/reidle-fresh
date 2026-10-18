-- Challenges revamp: the pages get what they need to read as one experience.
--   challenges_page: + `open` (challenges waiting for me: who set it, time to beat, players),
--                    history rows + starting_word, rank and player_count (old keys kept).
--   challenge_page:  + starting_word, answer (only once played), created_at, leader, pending count.
--   challenge_play:  + set_by, player_count for the start screen.
--   bootstrap:       + pending_challenges for the count badge in the app shell.
-- create or replace keeps the existing grants.

create or replace function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', me(),
    'played_today', played_today(me()),
    'unread', coalesce(
      coalesce((select last_read from message_reads where name = me()), 'epoch')
        < (select max(created_at) from messages), false),
    'pending_challenges', case when me() is null then 0
      else (select count(*) from pending_challenge_ids(me())) end)
$$;

create or replace function challenges_page() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n text := require_me(); res jsonb;
begin
  with c as (
    select challenge_id, answer, starting_word, created_at >= current_date as is_today
    from challenges where created_at >= current_date - 1),
  s as (
    select c.challenge_id, c.answer, c.starting_word, c.is_today, sb.name, sb."time",
           count(*) over (partition by c.challenge_id) as player_count,
           rank() over (partition by c.challenge_id order by sb."time") as place
    from c join submissions sb using (challenge_id)),
  win as (
    select distinct on (challenge_id) challenge_id, name as winner, "time" as wtime
    from s order by challenge_id, "time"),
  scorable as (select * from s where player_count > 1),
  winpts as (
    select sc.is_today, sc.name, sum(sc.player_count) as pts, count(*) as wins
    from scorable sc join win w on w.challenge_id = sc.challenge_id and w.winner = sc.name
    group by 1, 2),
  lose as (select is_today, name, count(*) as played from scorable group by 1, 2),
  board as (
    select l.is_today, l.name, coalesce(w.pts, 0) - l.played as total_points,
           coalesce(w.wins, 0) as num_wins, l.played - coalesce(w.wins, 0) as num_losses
    from lose l left join winpts w using (is_today, name)),
  boards as (
    select is_today, jsonb_agg(jsonb_build_object(
      'name', name, 'num_wins', num_wins, 'num_losses', num_losses,
      'total_points', total_points) order by total_points desc, name) as lb
    from board group by 1),
  hist as (
    select jsonb_agg(jsonb_build_object(
      'challenge_id', s.challenge_id, 'answer', upper(s.answer), 'starting_word', upper(s.starting_word),
      'time', s."time", 'rank', s.place, 'player_count', s.player_count,
      'winner', jsonb_build_object('name', w.winner, 'time', w.wtime),
      'players', coalesce((select jsonb_agg(o.name order by o.name) from s o
          where o.challenge_id = s.challenge_id and o.name <> n and o.name <> w.winner),
          '[]')) order by s.challenge_id desc) as h
    from s join win w using (challenge_id)
    where s.is_today and s.name = n),
  pend as (
    select jsonb_agg(jsonb_build_object(
      'challenge_id', o.challenge_id,
      'set_by', (select x.name from submissions x where x.challenge_id = o.challenge_id
                 order by x.created_at, x.submission_id limit 1),
      'leader', (select jsonb_build_object('name', x.name, 'time', x."time") from submissions x
                 where x.challenge_id = o.challenge_id order by x."time" limit 1),
      'player_count', (select count(*) from submissions x where x.challenge_id = o.challenge_id))
      order by o.created_at) as l
    from challenges o where o.challenge_id in (select pending_challenge_ids(n)))
  select jsonb_build_object(
    'today_leaderboard', coalesce((select lb from boards where is_today), '[]'),
    'yesterday_leaderboard', coalesce((select lb from boards where not is_today), '[]'),
    'history', coalesce((select h from hist), '[]'),
    'open', coalesce((select l from pend), '[]'),
    'pending_challenges', (select count(*) from pending_challenge_ids(n)))
  into res;
  return res;
end $$;

create or replace function challenge_play(p_id integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'starting_word', upper(c.starting_word), 'answer', upper(c.answer),
    'already_played', exists (select 1 from submissions s
        where s.challenge_id = c.challenge_id and s.name = me()),
    'leader', (select jsonb_build_object('name', s.name, 'time', s."time")
        from submissions s where s.challenge_id = c.challenge_id
        order by s."time" limit 1),
    'set_by', (select s.name from submissions s where s.challenge_id = c.challenge_id
        order by s.created_at, s.submission_id limit 1),
    'player_count', (select count(*) from submissions s where s.challenge_id = c.challenge_id))
  from challenges c where c.challenge_id = p_id
$$;

-- The answer is only revealed to players who have played the challenge (same rule as pastes).
create or replace function challenge_page(p_id integer) returns jsonb
language sql stable security definer set search_path = public as $$
  with played as (
    select exists (select 1 from submissions
                   where challenge_id = p_id and name = me()) as p)
  select jsonb_build_object(
    'played', played.p,
    'starting_word', upper(c.starting_word),
    'answer', case when played.p then upper(c.answer) end,
    'created_at', c.created_at,
    'pending_challenges', (select count(*) from pending_challenge_ids(me())),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'submission_id', submission_id, 'name', name, 'time', "time", 'penalty', penalty,
        'paste', case when played.p then paste else '' end) order by "time")
      from submissions where challenge_id = p_id), '[]'))
  from played left join challenges c on c.challenge_id = p_id
$$;
