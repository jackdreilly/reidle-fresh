begin;
select plan(13);

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
select throws_ok($$select admin_triage_answer('cigar', 'remove')$$, '42501', 'admins only', 'admin_triage_answer is for admins only');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((admin_answers() ->> 'active')::int, (select n from total), 'every answer starts in the pool');
select is(jsonb_array_length(admin_answers() -> 'words'), (select n from total), 'admin_answers lists every word');
select ok(admin_triage_answer((select min(answer) from keep), 'remove') ->> 'removed_at' is not null, 'a word can be removed');
select ok((select admin_triage_answer(max(answer), 'keep') from keep) @> '{"removed_at": null}'
          and (select admin_triage_answer(max(answer), 'keep') from keep) ->> 'reviewed_at' is not null, 'a word can be kept: triaged, still in the pool');
select is((select count(*)::int from jsonb_array_elements(admin_answers() -> 'words') w where w ->> 'reviewed_at' is not null), 2, 'both count as triaged');
select ok((select admin_triage_answer(max(answer), 'untriaged') from keep) @> '{"removed_at": null, "reviewed_at": null}', 'and can go back to untriaged');
select throws_ok($$select admin_triage_answer('zzzzz', 'remove')$$, '22023', null, 'only real answers');
reset role;

-- leave just two words in the pool, one of them removed: every draw is the other one
update answers set removed_at = now() where answer not in (select answer from keep);
select is((select count(distinct x) from (select random_answer() x from generate_series(1, 50)) s), 1::bigint, 'removed words are never drawn');
select is((select random_answer()), (select max(answer) from keep), 'the draw is the word still in the pool');


-- a removed word scheduled ahead (Reidle OG has days set into 2027) is redrawn there; past days stay
insert into daily_words (league_id, day, word, answer) values
  (1, league_day(1) + 30, (select min(word) from words), (select max(answer) from keep)),
  (1, league_day(1) - 400, (select min(word) from words), (select max(answer) from keep));
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select admin_triage_answer((select max(answer) from keep), 'remove');
reset role;
select isnt((select answer from daily_words where league_id = 1 and day = league_day(1) + 30), (select max(answer) from keep), 'its future day gets a new word');
select is((select answer from daily_words where league_id = 1 and day = league_day(1) - 400), (select max(answer) from keep), 'past days keep the word they had');

select * from finish();
rollback;
