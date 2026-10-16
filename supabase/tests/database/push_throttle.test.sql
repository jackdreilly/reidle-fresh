begin;
select plan(7);

truncate messages, push_subscriptions, push_outbox, push_throttle, notify_prefs restart identity cascade;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ta@t.t', '{"name":"thra"}'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tb@t.t', '{"name":"thrb"}');
insert into push_subscriptions (endpoint, name, subscription) values
  ('https://push.example/ta', 'thra', '{"endpoint":"https://push.example/ta"}'),
  ('https://push.example/tb', 'thrb', '{"endpoint":"https://push.example/tb"}');
insert into notify_prefs (name, challenges) values ('thrb', true);

-- a burst of 4 chat messages: one alert now, the rest held
insert into messages (name, message) values ('thra', 'one'), ('thra', 'two'), ('thra', 'three'), ('thra', 'four');
select is((select array_agg(title || ':' || body) from push_outbox), array['thra:one'], 'a chat burst alerts once');
select is((select held from push_throttle where name = 'thrb' and grp = 'chat'), 3, 'the rest are held');

select push_flush_held();
select is((select count(*)::int from push_outbox), 1, 'nothing more until the cooldown ends');

-- cooldown over: one summary with the latest message
update push_throttle set last_sent = now() - interval '3 minutes';
select push_flush_held();
select is((select title || ':' || body from push_outbox order by id desc limit 1), 'thra (+2 more):four', 'then one summary');

-- read the chat meanwhile: the summary is dropped
truncate push_outbox;
update push_throttle set last_sent = now() - interval '3 minutes';
insert into messages (name, message) values ('thra', 'five');
select is((select count(*)::int from push_outbox), 1, 'after the cooldown the next message alerts right away');
insert into message_reads (name, last_read) values ('thrb', now()) on conflict (name) do update set last_read = now();
update push_throttle set held = 1, held_at = now() - interval '1 minute', last_sent = now() - interval '3 minutes';
select push_flush_held();
select is((select count(*)::int from push_outbox), 1, 'a held chat summary is dropped once you have read the chat');

-- reminders etc. are never throttled
truncate push_outbox;
select push_enqueue(array['thrb'], 'x', 'y', '/play', 'reminder-x');
select push_enqueue(array['thrb'], 'x', 'y', '/play', 'reminder-x');
select is((select count(*)::int from push_outbox), 2, 'once-a-day kinds pass straight through');

select * from finish();
rollback;
