-- Jack can take words out of the answers pool from /admin (Jack, 2026-10-30: "Add an admin ui where I can remove
-- words from answers pool"). A removed word stays in `answers` (past daily_words and challenges reference it) but
-- is never drawn again: every random pick goes through random_answer(). Removing only affects future draws, so
-- today's word (already in daily_words) stays as it is.

alter table answers add column removed_at timestamptz;

-- One random answer still in the pool. If every word were removed, falls back to the whole list rather than null.
create function random_answer() returns text
language sql volatile set search_path = public as $$
  select coalesce((select answer from answers where removed_at is null order by random() limit 1),
                  (select answer from answers order by random() limit 1))
$$;

create or replace function ensure_daily_word(p_league bigint, p_day date) returns daily_words
language plpgsql security definer set search_path = public as $$
declare r daily_words; a text;
begin
  select * into r from daily_words where league_id = p_league and day = p_day;
  if not found then
    a := random_answer();
    insert into daily_words (league_id, day, word, answer)
    values (p_league, p_day, (select word from words where word <> a order by random() limit 1), a)
    on conflict (league_id, day) do nothing;
    select * into r from daily_words where league_id = p_league and day = p_day;
  end if;
  return r;
end $$;

create or replace function challenge_next() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := require_me();
  l bigint := require_league();
  cid integer; a text;
begin
  select ch.challenge_id into cid from challenges ch
    where ch.challenge_id in (select pending_challenge_ids(n))
    order by ch.created_at limit 1;
  if cid is null then
    a := random_answer();
    insert into challenges (league_id, day, starting_word, answer)
    values (l, league_day(l), (select word from words where word <> a order by random() limit 1), a)
    returning challenge_id into cid;
  end if;
  return cid;
end $$;

create or replace function new_battle_state(p_round integer default 1, p_leaderboard jsonb default '{}',
                                            p_history jsonb default '[]') returns jsonb
language sql volatile set search_path = public as $$
  with a as (select random_answer() as answer)
  select jsonb_build_object(
    'history', '[]'::jsonb,
    'game', jsonb_build_object(
      'starting_word', (select w.word from words w where w.word <> a.answer order by random() limit 1),
      'answer', a.answer),
    'round', p_round, 'round_id', gen_random_uuid()::text, 'version', 0,
    'leaderboard', p_leaderboard, 'battle_history', p_history)
  from a
$$;

-- Every answer with whether it's removed and how often it has been a daily word (any league).
create function admin_answers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'active', (select count(*) from answers where removed_at is null),
    'words', (select coalesce(jsonb_agg(jsonb_build_object('word', a.answer, 'removed_at', a.removed_at, 'days', coalesce(d.n, 0))
                                        order by a.answer), '[]')
              from answers a left join (select answer, count(*) n from daily_words group by answer) d using (answer)));
end $$;

-- Takes a word out of the pool (p_removed true) or puts it back.
create function admin_set_answer(p_word text, p_removed boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r answers;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update answers set removed_at = case when p_removed then coalesce(removed_at, now()) end
    where answer = p_word returning * into r;
  if not found then raise exception 'not an answer: %', p_word using errcode = '22023'; end if;
  return jsonb_build_object('word', r.answer, 'removed_at', r.removed_at,
                            'active', (select count(*) from answers where removed_at is null));
end $$;

revoke all on function random_answer() from public, anon, authenticated;
revoke all on function admin_answers(), admin_set_answer(text, boolean) from public, anon;
grant execute on function admin_answers(), admin_set_answer(text, boolean) to authenticated;
