begin;
select plan(3);

truncate messages restart identity cascade;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'liker@t.t', '{"name":"liker"}');
insert into messages (name, message) values ('liker', 'hi');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select like_message(1);
reset role;
select is((select likes from messages where message_id = 1), '{liker}', 'first click likes');

set local role authenticated;
select like_message(1);
reset role;
select is((select likes from messages where message_id = 1), '{}', 'second click unlikes');

set local role authenticated;
select like_message(1);
reset role;
select is((select likes from messages where message_id = 1), '{liker}', 'third click likes again');

select * from finish();
rollback;
