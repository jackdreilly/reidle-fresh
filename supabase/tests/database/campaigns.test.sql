begin;
select plan(5);

-- Ad / referral tags: log_visit keeps a visit's utm tags; admin_campaigns counts clicks and the players they brought.
update app_flags set legacy_until = 'infinity';
create temp table t0 as select (extract(epoch from now()) * 1000)::bigint - 60000 as t;
grant select on t0 to anon, authenticated;
-- the admin: an old account with Google linked (verified)
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'cad@players.reidle.app', '{"name":"cad"}', now() - interval '3 days');
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at)
values ('g-cad', '00000000-0000-0000-0000-0000000000c1', '{"sub":"g-cad"}', 'google', now());
insert into admins values ('cad');
update players set created_at = now() - interval '3 days' where name = 'cad';

-- a signed-out tab opens the ad link ...
select set_config('request.jwt.claims', '', true);
set local role anon;
select log_visit('c0000000-0000-0000-0000-000000000001', format('[{"p":"/welcome","t":%s,"ms":3000}]', t)::jsonb,
  '{"utm":"Instagram/paid/launch","first_utm":"instagram/paid/launch"}') from t0;
reset role;
select is((select (user_id is null, utm, first_utm)::text from visits where sid = 'c0000000-0000-0000-0000-000000000001'),
  '(t,instagram/paid/launch,instagram/paid/launch)', 'a visit keeps its landing tags, lowercased');

-- ... and signs up as a guest in the same tab
insert into auth.users (id, instance_id, aud, role, is_anonymous, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, '{}');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select log_visit('c0000000-0000-0000-0000-000000000001', format('[{"p":"/play","t":%s,"ms":3000}]', t + 4000)::jsonb, '{}') from t0;
-- a later visit on that device, untagged, still carries the first tag
select log_visit('c0000000-0000-0000-0000-000000000002', format('[{"p":"/","t":%s,"ms":3000}]', t + 9000)::jsonb,
  '{"first_utm":"instagram/paid/launch"}') from t0;
reset role;
select is((select utm from visits where sid = 'c0000000-0000-0000-0000-000000000001'), 'instagram/paid/launch', 'later calls keep the tags');

-- someone who already played taps the ad too
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select log_visit('c0000000-0000-0000-0000-000000000003', format('[{"p":"/","t":%s,"ms":3000}]', t)::jsonb,
  '{"utm":"instagram/paid/launch","first_utm":"instagram/paid/launch"}') from t0;
select is((select (c ->> 'clicks', c ->> 'later_visits', c ->> 'new_players', c ->> 'existing_players')::text
           from jsonb_array_elements(admin_page() -> 'campaigns') c where c ->> 'tag' = 'instagram/paid/launch'),
  '(2,1,1,1)', 'admin_page counts the clicks, the later visit, the new player and the one who already played');
select ok(admin_page() ? 'speed', 'admin_page has the Speed numbers again');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select admin_campaigns()$$, '42501', null, 'admin_campaigns is not callable directly');
reset role;

select * from finish();
rollback;
