-- A game's forced starting word must never equal its answer (it would be an instant, 0-second win).
-- Pick the answer first, then a different starting word. create or replace keeps existing grants.
create or replace function ensure_daily_word(p_day date) returns daily_words
language plpgsql security definer set search_path = public as $$
declare r daily_words; a text;
begin
  select * into r from daily_words where day = p_day;
  if not found then
    a := (select answer from answers order by random() limit 1);
    insert into daily_words (day, word, answer)
    values (p_day, (select word from words where word <> a order by random() limit 1), a)
    on conflict (day) do nothing;
    select * into r from daily_words where day = p_day;
  end if;
  return r;
end $$;

create or replace function challenge_next() returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n text := require_me(); cid integer; a text;
begin
  select ch.challenge_id into cid from challenges ch
    where ch.challenge_id in (select pending_challenge_ids(n))
    order by ch.created_at limit 1;
  if cid is null then
    a := (select answer from answers order by random() limit 1);
    insert into challenges (starting_word, answer)
    values ((select word from words where word <> a order by random() limit 1), a)
    returning challenge_id into cid;
  end if;
  return cid;
end $$;

create or replace function new_battle_state(p_round integer default 1, p_leaderboard jsonb default '{}',
                                            p_history jsonb default '[]') returns jsonb
language sql volatile set search_path = public as $$
  with a as (select answer from answers order by random() limit 1)
  select jsonb_build_object(
    'history', '[]'::jsonb,
    'game', jsonb_build_object(
      'starting_word', (select w.word from words w where w.word <> a.answer order by random() limit 1),
      'answer', a.answer),
    'round', p_round, 'round_id', gen_random_uuid()::text, 'version', 0,
    'leaderboard', p_leaderboard, 'battle_history', p_history)
  from a
$$;
