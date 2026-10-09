-- RPC layer. One function per page/action, each returning ready-to-render jsonb
-- so a page costs exactly one round trip. All are security definer; identity
-- comes from auth.uid() via me().

create function me() returns text
language sql stable security definer set search_path = public as $$
  select name from players where user_id = auth.uid()
$$;

create function require_me() returns text
language plpgsql stable security definer set search_path = public as $$
declare n text := me();
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  return n;
end $$;

create function played_today(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from submissions
    where name = p_name and day = current_date and challenge_id is null)
$$;

-- App shell state, fetched once per page load.
create function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', me(),
    'played_today', played_today(me()),
    'unread', coalesce(
      coalesce((select last_read from message_reads where name = me()), 'epoch')
        < (select max(created_at) from messages), false))
$$;

-- Daily word, created on demand if the calendar has a gap.
create function ensure_daily_word(p_day date) returns daily_words
language plpgsql security definer set search_path = public as $$
declare r daily_words;
begin
  select * into r from daily_words where day = p_day;
  if not found then
    insert into daily_words (day, word, answer)
    values (p_day,
      (select word from words order by random() limit 1),
      (select answer from answers order by random() limit 1))
    on conflict (day) do nothing;
    select * into r from daily_words where day = p_day;
  end if;
  return r;
end $$;

-- Starting a game is an explicit, side-effecting step (start_play, called by a POST from a user
-- tap). Merely loading /play (prefetch, prerender, tab restore, reload) is play_state: a pure
-- read that creates nothing and never reveals the word before the clock has been started.
create function play_payload(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'started', true,
    'startingWord', upper(dw.word), 'word', upper(dw.answer),
    'winner', lead.name, 'winnersTime', lead."time",
    'checkpoint', jsonb_build_object(
      'created_at', cp.created_at, 'penalty', cp.penalty, 'history', cp.history),
    'server_now', clock_timestamp())
  from checkpoints cp
  join daily_words dw on dw.day = current_date
  left join lateral (select name, "time" from submissions
    where day = current_date and challenge_id is null order by "time" limit 1) lead on true
  where cp.name = p_name and cp.day = current_date
$$;

create function play_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  n text := require_me();
  payload jsonb;
begin
  if played_today(n) then raise exception 'already played' using errcode = 'P0001'; end if;
  payload := play_payload(n);
  if payload is not null then return payload; end if;
  return jsonb_build_object('started', false,
    'winner', (select name from submissions where day = current_date and challenge_id is null
               order by "time" limit 1),
    'winnersTime', (select "time" from submissions where day = current_date and challenge_id is null
               order by "time" limit 1));
end $$;

create function start_play() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  if played_today(n) then raise exception 'already played' using errcode = 'P0001'; end if;
  perform ensure_daily_word(current_date);
  insert into checkpoints (name, day, penalty, history)
  values (n, current_date, 0, '[]')
  on conflict (name) do update
    set day = excluded.day, penalty = 0, history = '[]', created_at = now()
    where checkpoints.day <> current_date;   -- idempotent: a second start never resets the clock
  return play_payload(n);
end $$;

create function save_checkpoint(p_penalty double precision, p_history jsonb) returns void
language sql volatile security definer set search_path = public as $$
  update checkpoints set penalty = p_penalty, history = p_history
  where name = require_me() and day = current_date
$$;

-- Re-rank today's daily submissions by time.
create function rerank_today() returns void
language sql volatile security definer set search_path = public as $$
  update submissions s set "rank" = r.rn
  from (select submission_id,
          row_number() over (order by "time", submission_id) as rn
        from submissions where day = current_date and challenge_id is null) r
  where s.submission_id = r.submission_id and s."rank" <> r.rn
$$;

create function submit_daily(
  p_time double precision, p_penalty double precision, p_playback jsonb,
  p_word text, p_paste text
) returns void
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  if played_today(n) then raise exception 'already played' using errcode = 'P0001'; end if;
  insert into submissions (name, "time", penalty, playback, word, paste)
  values (n, p_time, p_penalty, p_playback, p_word, p_paste);
  perform rerank_today();
end $$;

create function pending_challenge_ids(p_name text) returns setof integer
language sql stable security definer set search_path = public as $$
  select c.challenge_id from challenges c
  where c.created_at >= current_date
    and exists (select 1 from submissions s where s.challenge_id = c.challenge_id)
    and not exists (select 1 from submissions s
                    where s.challenge_id = c.challenge_id and s.name = p_name)
