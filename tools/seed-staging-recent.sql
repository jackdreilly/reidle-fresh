-- STAGING ONLY (reidle-staging). Never run on prod.
--
-- Seeds last week and this week with believable games, so the Leagues cards (to play / done today, week place
-- and gap, Yesterday), the Week tab (place and points), Resume, challenges and chat all have something to show.
-- Run the whole file in one go (Supabase SQL editor, or one execute_sql call through the MCP connector): the
-- pg_temp helpers only live for that session. Safe to re-run: a day that already has plays is left alone.
--
-- Leagues and what player `jack` sees when it runs on a Wednesday (on another weekday the this-week rows on or
-- after today are skipped and today's row still lands on today):
--   Reidle OG (1)          9 fixture players, close race; jack started today but has not finished (Resume)
--   Reidle Global (2)      7 players; jack played today, 2nd behind grace; leads the week
--   Lunch Crew (120)       private, 'field' scoring; 2 others played today, jack hasn't (Play)
--   Weekend Warriors (121) private, best 5 days count; nobody has played today
-- Each day's word comes from ensure_daily_word(); every play gets a hard-mode game for that word whose last key
-- lands on its time (paste + playback), so Today, replays and pastes all agree.
-- Times are in the past, so no push notifications go out.

update leagues set tz = 'America/Los_Angeles' where league_id = 1 and tz <> 'America/Los_Angeles';  -- as on prod

insert into leagues (league_id, name, is_public, tz, reset_hour, scoring, created_by, created_at) values
  (120, 'Lunch Crew', false, 'America/Los_Angeles', 0,
   '{"mode":"field","points":[40,20,10,7,6,5,4,3,2,1],"no_show":0,"best_of":null}', 'jack', now() - interval '20 days'),
  (121, 'Weekend Warriors', false, 'America/Los_Angeles', 0,
   '{"mode":"table","points":[40,20,10,7,6,5,4,3,2,1],"no_show":0,"best_of":5}', 'alice', now() - interval '15 days')
on conflict (league_id) do nothing;

insert into league_members (league_id, name, role, joined_at)
select v.l, v.n, v.r, now() - v.ago * interval '1 day' from (values
  (1, 'jack', 'member', 30), (2, 'jack', 'member', 25),
  (2, 'bob', 'member', 24), (2, 'dave', 'member', 23), (2, 'erin', 'member', 22), (2, 'frank', 'member', 21),
  (2, 'grace', 'member', 20), (2, 'heidi', 'member', 19),
  (120, 'jack', 'commissioner', 20), (120, 'carol', 'member', 19), (120, 'dave', 'member', 19),
  (120, 'frank', 'member', 18), (120, 'heidi', 'member', 18),
  (121, 'alice', 'commissioner', 15), (121, 'jack', 'member', 14), (121, 'erin', 'member', 14),
  (121, 'grace', 'member', 13)) v(l, n, r, ago)
where exists (select 1 from players p where p.name = v.n)
on conflict (league_id, name) do nothing;

create function pg_temp.wscore(g text, a text) returns int[] language plpgsql immutable as $$
declare s int[] := array[2,2,2,2,2]; rem text := ''; i int; p int;
begin
  for i in 1..5 loop
    if substr(g, i, 1) = substr(a, i, 1) then s[i] := 0; else rem := rem || substr(a, i, 1); end if;
  end loop;
  for i in 1..5 loop
    if s[i] <> 0 then
      p := strpos(rem, substr(g, i, 1));
      if p > 0 then s[i] := 1; rem := overlay(rem placing '_' from p for 1); end if;
    end if;
  end loop;
  return s;
end $$;
create function pg_temp.fake_game(p_start text, p_answer text, p_secs double precision)
returns table (paste text, playback jsonb) language plpgsql volatile as $$
declare
  guesses text[] := array[upper(p_start)];
  scores text[] := array[pg_temp.wscore(upper(p_start), upper(p_answer))::text];
  mids int := greatest(1, least(4, round(p_secs / 22)::int + (random() < 0.3)::int));
  g text; k int; i int; t int := 70; fin int := round(p_secs * 1000)::int; target int;
  ev jsonb := '[]'; rw jsonb; emo text[] := array['🟩','🟨','⬜']; lines text[] := '{}';
begin
  for k in 1..mids loop
    select a.answer into g from answers a
    where a.answer <> upper(p_answer) and not a.answer = any (guesses)
      and (select bool_and(pg_temp.wscore(guesses[j], a.answer)::text = scores[j])
           from generate_subscripts(guesses, 1) j)
    order by random() limit 1;
    exit when g is null;
    guesses := guesses || g;
    scores := scores || pg_temp.wscore(g, upper(p_answer))::text;
  end loop;
  guesses := guesses || upper(p_answer);
  scores := scores || '{0,0,0,0,0}'::text;

  for k in 1..array_length(guesses, 1) loop
    if k > 1 then
      target := 70 + ((fin - 70) * (k - 1)) / (array_length(guesses, 1) - 1);
      t := greatest(t + 400, t + ((target - t) * (0.7 + random() * 0.15))::int - 600);
      for i in 1..5 loop
        t := t + 70 + (random() * 80)::int;
        ev := ev || jsonb_build_object('time', t, 'letter', substr(guesses[k], i, 1));
      end loop;
      t := greatest(t + 60, case when k = array_length(guesses, 1) then fin else target end);
    else
      t := 60;
    end if;
    select jsonb_agg(jsonb_build_object('score', (scores[k]::int[])[ix.n], 'letter', substr(guesses[k], ix.n, 1)) order by ix.n),
           string_agg(emo[(scores[k]::int[])[ix.n] + 1], '' order by ix.n)
      into rw, g from generate_series(1, 5) ix(n);
    ev := ev || jsonb_build_object('time', t, 'score', rw);
    lines := lines || g;
    if k < array_length(guesses, 1) then ev := ev || jsonb_build_object('time', t + 8, 'clear', true); t := t + 8; end if;
  end loop;
  paste := array_to_string(lines, E'\n');
  playback := jsonb_build_object('events', ev);
  return next;
end $$;

-- Daily plays. off: 0..6 last week Mon..Sun, 7..8 this Mon..Tue, -1 today. names: fastest first; anyone missing
-- skipped that day.
do $$
declare
  t date := league_day(2);
  m date := week_start(league_day(2)) - 7;
  r record; d date; k int; secs float8;
begin
  for r in select * from (values
    (1, 0, array['alice','jack','bob','carol','dave','erin','frank','grace']),
    (1, 1, array['jack','bob','alice','erin','carol','dave','heidi','frank']),
    (1, 2, array['bob','alice','jack','carol','frank','grace','erin','heidi']),
    (1, 3, array['alice','jack','carol','bob','dave','erin','grace','heidi']),
    (1, 4, array['jack','alice','dave','carol','bob','frank','heidi','erin']),
    (1, 5, array['carol','alice','bob','erin','grace','dave','frank','heidi']),
    (1, 6, array['jack','alice','bob','dave','carol','heidi','grace','frank']),
    (1, 7, array['bob','jack','alice','carol','erin','dave','grace','frank']),
    (1, 8, array['jack','bob','carol','alice','dave','heidi','erin','grace']),
    (1, -1, array['alice','carol','bob','erin','dave']),
    (2, 0, array['erin','grace','jack','bob','dave','heidi','frank']),
    (2, 1, array['erin','jack','grace','frank','dave','bob']),
    (2, 2, array['grace','erin','bob','jack','heidi','dave','frank']),
    (2, 3, array['erin','jack','dave','grace','frank']),
    (2, 4, array['jack','erin','grace','bob','heidi','dave']),
    (2, 5, array['erin','grace','frank','jack','dave']),
    (2, 6, array['grace','erin','jack','bob','heidi','frank','dave']),
    (2, 7, array['jack','grace','erin','dave','frank','heidi']),
    (2, 8, array['erin','jack','grace','heidi','dave','bob']),
    (2, -1, array['grace','jack','frank','erin','bob']),
    (120, 0, array['carol','jack','dave','frank','heidi']),
    (120, 1, array['jack','carol','heidi','dave']),
    (120, 2, array['carol','heidi','jack','frank','dave']),
    (120, 3, array['dave','carol','jack']),
    (120, 4, array['carol','jack','frank','heidi','dave']),
    (120, 5, array['heidi','carol']),
    (120, 7, array['heidi','jack','carol','dave','frank']),
    (120, 8, array['jack','carol','frank','dave']),
    (120, -1, array['dave','heidi']),
    (121, 0, array['alice','jack','erin']),
    (121, 1, array['grace','alice']),
    (121, 2, array['jack','alice','erin','grace']),
    (121, 3, array['alice','erin']),
    (121, 5, array['jack','grace','alice','erin']),
    (121, 6, array['alice','jack']),
    (121, 7, array['erin','jack']),
    (121, 8, array['alice','grace','jack'])
  ) p(league, off, names)
  loop
    d := case when r.off = -1 then t else m + r.off end;
    continue when (r.off >= 0 and d >= t)
      or exists (select 1 from submissions where league_id = r.league and day = d and challenge_id is null
                 and name = any (r.names));
    perform ensure_daily_word(r.league, d);
    secs := 18 + random() * 20;
    for k in 1..array_length(r.names, 1) loop
      secs := secs + 2 + random() * 9;
      insert into submissions (league_id, day, name, paste, playback, "time", penalty, word, created_at)
      select r.league, d, r.names[k], g.paste, g.playback, round(secs::numeric, 3)::float8, 0, w.answer,
             least(((d + time '06:40')::timestamp + k * interval '47 minutes' + (r.league % 7) * interval '9 minutes')
                     at time zone 'America/Los_Angeles',
                   now() - interval '15 minutes' - (10 - k) * interval '3 minutes')
      from daily_words w, pg_temp.fake_game(w.word, w.answer, round(secs::numeric, 3)::float8) g
      where w.league_id = r.league and w.day = d
      on conflict (league_id, day, name) where challenge_id is null do nothing;
    end loop;
    perform rerank(r.league, d);
  end loop;
end $$;

-- Started-not-finished games for jack (Resume): today's starting word plus one guess, in OG and Lunch Crew,
-- unless jack already played there today.
insert into checkpoints (league_id, name, day, penalty, history, created_at)
select l, 'jack', league_day(l), 0,
       (select jsonb_agg(z.sc order by z.n) from (
          select e -> 'score' as sc, n, row_number() over (order by n) as rn
          from jsonb_array_elements(g.playback -> 'events') with ordinality ev(e, n) where e ? 'score') z
        where z.rn <= 2),
       now() - interval '40 seconds'
from unnest(array[1, 120]) l
join daily_words w on w.league_id = l and w.day = league_day(l)
cross join lateral pg_temp.fake_game(w.word, w.answer, 40) g
where not exists (select 1 from submissions s where s.league_id = l and s.day = league_day(l)
                  and s.challenge_id is null and s.name = 'jack')
on conflict (league_id, name) do update
  set day = excluded.day, penalty = 0, history = excluded.history, created_at = excluded.created_at
  where checkpoints.day <> excluded.day;

-- Challenges: 2 open in OG today (alice's, which erin also beat, and bob's), 1 finished in Lunch Crew yesterday.
do $$
declare
  t date := league_day(2); c record; cid int; a text; k int;
begin
  for c in select * from (values
    (1, 0, array['alice','erin'], interval '4 hours'), (1, 0, array['bob'], interval '2 hours'),
    (120, 1, array['carol','jack'], interval '26 hours')) v(league, ago, names, at)
  loop
    continue when exists (select 1 from challenges x join submissions s using (challenge_id)
                          where x.league_id = c.league and x.day = t - c.ago and s.name = c.names[1]);
    a := random_answer();
    insert into challenges (league_id, day, starting_word, answer, created_at)
    values (c.league, t - c.ago, (select answer from answers where answer <> a order by random() limit 1), a, now() - c.at)
    returning challenge_id into cid;
    for k in 1..array_length(c.names, 1) loop
      insert into submissions (league_id, day, name, challenge_id, paste, playback, "time", penalty, word, "rank", created_at)
      select c.league, t - c.ago, c.names[k], cid, g.paste, g.playback, x.secs, 0, a, k, now() - c.at + k * interval '35 minutes'
      from challenges ch
      cross join lateral (select round((28 + k * 7 + random() * 10)::numeric, 3)::float8 as secs) x
      cross join lateral pg_temp.fake_game(ch.starting_word, ch.answer, x.secs) g
      where ch.challenge_id = cid;
    end loop;
  end loop;
end $$;

-- Chat over both weeks.
insert into messages (league_id, name, message, likes, created_at)
select v.league, v.name, v.msg, v.likes, (week_start(league_day(2)) - 7 + v.off + v.at)::timestamp at time zone 'America/Los_Angeles'
from (values
  (1, 'alice', 'that ending word was brutal', array['bob','carol'], 0, time '08:12'),
  (1, 'jack', 'got lucky on the second guess, not gonna lie', array['alice'], 1, time '07:55'),
  (1, 'bob', 'Wednesday is mine', '{}'::text[], 2, time '09:31'),
  (1, 'carol', 'who keeps finishing before 7am', array['dave','erin'], 5, time '10:02'),
  (1, 'alice', 'close one this week jack', array['jack'], 6, time '18:40'),
  (1, 'jack', 'next week', '{}'::text[], 6, time '18:52'),
  (1, 'bob', 'two days in, two podiums', array['grace'], 8, time '12:15'),
  (1, 'alice', 'set a challenge if anyone wants it', '{}'::text[], 9, time '08:05'),
  (2, 'erin', 'hi all, found this through a friend', array['grace','jack'], 0, time '08:20'),
  (2, 'grace', 'welcome! daily word is good today', '{}'::text[], 0, time '08:44'),
  (2, 'jack', 'grace with the 1st again', array['grace'], 9, time '09:10'),
  (120, 'carol', 'lunch crew rematch tomorrow?', array['jack','dave'], 3, time '12:30'),
  (120, 'heidi', 'finally a win', array['carol','jack','frank'], 7, time '12:05'),
  (120, 'dave', 'early bird today', '{}'::text[], 9, time '07:50'),
  (121, 'alice', 'weekend games count double in my heart', array['grace'], 5, time '10:30'),
  (121, 'erin', 'only your best 5 days count, so skipping one is fine', array['alice'], 7, time '09:00')
) v(league, name, msg, likes, off, at)
where (week_start(league_day(2)) - 7 + v.off + v.at)::timestamp at time zone 'America/Los_Angeles' < now() - interval '15 minutes'
  and not exists (select 1 from messages x where x.league_id = v.league and x.name = v.name and x.message = v.msg);
