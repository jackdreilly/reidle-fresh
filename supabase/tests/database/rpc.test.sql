begin;
select plan(29);

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
create temp table wk on commit drop as select jsonb_array_elements(week_scores(current_date)) r;
grant all on wk to authenticated;
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='ann'), 4.0, '1st = 4 points');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='ben'), 2.0, '2nd = 2 points');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='cat'), 1.0, '3rd = 1 point');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='dan'), 0.7, '4th = 0.7');
select is((select (r #>> '{results,totals,score}')::numeric from wk where r->>'name'='eve'), 0.6, '5th = 0.6');
select is((select r->>'name' from wk limit 1), 'ann', 'highest total ranks first');

-- Legacy weeks keep the geometric product score
select reset_role();
insert into submissions (day, name, "time", word, paste) values
  ((date_trunc('week', current_date) - interval '7 days')::date, 'ann', 30, 'x', 'p'),
  ((date_trunc('week', current_date) - interval '7 days')::date, 'ben', 40, 'x', 'p');
select act_as('ann');
select is((select (jsonb_array_elements(week_scores(current_date - 7)) #>> '{results,totals,score}')::numeric limit 1), 1::numeric, 'legacy: winner product score = 1');
select is(last_week_winner(), 'ann', 'last week winner is computed and memoised');
select reset_role();
select is((select name from winners), 'ann', 'winner persisted');

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

-- Messages: only the author can delete
select act_as('ann');
select post_message('hello');
select act_as('ben');
select delete_message(1);
select reset_role();
select is((select count(*)::int from messages), 1, 'cannot delete someone else''s message');

select * from finish();
rollback;
