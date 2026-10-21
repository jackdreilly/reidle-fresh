begin;
select plan(14);

truncate messages, push_subscriptions, push_outbox, push_jobs, notify_prefs restart identity cascade;
delete from submissions where day >= current_date - 1;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'na@t.t', '{"name":"nota"}'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nb@t.t', '{"name":"notb"}'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nc@t.t', '{"name":"notc"}');
-- name-only sign-ups start in Reidle Global; these tests are about the founding league
update league_members set league_id = 1 where league_id = 2;
insert into push_subscriptions (endpoint, name, subscription) values
  ('https://push.example/a', 'nota', '{"endpoint":"https://push.example/a"}'),
  ('https://push.example/b', 'notb', '{"endpoint":"https://push.example/b"}'),
  ('https://push.example/c', 'notc', '{"endpoint":"https://push.example/c"}');

-- settings: defaults, then partial saves
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is(settings_page() -> 'prefs',
  '{"chat":true,"results":false,"beaten":false,"challenges":false,"new_day":false,"recap":false,"reminder_before":null}'::jsonb,
  'only chat is on until you opt in');
select is(set_notify_prefs('{"beaten":true,"reminder_before":3}') ->> 'reminder_before', '3', 'saves the keys given');
select is(set_notify_prefs('{"chat":false}') -> 'beaten', 'true'::jsonb, 'keeps the keys not given');
select throws_ok($$select * from notify_prefs$$, '42501', null, 'prefs table is closed');
select throws_ok($$select push_tick()$$, '42501', null, 'clients cannot run the scheduler');
reset role;
-- notb wants results, notc wants new day + recap + challenges
insert into notify_prefs (name, results) values ('notb', true);
insert into notify_prefs (name, new_day, recap, challenges) values ('notc', true, true, true);

-- chat: nota turned chat off
insert into messages (name, message) values ('notb', '/gif cats');
select is((select array_agg(body || ':' || array_to_string(recipients, ',')) from push_outbox), array['sent a GIF:notc'],
  'chat skips the author and anyone who turned chat off');
truncate push_outbox;

-- daily: nota plays first, notb then beats nota and takes 1st
insert into submissions (name, "time", word) values ('nota', 50.25, 'x');
select is((select array_agg(title || ' | ' || body || ' > ' || array_to_string(recipients, ',')) from push_outbox),
  array['nota finished today''s Reidle | 50.3s · 1st of 1 so far > notb'], 'results go to who asked for them');
truncate push_outbox;
insert into submissions (name, "time", word) values ('notb', 64.5, 'x'), ('notc', 41, 'x');
select is((select array_agg(title || ' | ' || body || ' > ' || array_to_string(recipients, ',') order by id) from push_outbox),
  array['👑 notc took 1st place from you | 41.0s vs your 50.3s > nota'],
  'a beaten player hears about it once (and notb''s second result waits out its cooldown)');
truncate push_outbox;

-- challenges
insert into challenges (starting_word, answer) select (select word from words limit 1), (select answer from answers limit 1);
insert into submissions (name, "time", word, challenge_id) values ('notc', 30, 'x', (select max(challenge_id) from challenges));
insert into submissions (name, "time", word, challenge_id) values ('nota', 20, 'x', (select max(challenge_id) from challenges));
select is((select array_agg(title || ' > ' || array_to_string(recipients, ',') order by id) from push_outbox),
  array['🎯 nota beat you on a challenge > notc'], 'challenge pushes: first one to opt-ins, then whoever got beaten');
truncate push_outbox;

-- scheduled: reminder for nota (3h before = 21:00 UTC); a played player gets none
update notify_prefs set reminder_before = 3 where name in ('nota', 'notc');
delete from submissions where name = 'nota' and day = current_date and challenge_id is null;
select push_tick(current_date + time '21:00');
select is((select array_agg(title || ' | ' || body || ' > ' || array_to_string(recipients, ',')) from push_outbox),
  array['⏰ Today''s Reidle ends in 3 hours | 2 players have played. Your turn! > nota'], 'reminder only to who hasn''t played');
select push_tick(current_date + time '21:00');
select is((select count(*)::int from push_outbox), 1, 'each job runs once a day');
truncate push_outbox;
select push_tick(current_date + 1 + time '00:00');
select is((select title || ' | ' || body from push_outbox where tag like 'new-day-%'),
  '🌅 A new Reidle word is up | Yesterday notc won in 41.0s.', 'new day names yesterday''s winner');

set local role service_role;
select is(jsonb_array_length(push_claim()) > 0, true, 'the edge function claims the outbox');
select is(push_claim(), '[]'::jsonb, 'and each push goes once');
reset role;

select * from finish();
rollback;