$$;

create function submit_challenge(
  p_challenge_id integer, p_time double precision, p_penalty double precision,
  p_playback jsonb, p_word text, p_paste text
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  insert into submissions (challenge_id, name, "time", penalty, playback, word, paste)
  values (p_challenge_id, n, p_time, p_penalty, p_playback, p_word, p_paste);
  return jsonb_build_object('pending_challenges',
    (select count(*) from pending_challenge_ids(n)));
end $$;

-- Winner of last week, computed lazily and memoised in `winners`.
create function week_start(d date) returns date
language sql immutable as $$ select date_trunc('week', d)::date $$;

create function last_week_winner() returns text
language plpgsql volatile security definer set search_path = public as $$
declare w date := week_start(current_date - 7); n text;
begin
  select name into n from winners where week = w;
  if n is null then
    select r ->> 'name' into n from jsonb_array_elements(week_scores(w)) r limit 1;
    if n is not null then
      insert into winners (week, name) values (w, n) on conflict do nothing;
    end if;
  end if;
  return n;
end $$;

-- Weekly leaderboard. Weeks before the current one keep the legacy product
-- score (geometric rank); the current week uses additive points:
-- 1st=4, 2nd=2, 3rd=1, then 1.1-0.1*rank floored at 0, no-show=0.
create function week_scores(p_week date) returns jsonb
language sql stable security definer set search_path = public as $$
  with params as (
    select week_start(p_week) as s,
           week_start(p_week) >= week_start(current_date) as is_new),
  subs as (
    select sb.day, sb.name, sb."time", sb.submission_id
    from submissions sb, params
    where sb.challenge_id is null and sb.day between params.s and params.s + 6),
  names as (select distinct name from subs),
  days as (select distinct day from subs),
  pen as (select day, least(300, max("time") + 120) as pt from subs group by day),
  grid as (
    select n.name, d.day, s.submission_id, s."time" is not null as played,
           coalesce(s."time", pen.pt) as round_time
    from names n cross join days d
    join pen on pen.day = d.day
    left join subs s on s.name = n.name and s.day = d.day),
  ranked as (
    select *, case when played then row_number() over (
      partition by day order by played desc, round_time, name) end as day_rank
    from grid),
  scored as (
    select name, day, round_time, submission_id, is_new,
      case when played then least(day_rank, 9) else 10 end as score,
      case when not played then 0 when day_rank = 1 then 4 when day_rank = 2 then 2
           when day_rank = 3 then 1 else greatest(0, 1.1 - 0.1 * day_rank) end as points
    from ranked, params),
  agg as (
    select name,
      jsonb_agg(jsonb_build_object(
        'day', day, 'time', round_time,
        'score', case when is_new then round(points::numeric, 1) else score end,
        'submission_id', submission_id) order by day) as days,
      round(sum(round_time))::int as total_time,
      case when bool_or(is_new) then round(sum(points)::numeric, 1)
           else round(exp(sum(ln(score))))::numeric end as total_score,
      bool_or(is_new) as is_new,
      sum(points) as pts, exp(sum(ln(score))) as prod
    from scored group by name)
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', name,
      'results', jsonb_build_object('days', days, 'totals',
        jsonb_build_object('time', total_time, 'score', total_score)))
    order by case when is_new then pts end desc nulls last,
             case when not is_new then prod end nulls last,
             total_time, name), '[]')
  from agg
$$;

create function weekly_page(p_week date) returns jsonb
language sql volatile security definer set search_path = public as $$
  select jsonb_build_object('players', week_scores(p_week))
$$;

create function daily_page(p_day date) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := require_me();
  mine boolean := played_today(n);
  is_today boolean := p_day = current_date;
  rows jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'submission_id', submission_id, 'name', name, 'time', "time",
      'penalty', penalty,
      'paste', case when is_today and not mine then '' else paste end)
    order by "rank"), '[]')
  into rows from submissions where day = p_day and challenge_id is null;
  return jsonb_build_object(
    'submissions', rows, 'is_today', is_today,
    'winner', case when is_today then coalesce(last_week_winner(), 'no winner') end);
end $$;

create function past_winners() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform last_week_winner();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'name', name, 'week', week::text) order by week desc) from winners), '[]');
end $$;

