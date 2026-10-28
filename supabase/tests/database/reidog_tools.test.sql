begin;
select plan(16);

-- Reidog's catch-all lookup (ask_query): one read-only SELECT over the reidog views, as the asking player.
update app_flags set legacy_until = 'infinity';
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rt1@players.reidle.app', '{"name":"rt1"}'),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rt2@players.reidle.app', '{"name":"rt2"}');
-- rt1 plays in league 1 and has played today; rt2 is in league 1 too but hasn't played today
insert into league_members (league_id, name) values (1, 'rt1'), (1, 'rt2');
insert into submissions (league_id, day, name, "time", word, paste)
values (1, league_day(1), 'rt1', 50, 'cigar', 'grid-today'), (1, league_day(1) - 3, 'rt1', 60, 'rebut', 'grid-old');
-- a league neither of them is in
insert into leagues (league_id, name) values (901, 'Secret');
insert into league_members (league_id, name) values (901, 'alice');
insert into submissions (league_id, day, name, "time", word) values (901, league_day(901) - 1, 'alice', 33, 'humph');
insert into challenges (league_id, starting_word, answer)
select 1, (select word from words limit 1), (select answer from answers order by answer limit 1);

create function pg_temp.as_player(p_sub text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', p_sub), true);
  perform set_config('x.sub', p_sub, true);
end $$;

-- every check runs in its own savepoint: ask_query leaves the transaction read-only
create function pg_temp.q(p_sub text, p_sql text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  begin
    perform pg_temp.as_player(p_sub);
    set local role authenticated;
    r := public.ask_query(p_sql);
    raise exception 'undo' using errcode = 'P0099';
  exception when sqlstate 'P0099' then return r;
  end;
end $$;
create function pg_temp.q_err(p_sub text, p_sql text) returns text language plpgsql as $$
begin
  begin
    perform pg_temp.as_player(p_sub);
    set local role authenticated;
    perform public.ask_query(p_sql);
    return 'no error';
  exception when others then return sqlerrm;
  end;
end $$;

select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1', 'select name from me') -> 0 ->> 'name', 'rt1', 'me is the asking player');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1',
  $$select answer, paste from daily_results where name = 'rt1' order by day desc$$),
  '[{"answer": null, "paste": "grid-today"}, {"answer": "REBUT", "paste": "grid-old"}]', 'today''s answer is never shown; past answers are');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b2',
  $$select paste from daily_results where name = 'rt1' and answer is null$$) -> 0 ->> 'paste', null,
  'today''s pastes stay hidden until you have played');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b2',
  $$select count(*) from daily_results where answer is null and name = 'rt1'$$) -> 0 ->> 'count', '1',
  'but today''s times are visible, like the Leaderboard');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1',
  $$select count(*) from daily_results where league_id = 901$$) -> 0 ->> 'count', '0', 'other leagues are invisible');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1',
  $$select answer from challenges order by challenge_id desc limit 1$$) -> 0 ->> 'answer', null,
  'a challenge''s answer is hidden until you play it');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1', 'select current_user as u'), '[{"u": "reidog_reader"}]', 'the SQL runs as reidog_reader');
select is(pg_temp.q('00000000-0000-0000-0000-0000000000b1', $$select current_setting('transaction_read_only') as ro$$), '[{"ro": "on"}]', 'in a read-only transaction');
select is(jsonb_array_length(pg_temp.q('00000000-0000-0000-0000-0000000000b1', 'select * from generate_series(1, 500)')), 50, 'at most 50 rows');

select matches(pg_temp.q_err('00000000-0000-0000-0000-0000000000b1', 'select * from public.daily_words'), 'permission denied', 'tables stay closed');
select matches(pg_temp.q_err('00000000-0000-0000-0000-0000000000b1', 'select public.play_payload(''x'')'), 'permission denied', 'app functions stay closed');
select matches(pg_temp.q_err('00000000-0000-0000-0000-0000000000b1', $$select "set_config"('role', 'service_role', true)$$), 'isn''t available', 'no changing role or settings');
select matches(pg_temp.q_err('00000000-0000-0000-0000-0000000000b1', 'select 1; delete from players'), 'One statement', 'one statement only');
select matches(pg_temp.q_err('00000000-0000-0000-0000-0000000000b1', 'delete from players'), 'Only a single SELECT', 'only SELECT');

-- even past the text checks, inside reidog.run a role switch is refused (security definer owned by reidog_reader)
select throws_ok($$select reidog.run('select set_config(''role'', ''postgres'', true)', 1)$$, '42501', null,
  'reidog.run cannot switch roles');

set local role anon;
select throws_ok($$select ask_query('select 1')$$, '42501', null, 'signed-out visitors cannot query');
reset role;

select * from finish();
rollback;
