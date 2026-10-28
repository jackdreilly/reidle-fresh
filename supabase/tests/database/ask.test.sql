begin;
select plan(8);

-- Ask Reidog: the edge function calls these with the player's own token.
update app_flags set legacy_until = 'infinity';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ak1@players.reidle.app', '{"name":"ak1"}'),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ak2@players.reidle.app', '{"name":"ak2"}');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select ask_begin('  ')$$, 'P0001', 'Ask a question first', 'an empty question is refused');
create temp table q on commit drop as select ask_begin('  How do challenges work? ') as r;
select is((select r ->> 'name' from q), 'ak1', 'it says who is asking');
select is((select r -> 'league' ->> 'name' from q), 'Reidle Global', 'and their league, for the prompt');
select ask_finish((select (r ->> 'id')::bigint from q), 'Play a fresh word...', 420, 'gemini-test');
reset role;
select is((select question || ' / ' || answer from ask_log where name = 'ak1'), 'How do challenges work? / Play a fresh word...', 'question and answer are logged');

-- someone else can't overwrite it
create temp table ak1_id on commit drop as select id from ask_log where name = 'ak1';
grant select on ak1_id to authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select ask_finish((select id from ak1_id), 'hacked', 1, 'x');
reset role;
select is((select answer from ask_log where name = 'ak1'), 'Play a fresh word...', 'only the asker can store the answer');

-- the daily cap
insert into ask_log (name, question, created_at) select 'ak2', 'q', now() from generate_series(1, 50);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select ask_begin('one more?')$$, 'P0001', null, '50 questions a day at most');
select throws_ok($$select * from ask_log$$, '42501', null, 'the log is closed to players');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select ask_begin('hi')$$, '42501', null, 'signed-out visitors cannot ask');
reset role;

select * from finish();
rollback;
