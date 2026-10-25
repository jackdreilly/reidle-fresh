begin;
select plan(14);

-- Growth: the reminder prompt (once per player), invite opens and the owner's admin_growth.
update app_flags set legacy_until = 'infinity';
delete from events;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gr1@players.reidle.app', '{"name":"gr1"}'),
       ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gr2@players.reidle.app', '{"name":"gr2"}');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('g-gr1', '00000000-0000-0000-0000-0000000000f1', '{"sub":"g-gr1"}', 'google');
insert into admins values ('gr1');

-- the reminder card: after the first finished game, until answered once
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
set local role authenticated;
select is((bootstrap() ->> 'reminder_prompt')::boolean, false, 'no reminder card before the first game');
select start_play();
select submit_daily(42.5, 0, '{"events":[]}', 'xxxxx', '');
select is((bootstrap() ->> 'reminder_prompt')::boolean, true, 'the reminder card shows after the first finished game');
select dismiss_reminder_prompt('settings');
select dismiss_reminder_prompt('dismissed');
select is((bootstrap() ->> 'reminder_prompt')::boolean, false, 'answering it hides it for the player (every device)');
reset role;
select is((select array_agg(data ->> 'outcome')::text from events where kind = 'reminder_prompt' and name = 'gr2'), '{settings}',
  'the answer is logged once');

-- a player who sets a reminder in Settings never sees it
update players set reminder_prompt_seen = false where name = 'gr2';
set local role authenticated;
select set_notify_prefs('{"reminder_before": 3}');
select is((bootstrap() ->> 'reminder_prompt')::boolean, false, 'a reminder already set hides the card');
reset role;

-- invite opens: signed out first (deduped per tab), then the same tab signed in
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
create temp table lg_new on commit drop as select create_league('Growth Club') as id;
reset role;
create temp table code on commit drop as select invite_code from leagues where league_id = (select id from lg_new);
grant select on code, lg_new to anon, authenticated;

select set_config('request.jwt.claims', '', true);
set local role anon;
select log_invite((select invite_code from code), '33333333-3333-3333-3333-333333333333');
select log_invite((select invite_code from code), '33333333-3333-3333-3333-333333333333');
select log_invite('no-such-code', '33333333-3333-3333-3333-333333333333');
reset role;
select is((select count(*)::int from events where kind = 'invite_open'), 1, 'a signed-out invite open is logged once per tab');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
set local role authenticated;
select log_invite((select invite_code from code), '33333333-3333-3333-3333-333333333333');
select join_league((select invite_code from code));
reset role;
select is((select name from events where kind = 'invite_open' order by at desc, event_id desc limit 1), 'gr2', 'signing in on the invite logs the account');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
-- the commissioner checking their own link is not an invitee
select log_invite((select invite_code from code), '44444444-4444-4444-4444-444444444444');
select is((select jsonb_array_length(admin_growth() -> 'weeks')), 12, 'admin_growth has twelve weeks');
select ok((select (admin_growth() -> 'league_kpis' ->> 'made')::int >= 1), 'it counts leagues players made');
select ok((select admin_growth() -> 'leagues' @> jsonb_build_array(jsonb_build_object('name', 'Growth Club', 'members', 2, 'invite_opens', 1, 'invite_joins', 1))),
  'every league is listed with members and invite opens -> joins');
select ok((select admin_growth() -> 'invites' @> '[{"who":"gr2","league":"Growth Club","signed_in":true,"joined":true}]'), 'the invite funnel follows the tab to the account and the join');
select is((select jsonb_array_length(admin_growth() -> 'invites')), 1, 'members opening their own link are left out');
select ok((select admin_growth() -> 'new_players' @> '[{"name":"gr2","started":true,"played":true,"prompt":"settings","via":"Growth Club"}]'),
  'each new player shows how far they got');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
select throws_ok($$select admin_growth()$$, '42501', 'admins only', 'admin_growth is for admins only');
reset role;

select * from finish();
rollback;
