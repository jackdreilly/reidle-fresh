begin;
select plan(40);

-- Fixture: isolated players, no seed dependence.
truncate submissions, checkpoints, messages, message_reads, winners, challenges, players restart identity cascade;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || i)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', n || '@t.t', jsonb_build_object('name', n)
from unnest(array['ann','ben','cat','dan','eve']) with ordinality t(n, i);

create function uid_of(p_name text) returns uuid language sql security definer as
  $$ select user_id from public.players where name = p_name $$;
create function act_as(p_name text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', public.uid_of(p_name), 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function reset_role() returns void language sql as $$ reset role $$;

select is((select count(*)::int from players), 5, 'auth trigger links a player per auth user');

-- The callable surface is an explicit allowlist (internal helpers must stay private)
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname not in ('act_as', 'reset_role', 'uid_of')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['battle_get','battle_home','battle_restart','bootstrap','challenge_next','challenge_page',
        'challenge_play','challenges_page','daily_page','delete_message','get_playback','like_message',
        'messages_page','new_battle','past_winners','play_state','player_stats','post_message',
        'rankings','save_checkpoint','start_play','submit_challenge','submit_daily','weekly_page']::text[],
  'authenticated can execute exactly the RPC allowlist');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname not in ('act_as', 'reset_role', 'uid_of')
            and has_function_privilege('anon', p.oid, 'execute')), 0, 'anon can execute nothing');
select throws_ok($$set local role authenticated; select public.play_payload('x')$$, '42501', null,
  'helpers are not callable (play_payload would leak the answer)');
reset role;

-- Tables are closed to clients except battles
set local role authenticated;
select throws_ok($$select * from public.submissions$$, '42501', null, 'authenticated cannot read tables directly');
select throws_ok($$select * from public.players$$, '42501', null, 'players table is closed');
reset role;
set local role anon;
select throws_ok($$select public.bootstrap()$$, '42501', null, 'anon cannot call RPCs');
reset role;

-- Additive weekly scoring (current week): 4/2/1 then 0.7, 0.6, no-show 0
select reset_role();
insert into submissions (day, name, "time", word, paste) values
  (date_trunc('week', current_date)::date, 'ann', 30, 'x', 'p'),
  (date_trunc('week', current_date)::date, 'ben', 40, 'x', 'p'),
  (date_trunc('week', current_date)::date, 'cat', 50, 'x', 'p'),
  (date_trunc('week', current_date)::date, 'dan', 60, 'x', 'p'),
  (date_trunc('week', current_date)::date, 'eve', 70, 'x', 'p');
select act_as('ann');
create temp table wk on commit drop as select jsonb_array_elements(weekly_page(current_date) -> 'players') r;
grant all on wk to authenticated;
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='ann'), 4.0, '1st = 4 points');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='ben'), 2.0, '2nd = 2 points');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='cat'), 1.0, '3rd = 1 point');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='dan'), 0.7, '4th = 0.7');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='eve'), 0.6, '5th = 0.6');
select is((select r->>'name' from wk limit 1), 'ann', 'highest total ranks first');

-- Scoring cutover: weeks from 2026-10-05 are additive, earlier weeks are legacy and FROZEN.
select reset_role();
insert into submissions (day, name, "time", word, paste) values
  ('2026-09-28', 'ann', 30, 'x', 'p'),
  ('2026-09-28', 'ben', 40, 'x', 'p'),
  ((date_trunc('week', current_date) - interval '7 days')::date, 'ann', 30, 'x', 'p'),
  ((date_trunc('week', current_date) - interval '7 days')::date, 'ben', 40, 'x', 'p')
