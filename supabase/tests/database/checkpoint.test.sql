begin;
select plan(4);

delete from checkpoints where name = 'saver';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'saver@t.t', '{"name":"saver"}');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select start_play();
select save_checkpoint(0, '[["a"],["b"],["c"]]');
reset role;
select is((select jsonb_array_length(history) from checkpoints where name = 'saver'), 3, 'a save records the guesses');

-- a stale save (out of order, or a resuming device's empty board) never drops guesses
set local role authenticated;
select save_checkpoint(0, '[]');
select save_checkpoint(0, '[["a"],["b"]]');
reset role;
select is((select jsonb_array_length(history) from checkpoints where name = 'saver'), 3, 'a shorter history never overwrites a longer one');

set local role authenticated;
select save_checkpoint(10, '[["a"],["b"],["c"],["d"]]');
select save_checkpoint(5, '[["a"],["b"],["c"],["d"]]');
reset role;
select is((select jsonb_array_length(history) from checkpoints where name = 'saver'), 4, 'a longer history is saved');
select is((select penalty from checkpoints where name = 'saver'), 10::double precision, 'penalties never go back down');

select * from finish();
rollback;
