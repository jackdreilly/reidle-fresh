-- Transforms legacy.* (see schema.sql) into the new public.* schema. Idempotent: wipes the
-- target's app data first. Preserves ids so URLs (/challenges/challenge/N, playback ids) survive.
--
-- Legacy quirks handled: no FKs on names (orphan names -> players are created), duplicate daily/
-- challenge submissions and winner weeks (first one wins), json columns, float4 times (cast via
-- numeric so 63.4 stays 63.4), uppercase word tables (imported verbatim), dropped columns/tables
-- (email, notifications, score, page_views, alembic_version).
begin;

truncate public.players, public.words, public.answers, public.daily_words, public.challenges,
         public.submissions, public.checkpoints, public.messages, public.message_reads,
         public.winners, public.battles, public.week_snapshots restart identity cascade;

insert into public.words select upper(word) from legacy.words on conflict do nothing;
insert into public.answers select upper(answer) from legacy.answers on conflict do nothing;
-- referenced words must exist even if absent from the word tables
insert into public.words select upper(w) from (
  select word w from legacy.daily_words union select starting_word from legacy.challenges) x on conflict do nothing;
insert into public.answers select upper(a) from (
  select answer a from legacy.daily_words union select answer from legacy.challenges) x on conflict do nothing;

insert into public.daily_words select day, upper(word), upper(answer) from legacy.daily_words;
insert into public.challenges (challenge_id, starting_word, answer, created_at)
  overriding system value
  select challenge_id, upper(starting_word), upper(answer), created_at from legacy.challenges;

-- Every name that ever appeared becomes a player (earliest sighting = created_at).
insert into public.players (name, created_at)
select name, min(ts) from (
  select name, created_at::timestamptz ts from legacy.players
  union all select name, created_at from legacy.submissions
  union all select name, created_at from legacy.messages
  union all select name, created_at from legacy.checkpoints
  union all select name, last_read from legacy.message_reads
) n where name is not null and name <> '' group by name;

insert into public.submissions
  (submission_id, day, name, paste, playback, challenge_id, "time", penalty, word, "rank", created_at)
  overriding system value
select submission_id, day, name, paste, playback::jsonb, challenge_id,
       "time"::numeric::double precision, penalty::numeric::double precision, word, 1, created_at
from (
  -- once per (day, name) for dailies, once per (challenge, name) for challenges (even across days)
  select distinct on (case when challenge_id is null then day end, name, coalesce(challenge_id, -1)) *
  from legacy.submissions where name <> ''
  order by case when challenge_id is null then day end, name, coalesce(challenge_id, -1), submission_id
) s;
-- daily ranks (and nothing else) are derived data: recompute from times
update public.submissions s set "rank" = r.rn
from (select submission_id, row_number() over (partition by day order by "time", submission_id) rn
      from public.submissions where challenge_id is null) r
where s.submission_id = r.submission_id;

insert into public.checkpoints (name, day, penalty, history, created_at)
  select name, day, penalty, history::jsonb, created_at from legacy.checkpoints where name <> '';
insert into public.messages (message_id, name, message, likes, created_at)
  overriding system value
  select message_id, name, message, likes, created_at from legacy.messages where name <> '' and message <> '';
insert into public.message_reads select name, last_read from legacy.message_reads where name <> '';
insert into public.winners (week, name)
  select distinct on (week) week, name from legacy.winners order by week, ctid;
insert into public.battles (battle_id, state, users, updated_at)
  overriding system value
  select battle_id, state::jsonb, users::jsonb, updated_at from legacy.battles;
insert into public.battles (battle_id) values (7) on conflict do nothing;

-- re-runs: re-link players to auth accounts that already exist here (signed in before a re-import)
update public.players p set user_id = u.id from auth.users u
  where p.user_id is null and u.raw_user_meta_data ->> 'name' = p.name;

-- identity sequences continue 1000 above the imported ids, so legacy stragglers (tools/legacy/catchup.sql)
-- keep their own ids after cutover
select setval(pg_get_serial_sequence('public.challenges', 'challenge_id'), greatest(1, (select max(challenge_id) from public.challenges)) + 1000);
select setval(pg_get_serial_sequence('public.submissions', 'submission_id'), greatest(1, (select max(submission_id) from public.submissions)) + 1000);
select setval(pg_get_serial_sequence('public.messages', 'message_id'), greatest(1, (select max(message_id) from public.messages)) + 1000);
select setval(pg_get_serial_sequence('public.battles', 'battle_id'), greatest(100, (select max(battle_id) from public.battles)));

-- Freeze every pre-cutover week now (legacy product scoring, computed once, served read-only forever).
select public.week_scores(w) from (
  select distinct date_trunc('week', day)::date as w from public.submissions
  where challenge_id is null and day < public.scoring_cutover()) weeks;

commit;
