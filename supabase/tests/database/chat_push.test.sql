begin;
select plan(8);

truncate messages, push_subscriptions restart identity cascade;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa@t.t', '{"name":"pusha"}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb@t.t', '{"name":"pushb"}');
-- name-only sign-ups start in Reidle Global; these tests are about the founding league
update league_members set league_id = 1 where league_id = 2;

-- both players opt in; pushb's browser is then taken over by pusha
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
select push_subscribe('{"endpoint":"https://push.example/a","keys":{"p256dh":"k","auth":"a"},"expirationTime":null}');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select push_subscribe('{"endpoint":"https://push.example/b","keys":{"p256dh":"k","auth":"a"}}');
select throws_ok($$select push_claim()$$, '42501', null, 'clients cannot claim pushes');
select throws_ok($$select * from push_subscriptions$$, '42501', null, 'subscriptions table is closed');
reset role;
select is((select subscription from push_subscriptions where endpoint = 'https://push.example/a'),
  '{"endpoint":"https://push.example/a","keys":{"p256dh":"k","auth":"a"}}'::jsonb, 'stores only endpoint + keys');

insert into messages (name, message) values ('pusha', 'hello');
insert into messages (name, message, created_at) values ('pushb', 'old news', now() - interval '1 hour');
set local role service_role;
select is(push_claim(), '[{"title":"pusha","body":"hello","url":"/messages?league=1","tag":"chat-1","subscriptions":[{"endpoint":"https://push.example/b","keys":{"p256dh":"k","auth":"a"}}]}]'::jsonb,
  'recent message goes to everyone else''s browsers (not the author''s, not old messages)');
select is(push_claim(), '[]'::jsonb, 'each message is pushed once');
select push_gone(array['https://push.example/b']);
reset role;
select is((select count(*)::int from push_subscriptions), 1, 'gone endpoints are dropped');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select push_subscribe('{"endpoint":"https://push.example/a","keys":{"p256dh":"k2","auth":"a2"}}');
reset role;
select is((select name from push_subscriptions where endpoint = 'https://push.example/a'), 'pushb', 're-subscribing moves the browser to the signed-in player');
set local role authenticated;
select push_unsubscribe('https://push.example/a');
reset role;
select is((select count(*)::int from push_subscriptions), 0, 'turning it off removes the browser');

select * from finish();
rollback;
