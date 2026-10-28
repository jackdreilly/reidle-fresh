begin;
select plan(19);

-- Contact Jack: a player writes, the owner is notified and answers, the player's dot comes and goes.
update app_flags set legacy_until = 'infinity';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct1@players.reidle.app', '{"name":"ct1"}'),
       ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ct2@players.reidle.app', '{"name":"ct2"}');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('g-ct1', '00000000-0000-0000-0000-0000000000c1', '{"sub":"g-ct1"}', 'google');
insert into admins values ('ct1');
delete from push_outbox;

-- the player writes
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select send_feedback('   ')$$, 'P0001', 'Write a message first', 'an empty message is refused');
select throws_ok($$select send_feedback('hi', null, null, 'not-an-email')$$, 'P0001', null, 'a bad email is refused');
select is(send_feedback('  How do I invite my sister?  ', '/league', 'iOS app') ->> 'body', 'How do I invite my sister?', 'a message is saved, trimmed');
select is(jsonb_array_length(contact_page() -> 'messages'), 1, 'the player sees their conversation');
select is(bootstrap() -> 'contact_unread', 'null'::jsonb, 'nothing unread before a reply');
select is(bootstrap() -> 'inbox', 'null'::jsonb, 'players have no inbox');
select throws_ok($$select admin_inbox()$$, '42501', null, 'the inbox is not callable by players');
select throws_ok($$select admin_feedback('ct2')$$, '42501', 'admins only', 'nor is a conversation');
select throws_ok($$select admin_reply('ct2', 'x')$$, '42501', 'admins only', 'nor replying');
reset role;
select ok((select 'ct1' = any (recipients) and not 'ct2' = any (recipients) from push_outbox where tag = 'feedback-ct2'), 'every admin gets a push');
select is((select url from push_outbox where tag = 'feedback-ct2'), '/admin/inbox/ct2', 'the push opens the conversation');

-- the owner reads and answers (one transaction has one now(): pretend the player wrote a minute ago)
update feedback_threads set player_seen_at = now() - interval '1 minute' where name = 'ct2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select is((bootstrap() ->> 'inbox')::int, 1, 'the owner sees one unread conversation');
select is((admin_page(7) -> 'inbox' -> 0 ->> 'unread')::int, 1, '/admin lists it with its unread count');
select is(admin_feedback('ct2') -> 'player' ->> 'login', 'name', 'a conversation shows who the player is');
select is((bootstrap() ->> 'inbox')::int, 0, 'opening it marks it read');
select is(admin_reply('ct2', 'Open Invite & league and share the link!') ->> 'from_jack', 'true', 'the owner replies');
reset role;
select is((select recipients from push_outbox where tag = 'contact-ct2'), array['ct2'], 'the reply pushes to the player');

-- the player's dot, cleared by reading
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select isnt(bootstrap() -> 'contact_unread', 'null'::jsonb, 'the reply shows as unread');
select contact_page();
select is(bootstrap() -> 'contact_unread', 'null'::jsonb, 'opening /contact clears it');
reset role;

select * from finish();
rollback;
