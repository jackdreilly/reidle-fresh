-- Post-import verification: compares legacy.* (still present) with the new public.* tables.
-- Prints a report; failed_checks counts hard failures (informational rows never fail).
\set ON_ERROR_STOP on
create temp table checks (area text, what text, expected text, actual text, info boolean not null default false);

insert into checks
with
names as (select name from legacy.players where name <> '' union select name from legacy.submissions where name <> ''
  union select name from legacy.messages where name <> '' union select name from legacy.checkpoints where name <> ''
  union select name from legacy.message_reads where name <> ''),
kept_daily as (select distinct on (day, name) * from legacy.submissions where name <> '' and challenge_id is null order by day, name, submission_id),
kept_chal as (select distinct on (challenge_id, name) * from legacy.submissions where name <> '' and challenge_id is not null order by challenge_id, name, submission_id)
select * from (values
  ('counts', 'players (every name ever seen)', (select count(*) from names)::text, (select count(*) from public.players)::text),
  ('counts', 'daily submissions (deduped)', (select count(*) from kept_daily)::text, (select count(*) from public.submissions where challenge_id is null)::text),
  ('counts', 'challenge submissions (deduped)', (select count(*) from kept_chal)::text, (select count(*) from public.submissions where challenge_id is not null)::text),
  ('counts', 'challenges', (select count(*) from legacy.challenges)::text, (select count(*) from public.challenges)::text),
  ('counts', 'daily_words', (select count(*) from legacy.daily_words)::text, (select count(*) from public.daily_words)::text),
  ('counts', 'messages (non-empty)', (select count(*) from legacy.messages where name <> '' and message <> '')::text, (select count(*) from public.messages)::text),
  ('counts', 'checkpoints', (select count(*) from legacy.checkpoints where name <> '')::text, (select count(*) from public.checkpoints)::text),
  ('counts', 'message_reads', (select count(*) from legacy.message_reads where name <> '')::text, (select count(*) from public.message_reads)::text),
  ('counts', 'winners (distinct weeks)', (select count(distinct week) from legacy.winners)::text, (select count(*) from public.winners)::text),
  ('counts', 'battles (+ party room 7 if absent)', (select count(*) + (case when exists (select 1 from legacy.battles where battle_id = 7) then 0 else 1 end) from legacy.battles)::text, (select count(*) from public.battles)::text)
) v(area, what, expected, actual);

-- rows must survive byte-for-byte where it matters
insert into checks select 'integrity', 'submission times identical (0 mismatches)', '0',
  (select count(*) from public.submissions n join legacy.submissions l using (submission_id)
   where abs(n."time" - l."time"::numeric::double precision) > 0.0005 or abs(n.penalty - l.penalty::numeric::double precision) > 0.0005 or n.name <> l.name or n.day <> l.day)::text;
insert into checks select 'integrity', 'message text/likes identical (0 mismatches)', '0',
  (select count(*) from public.messages n join legacy.messages l using (message_id) where n.message <> l.message or n.likes <> l.likes or n.name <> l.name)::text;
insert into checks select 'integrity', 'challenge words identical (0 mismatches)', '0',
  (select count(*) from public.challenges n join legacy.challenges l using (challenge_id) where n.answer <> upper(l.answer) or n.starting_word <> upper(l.starting_word))::text;
insert into checks select 'integrity', 'imported games whose starting word equals the answer (historical; kept as-is; informational)', '0',
  ((select count(*) from public.daily_words where word = answer) + (select count(*) from public.challenges where starting_word = answer))::text, true;
insert into checks select 'integrity', 'identity sequences continue after max ids', 'true',
  ((select last_value from public.submissions_submission_id_seq) >= (select max(submission_id) from public.submissions)
   and (select last_value from public.challenges_challenge_id_seq) >= (select max(challenge_id) from public.challenges)
   and (select last_value from public.messages_message_id_seq) >= (select max(message_id) from public.messages))::text;

-- scoring: every pre-cutover week with data is frozen, and the legacy-scoring port agrees with history
insert into checks select 'scoring', 'pre-cutover weeks with data are frozen', 
  (select count(distinct date_trunc('week', day)) from public.submissions where challenge_id is null and day < public.scoring_cutover())::text,
  (select count(*) from public.week_snapshots)::text;
insert into checks
with declared as (select distinct on (week) week, name from legacy.winners order by week, ctid),
cmp as (select d.week, d.name as declared, s.results -> 0 ->> 'name' as computed
        from declared d join public.week_snapshots s on s.week = d.week)
select 'scoring', 'weeks where computed winner != historically declared winner (informational)', 'few',
       count(*) filter (where declared <> computed) || ' of ' || count(*), true from cmp;

\echo
\echo '== migration verification =='
select case when info then 'info' when expected = actual then 'ok  ' else 'FAIL' end as status,
       area, what, expected, actual from checks order by area, what;
select count(*) filter (where not info and expected <> actual) as failed_checks from checks;
