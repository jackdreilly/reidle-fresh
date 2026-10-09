-- Fake-data fixture, relative to today so it never goes stale.
-- Players are created without auth users; signing in as one links it (auth trigger).
insert into players (name) values
  ('alice'),('bob'),('carol'),('dave'),('erin'),('frank'),('grace'),('heidi');

-- Daily words for a window around today.
insert into daily_words (day, word, answer)
select current_date + o,
  (select word from words order by md5(o::text || 'w') limit 1),
  (select answer from answers order by md5(o::text || 'a') limit 1)
from generate_series(-21, 7) o;

-- Submissions: previous week = full (legacy scoring); current week = shrinking
-- participation (additive scoring). alice/bob/carol/dave also played today.
with names as (
  select n, i from unnest(array['alice','bob','carol','dave','erin','frank','grace','heidi'])
    with ordinality as t(n, i)),
days as (select current_date - o as day, o from generate_series(0, 89) o),
plays as (
  select d.day, n.n, n.i, d.o,
    (30 + n.i * 10 + (d.o % 4) * 3 + (n.i * d.o % 5))::double precision as t,
    case
      when d.day >= date_trunc('week', current_date)::date
        then n.i <= greatest(4, 8 - (d.day - date_trunc('week', current_date)::date))  -- participation shrinks through the week
      else true
    end as plays
  from days d cross join names n)
insert into submissions (day, name, "time", penalty, word, paste, playback, "rank")
select p.day, p.n, p.t, (p.i % 3) * 10, 'crane',
  E'⬜🟨⬜⬜🟨\n🟩🟩🟨⬜⬜\n🟩🟩🟩🟩🟩',
  jsonb_build_object('events', jsonb_build_array(
    jsonb_build_object('time', 400, 'letter', 'C'),
    jsonb_build_object('time', 800, 'letter', 'R'),
    jsonb_build_object('time', 1200, 'letter', 'A'),
    jsonb_build_object('time', 1600, 'letter', 'N'),
    jsonb_build_object('time', 2000, 'letter', 'E'),
    jsonb_build_object('time', 2400, 'score', jsonb_build_array(
      jsonb_build_object('letter','C','score',2), jsonb_build_object('letter','R','score',1),
      jsonb_build_object('letter','A','score',2), jsonb_build_object('letter','N','score',2),
      jsonb_build_object('letter','E','score',1))),
    jsonb_build_object('time', 3000, 'error', jsonb_build_object('message', 'Wrong C @ 1', 'penalty', 10)))),
  (row_number() over (partition by p.day order by p.t, p.i))::int
from plays p where p.plays;

-- Challenges (today + yesterday) with submissions so the leaderboards populate.
insert into challenges (starting_word, answer, created_at)
select (select word from words order by md5(g::text) limit 1),
       (select answer from answers order by md5(g::text || 'x') limit 1),
       case when g <= 3 then now() - interval '1 hour' * g else now() - interval '1 day' end
from generate_series(1, 5) g;
insert into submissions (challenge_id, day, name, "time", penalty, word, paste)
select c.challenge_id, c.created_at::date, p.n, 20 + p.i * 7 + c.challenge_id,
       0, 'x', E'🟨⬜⬜⬜⬜\n🟩🟩🟩🟩🟩'
from challenges c
cross join unnest(array['alice','bob','carol','dave']) with ordinality p(n, i)
where (c.challenge_id + p.i) % 4 <> 0;

insert into messages (name, message, created_at) values
  ('alice', 'good morning reidlers', now() - interval '2 hours'),
  ('bob', '/gif cat', now() - interval '1 hour'),
  ('carol', 'check https://example.com', now() - interval '10 minutes');
