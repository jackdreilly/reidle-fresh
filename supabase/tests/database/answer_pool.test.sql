begin;
select plan(8);

-- Answer pool: the owner removes words from /admin; removed words are never drawn again.
update app_flags set legacy_until = 'infinity';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ap1@players.reidle.app', '{"name":"ap1"}'),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ap2@players.reidle.app', '{"name":"ap2"}');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('g-ap1', '00000000-0000-0000-0000-0000000000a1', '{"sub":"g-ap1"}', 'google');
insert into admins values ('ap1');
create temp table keep as select answer from answers order by answer limit 2;
create temp table total as select count(*)::int n from answers;
grant select on keep, total to authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select admin_answers()$$, '42501', 'admins only', 'admin_answers is for admins only');
select throws_ok($$select admin_set_answer('cigar', true)$$, '42501', 'admins only', 'admin_set_answer is for admins only');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((admin_answers() ->> 'active')::int, (select n from total), 'every answer starts in the pool');
select is(jsonb_array_length(admin_answers() -> 'words'), (select n from total), 'admin_answers lists every word');
select ok(admin_set_answer((select min(answer) from keep), true) ->> 'removed_at' is not null, 'a word can be removed');
select throws_ok($$select admin_set_answer('zzzzz', true)$$, '22023', null, 'only real answers');
reset role;

-- leave just two words in the pool, one of them removed: every draw is the other one
update answers set removed_at = now() where answer not in (select answer from keep);
select is((select count(distinct x) from (select random_answer() x from generate_series(1, 50)) s), 1::bigint, 'removed words are never drawn');
select is((select random_answer()), (select max(answer) from keep), 'the draw is the word still in the pool');

select * from finish();
rollback;
