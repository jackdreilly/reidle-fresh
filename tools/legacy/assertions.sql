\set ON_ERROR_STOP on
do $$
declare n int;
begin
  assert (select count(*) from public.players) = 7, 'players = alice,bob + orphans carol,dave,erin,frank,gina; got ' || (select count(*) from public.players);
  assert (select count(*) from public.submissions where challenge_id is null) = 3, 'daily dupes + empty name dropped';
  assert (select count(*) from public.submissions where challenge_id = 10) = 2, 'challenge dupe dropped';
  assert (select paste from public.submissions where name = 'carol') = 'p', 'first duplicate wins';
  assert (select "time" from public.submissions where submission_id = 1) = 63.4, 'float4 time survives as 63.4';
  assert (select "rank" from public.submissions where submission_id = 3) = 1 and
         (select "rank" from public.submissions where submission_id = 2) = 2 and
         (select "rank" from public.submissions where submission_id = 1) = 3, 'daily ranks recomputed';
  assert (select count(*) from public.winners) = 2 and (select name from public.winners where week = '2026-09-28') = 'alice', 'winner week dedupe';
  assert (select count(*) from public.messages) = 1, 'empty-name/empty-message rows dropped';
  assert (select playback ->> 'events' from public.submissions where submission_id = 7) is not null, 'json -> jsonb';
  assert (select count(*) from public.battles where battle_id in (7, 40)) = 2, 'battles imported incl. party room';
  assert (select count(*) from public.words where word = 'CRANE') = 1, 'uppercase words';
  insert into public.submissions (name, "time", word) values ('alice', 10, 'x') returning submission_id into n;
  assert n = 8, 'submission sequence continues after max imported id, got ' || n;
  assert (select nextval(pg_get_serial_sequence('public.battles','battle_id'))) >= 100, 'battle seq starts >= 100';
end $$;
select 'import assertions passed' as result;
