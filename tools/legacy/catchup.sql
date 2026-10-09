-- Post-cutover catch-up: copies games/challenges/messages that reached LEGACY after the import
-- (players with a cached DNS answer or an open legacy tab) into the new project. Append-only and
-- idempotent: rows whose id already exists are skipped, and a daily someone also played on the new
-- site keeps the new-site game. Legacy ids stay valid because the import started the new id
-- counters 1000 above legacy's.
-- Run in the NEW project's SQL editor. Needs the temporary read-only legacy role reidle_export:
-- replace PICK-A-PASSWORD with its password (alter role reidle_export password '...' on legacy).
create extension if not exists dblink with schema extensions;
select extensions.dblink_connect('leg', 'host=aws-0-us-east-1.pooler.supabase.com port=5432 dbname=postgres user=reidle_export.kyxziusgsizkedxitbez password=PICK-A-PASSWORD sslmode=require');

create temp table new_challenges as select * from extensions.dblink('leg',
  'select challenge_id, created_at, upper(starting_word), upper(answer) from public.challenges where created_at > now() - interval ''3 days''')
  t(challenge_id bigint, created_at timestamptz, starting_word text, answer text);
create temp table new_subs as select * from extensions.dblink('leg',
  'select submission_id, created_at, name, "time", penalty, paste, playback::text, word, day, challenge_id from public.submissions where created_at > now() - interval ''3 days'' and name <> ''''')
  t(submission_id bigint, created_at timestamptz, name text, "time" real, penalty real, paste text, playback text, word text, day date, challenge_id bigint);
create temp table new_msgs as select * from extensions.dblink('leg',
  'select message_id, created_at, name, message, likes from public.messages where created_at > now() - interval ''3 days'' and name <> '''' and message <> ''''')
  t(message_id bigint, created_at timestamptz, name text, message text, likes text[]);
select extensions.dblink_disconnect('leg');

begin;
insert into public.players (name, created_at)
  select name, min(created_at) from (select name, created_at from new_subs union all select name, created_at from new_msgs) n
  group by name on conflict do nothing;
insert into public.words select starting_word from new_challenges on conflict do nothing;
insert into public.answers select answer from new_challenges on conflict do nothing;

with ins as (
  insert into public.challenges (challenge_id, starting_word, answer, created_at) overriding system value
  select challenge_id, starting_word, answer, created_at from new_challenges
  where challenge_id not in (select challenge_id from public.challenges)
  returning 1) select count(*) as challenges_added from ins;

create temp table added_subs as
with ins as (
  insert into public.submissions (submission_id, day, name, paste, playback, challenge_id, "time", penalty, word, "rank", created_at)
  overriding system value
  select distinct on (case when challenge_id is null then day end, name, coalesce(challenge_id, -1))
         submission_id, day, name, paste, playback::jsonb, challenge_id,
         "time"::numeric::double precision, penalty::numeric::double precision, word, 1, created_at
  from new_subs s
  where submission_id not in (select submission_id from public.submissions)
  order by case when challenge_id is null then day end, name, coalesce(challenge_id, -1), submission_id
  on conflict do nothing
  returning submission_id, day, name, challenge_id)
select * from ins;

-- re-rank every day that gained a daily game
update public.submissions s set "rank" = r.rn
from (select submission_id, row_number() over (partition by day order by "time", submission_id) rn
      from public.submissions
      where challenge_id is null and day in (select day from added_subs where challenge_id is null)) r
where s.submission_id = r.submission_id and s."rank" <> r.rn;

with ins as (
  insert into public.messages (message_id, name, message, likes, created_at) overriding system value
  select message_id, name, message, likes, created_at from new_msgs
  where message_id not in (select message_id from public.messages)
  returning 1) select count(*) as messages_added from ins;
commit;

select (select count(*) from added_subs) as games_added,
       (select string_agg(name || ' ' || coalesce('challenge ' || challenge_id, day::text), ', ') from added_subs) as which;
