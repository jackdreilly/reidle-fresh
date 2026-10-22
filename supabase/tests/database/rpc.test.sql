begin;
select plan(91);

-- Fixture: isolated players, no seed dependence.
truncate submissions, checkpoints, messages, message_reads, winners, week_snapshots, challenges, players restart identity cascade;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-00000000000' || i)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', n || '@t.t', jsonb_build_object('name', n)
from unnest(array['ann','ben','cat','dan','eve']) with ordinality t(n, i);

-- name-only sign-ups start in Reidle Global; this fixture plays in the founding league
update league_members set league_id = 1 where league_id = 2;

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
-- act as a player with the client's league header
create function act_in(p_name text, p_league bigint) returns void language plpgsql as $$
begin
  perform public.act_as(p_name);
  perform set_config('request.headers', json_build_object('x-league', p_league::text)::text, true);
end $$;

select is((select count(*)::int from players), 5, 'auth trigger links a player per auth user');

-- The callable surface is an explicit allowlist (internal helpers must stay private)
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname not in ('act_as', 'act_in', 'reset_role', 'uid_of')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['battle_get','battle_home','battle_restart','bootstrap','challenge_next','challenge_page',
        'challenge_play','challenges_page','create_league','daily_page','delete_message','get_playback',
        'join_league','league_page','league_preview','leagues_page','leave_league','like_message',
        'messages_page','new_battle','nickname_free','past_page','past_winners','play_state','player_stats',
        'post_message','push_subscribe','push_unsubscribe','rankings','save_checkpoint','set_member',
        'set_nickname','set_notify_prefs','settings_page','start_play','submit_challenge','submit_daily',
        'update_league','weekly_page']::text[],
  'authenticated can execute exactly the RPC allowlist');
select is((select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname not in ('act_as', 'act_in', 'reset_role', 'uid_of')
            and has_function_privilege('anon', p.oid, 'execute')), 1, 'anon can execute nothing but league_preview');
select ok(has_function_privilege('anon', 'public.league_preview(text)', 'execute'), 'anon may preview an invite link');
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

