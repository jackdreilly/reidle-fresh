begin;
select plan(13);

-- Activity log: triggers record the key moments; log_error takes browser errors; admin_stats is admins only.
update app_flags set legacy_until = 'infinity';
delete from events;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ev1@players.reidle.app', '{"name":"ev1"}', now() - interval '1 day');
update league_members set league_id = 1 where league_id = 2 and name = 'ev1';
select is((select data ->> 'method' from events where kind = 'sign_up' and name = 'ev1'), 'name', 'sign-up is logged with its method');

insert into auth.sessions (id, user_id, created_at, user_agent)
values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', now(), 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
select is((select data from events where kind = 'sign_in' and name = 'ev1'), '{"method":"name","device":"iOS"}', 'sign-in is logged with method and device');

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at)
values ('g-ev1', '00000000-0000-0000-0000-0000000000e1', '{"sub":"g-ev1"}', 'google', now());
select is((select data ->> 'provider' from events where kind = 'link' and name = 'ev1'), 'google', 'linking Google to an existing account is logged');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select start_play();
select start_play();
reset role;
select is((select count(*)::int from events where kind = 'game_start' and name = 'ev1'), 1, 'a game start is logged once (a second start_play resumes)');

set local role authenticated;
select submit_daily(42.5, 0, '{"events":[]}', 'xxxxx', '');
reset role;
select is((select data ->> 'type' from events where kind = 'game_finish' and name = 'ev1'), 'daily', 'a finished daily is logged');

set local role authenticated;
select post_message('hello');
reset role;
select is((select count(*)::int from events where kind = 'message' and name = 'ev1'), 1, 'a chat message is logged (not its text)');

set local role authenticated;
select log_error('TypeError: x is undefined', '{"path":"/play"}');
reset role;
select is((select data from events where kind = 'error' and name = 'ev1'),
  '{"info":{"path":"/play"},"message":"TypeError: x is undefined"}', 'a browser error is logged with its context');

set local role authenticated;
select log_error('again') from generate_series(1, 30);
reset role;
select is((select count(*)::int from events where kind = 'error' and name = 'ev1'), 20, 'errors are capped at 20 an hour per account');

select set_config('request.jwt.claims', '', true);
set local role anon;
select log_error('sign-in page broke');
reset role;
select is((select count(*)::int from events where kind = 'error' and user_id is null), 1, 'signed-out browsers can report errors');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select admin_stats()$$, '42501', 'admins only', 'admin_stats is for admins only');
select throws_ok($$select * from events$$, '42501', null, 'the events table is closed');
reset role;

insert into admins values ('ev1');
set local role authenticated;
select is((select jsonb_array_length(admin_stats(7) -> 'days')), 7, 'admin_stats returns one row per day');
select ok((select (admin_stats() -> 'days' -> 0 ->> 'active')::int >= 1), 'today counts the active player');
reset role;

select * from finish();
rollback;
