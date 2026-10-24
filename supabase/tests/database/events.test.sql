begin;
select plan(19);

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

-- a name-only account is never an admin, even when listed
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ev2@players.reidle.app', '{"name":"ev2"}');
insert into admins values ('ev2');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select admin_stats()$$, '42501', 'admins only', 'a name-only account cannot open the admin page');
reset role;

-- visits: pages and time on screen; a page sent again later only grows
create temp table t0 as select (extract(epoch from now()) * 1000)::bigint - 600000 as t;
grant select on t0 to authenticated;
select log_visit('11111111-1111-1111-1111-111111111111',
  format('[{"p":"/stats/daily/:date","t":%s,"ms":5000},{"p":"/play","t":%s,"ms":60000},{"p":"/old","t":1761300000000,"ms":1}]', t, t + 5000)::jsonb,
  '{"device":"iOS","pwa":true,"theme":"dark","entry":"/stats/daily/:date"}') from t0;
select log_visit('11111111-1111-1111-1111-111111111111', format('[{"p":"/play","t":%s,"ms":90000},{"p":"x","t":1}]', t + 5000)::jsonb) from t0;
select is((select (pages, active_ms, device, pwa)::text from visits where sid = '11111111-1111-1111-1111-111111111111'),
  '(2,95000,iOS,t)', 'a visit adds up its pages and time on screen (resent pages grow; junk and stale pages are dropped)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
insert into admins values ('ev1');  -- ev1 linked Google above: verified
set local role authenticated;
select log_visit('22222222-2222-2222-2222-222222222222', format('[{"p":"/admin","t":%s,"ms":1000}]', t)::jsonb) from t0;
select throws_ok($$select * from visits$$, '42501', null, 'the visits table is closed');
select is((select jsonb_array_length(admin_stats(7) -> 'days')), 7, 'admin_stats returns one row per day');
select ok((select (admin_stats() -> 'kpis' ->> 'dau')::int >= 1), 'today counts the active player');
select ok((select admin_stats() -> 'players' @> '[{"name":"ev1","games_all":1,"visits_7d":1}]'), 'players are listed with their games and visits');
select is((select admin_player('ev1') -> 'visits' -> 0 ->> 'pages'), '1', 'a player drill-down lists their visits');
select is((select admin_player('ev1') -> 'games' ->> 'dailies'), '1', 'and their games');
reset role;

select * from finish();
rollback;