-- A submission's playback is hidden until you have played the same game.
create function get_playback(p_id bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select s.playback from submissions s
  where s.submission_id = p_id and (
    case when s.challenge_id is null
      then s.day <> current_date or played_today(me())
      else exists (select 1 from submissions m
                   where m.challenge_id = s.challenge_id and m.name = me())
    end)
$$;

create function player_stats(p_name text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select "time" as t, penalty, "rank", day from submissions
    where name = p_name and challenge_id is null),
  edges as (select array[0,5,10,15,20,30,40,50,60,80,100,120,180,240,300,360,
                         420,480,540,600,1200] as e)
  select jsonb_build_object(
    'total', (select count(*) from mine),
    'rank', coalesce((select jsonb_agg(jsonb_build_object('bucket', "rank", 'count', c)
              order by "rank") from (select "rank", count(*) c from mine group by 1) x), '[]'),
    'penalty', coalesce((select jsonb_agg(jsonb_build_object('bucket', penalty, 'count', c)
              order by penalty) from (select penalty, count(*) c from mine group by 1) x), '[]'),
    'time', coalesce((select jsonb_agg(jsonb_build_object('bucket', e[b], 'count', c)
              order by b) from edges, (select width_bucket(t, (select e from edges)) b,
              count(*) c from mine group by 1) x where e[b] is not null), '[]'),
    'week', coalesce((select jsonb_agg(jsonb_build_object(
              'week', w, 'time', at, 'penalty', ap, 'rank', ar) order by w)
            from (select date_trunc('week', day)::date w, avg(t) at, avg(penalty) ap,
                         avg("rank") ar from mine group by 1) x), '[]'))
$$;

-- Power rankings: exponentially recency-weighted finishing positions over a
-- rolling 30-day window, sampled every 3 days.
create function rankings() returns jsonb
language sql stable security definer set search_path = public as $$
  with matches as (
    select name, day, row_number() over (partition by day order by "time" desc) as score
    from submissions where challenge_id is null),
  days as (select distinct least(current_date, day + 30) as end_day from matches),
  ranges as (
    select end_day, end_day + o as day from days, generate_series(-30, 0) o
    where (end_day - current_date) % 3 = 0),
  recently_played as (
    select name from matches where day > current_date - 30
    group by 1 having count(*) > 8),
  name_days as (
    select distinct m.name, m.day + o as end_day
    from recently_played rp join matches m using (name), generate_series(0, 10) o),
  scores as (
    select m.name, nd.end_day as day,
           sum(m.score * (32 - (nd.end_day - m.day))) as score
    from name_days nd join ranges r using (end_day) join matches m
      on m.name = nd.name and m.day = r.day
    group by 1, 2),
  ranks as (
    select name, day, (row_number() over (partition by day order by score desc))::int as rank
    from scores)
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'day', days, 'rank', rks)
           order by last_rank desc nulls first), '[]')
  from (
    select r.name, array_agg(r.day order by r.day) as days,
           array_agg(r.rank order by r.day) as rks,
           min(r.rank) filter (where r.day = current_date) as last_rank
    from ranks r group by r.name) q
$$;

-- Challenges ----------------------------------------------------------------

create function challenges_page() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n text := require_me(); res jsonb;
begin
  with c as (
    select challenge_id, answer, created_at >= current_date as is_today
    from challenges where created_at >= current_date - 1),
  s as (
    select c.challenge_id, c.answer, c.is_today, sb.name, sb."time",
           count(*) over (partition by c.challenge_id) as player_count
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
      'challenge_id', s.challenge_id, 'answer', s.answer, 'time', s."time",
      'winner', jsonb_build_object('name', w.winner, 'time', w.wtime),
      'players', coalesce((select jsonb_agg(o.name order by o.name) from s o
          where o.challenge_id = s.challenge_id and o.name <> n and o.name <> w.winner),
          '[]')) order by s.challenge_id desc) as h
    from s join win w using (challenge_id)
    where s.is_today and s.name = n)
  select jsonb_build_object(
    'today_leaderboard', coalesce((select lb from boards where is_today), '[]'),
    'yesterday_leaderboard', coalesce((select lb from boards where not is_today), '[]'),
    'history', coalesce((select h from hist), '[]'),
    'pending_challenges', (select count(*) from pending_challenge_ids(n)))
  into res;
  return res;
end $$;

create function challenge_next() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me(); cid integer;
begin
  select ch.challenge_id into cid from challenges ch
    where ch.challenge_id in (select pending_challenge_ids(n))
    order by ch.created_at limit 1;
  if cid is null then
    insert into challenges (starting_word, answer)
    values ((select word from words order by random() limit 1),
            (select answer from answers order by random() limit 1))
    returning challenge_id into cid;
  end if;
  return cid;