on conflict do nothing;  -- "last week" may coincide with the fixed legacy week above
select act_as('ann');
select is((weekly_page('2026-09-28') ->> 'additive')::boolean, false, 'weeks before 2026-10-05 use legacy scoring');
select is((weekly_page('2026-10-05') ->> 'additive')::boolean, true, 'the cutover week (2026-10-05) is additive');
select is((weekly_page(current_date) ->> 'additive')::boolean, true, 'the current week is additive');
select is((weekly_page('2026-09-28') -> 'players' -> 0 #>> '{results,totals,score}')::numeric, 1::numeric, 'legacy: winner product score = 1');
create temp table frozen on commit drop as select weekly_page('2026-09-28') as page;
grant select on frozen to authenticated;
-- history is immutable: even if the underlying rows changed, a legacy week never re-scores
select reset_role();
update submissions set "time" = 999 where name = 'ann' and day = '2026-09-28';
select is((select count(*)::int from week_snapshots where week = '2026-09-28'), 1, 'legacy week was frozen into week_snapshots');
select act_as('ann');
select is(weekly_page('2026-09-28'), (select page from frozen), 'legacy weeks are read-only: results survive source changes');
select is((past_winners() -> 0 ->> 'name'), 'ann', 'last week winner is computed and memoised');
select reset_role();
select is((select name from winners order by week desc limit 1), 'ann', 'winner persisted');

-- Daily submit: once per day, ranks recomputed, validation
select reset_role();
delete from submissions;
select act_as('ben');
select lives_ok($$select submit_daily(55, 0, '{"events":[]}', 'crate', 'pp')$$, 'submit_daily works');
select throws_ok($$select submit_daily(10, 0, '{"events":[]}', 'crate', 'pp')$$, 'P0001', 'already played', 'cannot play twice');
select act_as('cat');
select submit_daily(20, 0, '{"events":[]}', 'crate', 'pp');
select reset_role();
select is((select "rank" from submissions where name = 'ben'), 2, 'ranks are recomputed on submit');
select act_as('cat');
select act_as('dan');
select throws_ok($$select submit_daily(-1, 0, '{"events":[]}', 'crate', 'pp')$$, '23514', null, 'negative time rejected');

-- Anti-peeking: today's paste/playback hidden until you have played
select reset_role();
create temp table ids on commit drop as select name, submission_id from submissions;
grant select on ids to authenticated;
select act_as('dan');
select is((select (daily_page(current_date) -> 'submissions' -> 0 ->> 'paste')), '', 'paste hidden before playing');
select is(get_playback((select submission_id from ids where name = 'ben')), null, 'playback hidden before playing');
select act_as('ben');
select isnt(get_playback((select submission_id from ids where name = 'cat')), null, 'playback visible after playing');

-- Play start is explicit: reads never start the clock or reveal the word
select reset_role();
delete from submissions; delete from checkpoints;
select act_as('eve');
select is((play_state() ->> 'started')::boolean, false, 'play_state before start: not started');
select is(play_state() ->> 'word', null, 'play_state never reveals the word before start');
select is(play_state() ->> 'word', null, 'repeated reads (prefetch/reload) still reveal nothing');
select reset_role();
select is((select count(*)::int from checkpoints), 0, 'reading play_state creates no checkpoint');
select act_as('eve');
select ok(start_play() ->> 'word' is not null, 'start_play reveals the word');
select reset_role();
select is((select count(*)::int from checkpoints where name = 'eve'), 1, 'start_play records the start');
select act_as('eve');
select is((start_play() #>> '{checkpoint,created_at}'), (play_state() #>> '{checkpoint,created_at}'), 'a second start never resets the clock');
select act_as('eve');
select ok((play_state() ->> 'server_now')::timestamptz is not null, 'server_now is returned for skew correction');
select reset_role();
delete from checkpoints;

-- A game's starting word never equals its answer (instant-win guard)
select reset_role();
select ensure_daily_word(date '2040-01-01' + i) from generate_series(0, 59) i;
select is((select count(*)::int from daily_words where day >= '2040-01-01' and word = answer), 0, 'generated daily words never start on the answer');
select is((select count(*)::int from daily_words where day >= '2040-01-01'), 60, '60 daily words were generated');
select act_as('cat');
select challenge_next() from generate_series(1, 60);
select reset_role();
select is((select count(*)::int from challenges where starting_word = answer), 0, 'generated challenges never start on the answer');

-- Messages: only the author can delete
select act_as('ann');
select post_message('hello');
select act_as('ben');
select delete_message(1);
select reset_role();
select is((select count(*)::int from messages), 1, 'cannot delete someone else''s message');

select * from finish();
rollback;