-- Additive weekly scoring (current week): 40/20/10 then 7, 6, no-show 0
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
select is((select (r #>> '{results,totals,score}')::int from wk where r->>'name'='ann'), 40, '1st = 40 points');
select is((select (r #>> '{results,totals,score}')::int from wk where r->>'name'='ben'), 20, '2nd = 20 points');
select is((select (r #>> '{results,totals,score}')::int from wk where r->>'name'='cat'), 10, '3rd = 10 points');
select is((select (r #>> '{results,totals,score}')::int from wk where r->>'name'='dan'), 7, '4th = 7');
select is((select (r #>> '{results,totals,score}')::int from wk where r->>'name'='eve'), 6, '5th = 6');
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
select act_as('ben');
select is((select (h ->> 'wins')::int from jsonb_array_elements(past_page(null) -> 'hall') h where h ->> 'name' = 'ann'),
  1, 'past_page hall of fame counts weekly titles');

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
select act_as('dan');
select is(past_page(null) -> 'days' -> 0 ->> 'answer', null, 'past_page hides today''s answer before playing');
select is(past_page(null) -> 'days' -> 0 ->> 'winner', 'cat', 'past_page still shows today''s leader');
select act_as('ben');
select isnt(past_page(null) -> 'days' -> 0 ->> 'answer', null, 'past_page shows today''s answer after playing');

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
select ensure_daily_word(1, date '2040-01-01' + i) from generate_series(0, 59) i;
select is((select count(*)::int from daily_words where day >= '2040-01-01' and word = answer), 0, 'generated daily words never start on the answer');
select is((select count(*)::int from daily_words where day >= '2040-01-01'), 60, '60 daily words were generated');
select act_as('cat');
select challenge_next() from generate_series(1, 60);
select reset_role();
select is((select count(*)::int from challenges where starting_word = answer), 0, 'generated challenges never start on the answer');

-- Challenges: open list, answer hidden until played, shell badge count
select act_as('ann');
select submit_challenge(challenge_next(), 30, 0, '{"events":[]}', 'x', '');
select act_as('ben');
select is(challenges_page() -> 'open' -> 0 ->> 'set_by', 'ann', 'open challenges say who set them');
select is((bootstrap() ->> 'pending_challenges')::int, jsonb_array_length(challenges_page() -> 'open'),
  'bootstrap badge count matches the open list');
select ok(challenge_page((challenges_page() -> 'open' -> 0 ->> 'challenge_id')::int) ->> 'answer' is null,
  'a challenge answer stays hidden until you play it');
select submit_challenge((challenges_page() -> 'open' -> 0 ->> 'challenge_id')::int, 40, 0, '{"events":[]}', 'x', '');
select ok(challenge_page((challenges_page() -> 'history' -> 0 ->> 'challenge_id')::int) ->> 'answer' is not null,
  'the answer is shown once played');
select is(challenges_page() -> 'history' -> 0 ->> 'rank', '2', 'history has your place');
select is(challenges_page() -> 'history' -> 0 ->> 'player_count', '2', 'history has the player count');
select is((bootstrap() ->> 'pending_challenges')::int, 0, 'nothing left open after playing it');
select reset_role();

-- Messages: only the author can delete
select act_as('ann');
select post_message('hello');
select act_as('ben');
select delete_message(1);
select reset_role();
select is((select count(*)::int from messages), 1, 'cannot delete someone else''s message');

-- Leagues ------------------------------------------------------------------------------------------------------
select reset_role();
insert into leagues (league_id, name, tz, reset_hour) values (50, 'Clock', 'UTC', 18), (51, 'Early', 'UTC', 6);
select is(league_day(50, '2026-10-21 17:00Z'), date '2026-10-21', 'evening reset: before it, still today');
select is(league_day(50, '2026-10-21 19:00Z'), date '2026-10-22', 'evening reset: after it, tomorrow''s word');
select is(league_reset_at(50, '2026-10-21 17:00Z'), '2026-10-21 18:00Z'::timestamptz, 'next reset time');
select is(league_day(51, '2026-10-21 05:00Z'), date '2026-10-20', 'morning reset: before it, still yesterday');
select is(league_day(51, '2026-10-21 07:00Z'), date '2026-10-21', 'morning reset: after it, today');

select act_in('ann', 1);
create temp table pals on commit drop as select create_league('Pals', 'UTC', 0) as id;
grant select on pals to authenticated;
select reset_role();
create temp table pals_code on commit drop as select invite_code from leagues where league_id = (select id from pals);
grant select on pals_code to authenticated;
select reset_role();
select is((select role from league_members where league_id = (select id from pals) and name = 'ann'), 'commissioner',
  'the creator is commissioner');
select act_as('ben');
select is(join_league((select invite_code from pals_code)), (select id from pals),
  'joining by invite code');
select throws_ok($$select join_league('nope')$$, 'P0002', null, 'unknown invite code');

-- the header picks the league; a league you are not in is ignored
select reset_role();
delete from submissions where day = current_date; delete from checkpoints;
select act_in('ann', (select id from pals));
select is((bootstrap() -> 'league' ->> 'id')::bigint, (select id from pals), 'x-league selects the league');
select ok(start_play() ->> 'word' is not null, 'start a game in the new league');
select submit_daily(30, 0, '{"events":[]}', 'x', 'p');
select reset_role();
select is((select count(*)::int from daily_words where league_id = (select id from pals)), 1, 'the league has its own daily word');
select act_in('ann', 1);
select is((bootstrap() ->> 'played_today')::boolean, false, 'playing one league leaves the others to play');
select is(jsonb_array_length(daily_page(current_date) -> 'submissions'), 0, 'results stay in their league');
select reset_role();
create temp table annsub on commit drop as
  select submission_id from submissions where name = 'ann' and league_id = (select id from pals);
grant select on annsub to authenticated;
select act_in('cat', (select id from pals));
select is((bootstrap() -> 'league' ->> 'id')::bigint, 1::bigint, 'a league you are not in falls back to your own');
select is(get_playback((select submission_id from annsub)),
  null, 'playbacks stay in their league');

-- commissioner scoring
select act_in('ben', (select id from pals));
select throws_ok($$select update_league('{"name":"Mine"}')$$, '42501', null, 'members cannot change settings');
select submit_daily(40, 0, '{"events":[]}', 'x', 'p');
select act_in('ann', (select id from pals));
select update_league('{"scoring":{"mode":"table","points":[25,18]}}');
select is((weekly_page(current_date) -> 'players' -> 1 #>> '{results,totals,score}')::int, 18, 'custom points table');
select update_league('{"scoring":{"mode":"field"}}');
select is((weekly_page(current_date) -> 'players' -> 0 #>> '{results,totals,score}')::int, 2, 'field: 1 + players beaten');
select throws_ok($$select update_league('{"scoring":{"mode":"weird"}}')$$, '22023', null, 'scoring is validated');
select throws_ok($$select update_league('{"tz":"Mars/Base"}')$$, '22023', null, 'timezone is validated');
select is(update_league('{"name":"Pals II"}') ->> 'name', 'Pals II', 'commissioner renames the league');
select is(jsonb_array_length(leagues_page()), 2, 'dashboard lists every league');
select is((select (j ->> 'played')::boolean from jsonb_array_elements(leagues_page()) j where (j ->> 'id')::bigint = 1),
  false, 'dashboard: still to play in the founding league');

-- guests: auto nickname, start in Global, can't join private leagues
select reset_role();
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', null, true, '{}');
select ok((select valid_nickname(name) and not nickname_set from players
           where user_id = '00000000-0000-0000-0000-0000000000f9'), 'guests get an auto nickname to change later');
select is((select array_agg(league_id) from league_members m join players p using (name)
           where p.user_id = '00000000-0000-0000-0000-0000000000f9'), array[2::bigint], 'guests start in Reidle Global');
select reset_role();
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}', true);
set local role authenticated;
select is(bootstrap() ->> 'account', 'guest', 'bootstrap says guest');
select throws_ok(format('select join_league(%L)', (select invite_code from pals_code)), '28000', null,
  'guests cannot join private leagues');
select is(join_league('global'), 2::bigint, 'anyone can join Global');

-- nicknames
select act_as('ben');
select throws_ok($$select set_nickname('Bad Name!')$$, '22023', null, 'nicknames are validated');
select throws_ok($$select set_nickname('cat')$$, '23505', null, 'nicknames are unique');
select ok(nickname_free('benny'), 'nickname_free as you type');
select set_nickname('benny');
select reset_role();
select is((select count(*)::int from submissions where name = 'ben'), 0, 'a rename follows every reference');
select ok((select count(*) from submissions where name = 'benny') > 0 and is_member(1, 'benny'), 'history and leagues move to the new name');

-- leaving hands over the commissioner role
select act_in('ann', (select id from pals));
select leave_league((select id from pals));
select reset_role();
select is((select role from league_members where league_id = (select id from pals) and name = 'benny'), 'commissioner',
  'the last commissioner leaving promotes the next member');

-- bans: out, and the invite link no longer lets them back in
select reset_role();
select act_in('benny', (select id from pals));
select is(set_member('cat', 'ban') -> 'banned', '["cat"]'::jsonb, 'the commissioner bans a player and sees the ban list');
select act_as('cat');
select throws_ok(format('select join_league(%L)', (select invite_code from pals_code)), '42501', null,
  'a banned player can''t rejoin by invite link');
select reset_role();
select act_in('benny', (select id from pals));
select is(set_member('cat', 'unban') -> 'banned', '[]'::jsonb, 'unban');
select act_as('cat');
select is(join_league((select invite_code from pals_code)), (select id from pals), 'unbanned: the link works again');
select reset_role();
select act_in('cat', (select id from pals));
select is(league_page() -> 'banned', 'null'::jsonb, 'only commissioners see the ban list');

select * from finish();
rollback;