end $$;

create function challenge_play(p_id integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'starting_word', upper(c.starting_word), 'answer', upper(c.answer),
    'already_played', exists (select 1 from submissions s
        where s.challenge_id = c.challenge_id and s.name = me()),
    'leader', (select jsonb_build_object('name', s.name, 'time', s."time")
        from submissions s where s.challenge_id = c.challenge_id
        order by s."time" limit 1))
  from challenges c where c.challenge_id = p_id
$$;

create function challenge_page(p_id integer) returns jsonb
language sql stable security definer set search_path = public as $$
  with played as (
    select exists (select 1 from submissions
                   where challenge_id = p_id and name = me()) as p)
  select jsonb_build_object('played', played.p, 'submissions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'submission_id', submission_id, 'name', name, 'time', "time", 'penalty', penalty,
      'paste', case when played.p then paste else '' end) order by "time")
    from submissions where challenge_id = p_id), '[]'))
  from played
$$;

-- Messages ------------------------------------------------------------------

create function messages_page() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me();
begin
  insert into message_reads (name, last_read) values (n, now())
  on conflict (name) do update set last_read = now();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'message_id', message_id, 'name', name, 'message', message,
      'created_at', created_at, 'likes', likes) order by created_at desc)
    from messages where created_at >= now() - interval '1 month'), '[]');
end $$;

create function post_message(p_message text) returns void
language sql volatile security definer set search_path = public as $$
  insert into messages (name, message) values (require_me(), p_message)
$$;

create function delete_message(p_id integer) returns void
language sql volatile security definer set search_path = public as $$
  delete from messages where message_id = p_id and name = require_me()
$$;

create function like_message(p_id integer) returns void
language sql volatile security definer set search_path = public as $$
  update messages set likes = array_append(likes, require_me())
  where message_id = p_id and not (require_me() = any (likes))
$$;

-- Battles -------------------------------------------------------------------

create function new_battle_state(p_round integer default 1, p_leaderboard jsonb default '{}',
                                 p_history jsonb default '[]') returns jsonb
language sql volatile set search_path = public as $$
  select jsonb_build_object(
    'history', '[]'::jsonb,
    'game', jsonb_build_object(
      'starting_word', (select word from words order by random() limit 1),
      'answer', (select answer from answers order by random() limit 1)),
    'round', p_round, 'round_id', gen_random_uuid()::text, 'version', 0,
    'leaderboard', p_leaderboard, 'battle_history', p_history)
$$;

create function battle_home() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'users', p.users, 'updated_at', p.updated_at,
    'active_battles', coalesce((select jsonb_agg(jsonb_build_object(
        'battle_id', battle_id, 'users', users) order by updated_at desc)
      from battles where updated_at > now() - interval '20 seconds'
        and jsonb_array_length(users) > 0 and battle_id <> 7), '[]'))
  from battles p where p.battle_id = 7
$$;

create function new_battle() returns integer
language sql volatile security definer set search_path = public as $$
  insert into battles (state) values (new_battle_state()) returning battle_id
$$;

create function battle_is_active(b battles) returns boolean
language sql stable as $$
  select b.updated_at > now() - interval '35 seconds' and jsonb_array_length(b.users) > 0
$$;

create function battle_get(p_id integer) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare b battles; st jsonb;
begin
  select * into b from battles where battle_id = p_id;
  if not found then return null; end if;
  if b.state -> 'game' ->> 'answer' is null then
    update battles set state = new_battle_state() where battle_id = p_id returning * into b;
  end if;
  st := b.state;
  if not battle_is_active(b) then
    st := st || '{"leaderboard":{},"battle_history":[]}';
  end if;
  return jsonb_build_object('state', st, 'users', b.users, 'updated_at', b.updated_at);
end $$;

create function battle_restart(p_id integer) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare b battles; st jsonb;
begin
  perform require_me();
  select * into b from battles where battle_id = p_id for update;
  if not found then return null; end if;
  st := new_battle_state(
    coalesce((b.state ->> 'round')::int, 1) + 1,
    case when battle_is_active(b) then coalesce(b.state -> 'leaderboard', '{}') else '{}' end,
    case when battle_is_active(b) then coalesce(b.state -> 'battle_history', '[]') else '[]' end);
  update battles set state = st, updated_at = now() where battle_id = p_id;
  return st;
end $$;

-- Lock down: only signed-in users may call the RPC surface.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function handle_new_user() from authenticated;
