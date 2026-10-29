-- More for Reidog to look up (Jack, 2026-10-29: "check chat logs to see if there's some extra tooling or intelligence you
-- can provide reidog"). From the questions asked so far:
--   - "What did I misspell today" got "I can't see your guesses": guesses only lived in the replay json. reidog.guesses
--     replays it into one row per guess or penalty, with the same visibility as the app's replays (get_playback).
--   - "Who's the best player" tripped over week_standings returning one jsonb array: reidog.week_table gives rows.

-- One row per scored guess or penalty in a replay (src/lib/playback.ts). The word typed for a penalty isn't stored with
-- it, so it's rebuilt from the key events before it, the way Game.tsx edits the current word.
create function reidog.replay(p jsonb) returns table (step int, at_seconds numeric, guess text, tiles text, penalty int, penalty_reason text)
language plpgsql immutable set search_path = pg_catalog as $$
declare
  e jsonb;
  buf text := '';
begin
  step := 0;
  for e in select x from jsonb_array_elements(coalesce(p -> 'events', '[]')) x loop
    if e ? 'letter' then buf := left(buf, 4) || (e ->> 'letter');
    elsif e ? 'backspace' then buf := left(buf, greatest(length(buf) - 1, 0));
    elsif e ? 'clear' then buf := '';
    elsif e ? 'score' then
      step := step + 1;
      at_seconds := round((e ->> 'time')::numeric / 1000, 1);
      guess := (select string_agg(upper(t ->> 'letter'), '' order by i) from jsonb_array_elements(e -> 'score') with ordinality s(t, i));
      tiles := (select string_agg(case t ->> 'score' when '0' then '🟩' when '1' then '🟨' else '⬛' end, '' order by i)
                from jsonb_array_elements(e -> 'score') with ordinality s(t, i));
      penalty := null; penalty_reason := null;
      buf := '';
      return next;
    elsif e ? 'error' and coalesce((e -> 'error' ->> 'penalty')::int, 0) > 0 then
      step := step + 1;
      at_seconds := round((e ->> 'time')::numeric / 1000, 1);
      guess := nullif(upper(buf), ''); tiles := null;
      penalty := (e -> 'error' ->> 'penalty')::int;
      penalty_reason := case when e -> 'error' ->> 'message' = 'Not a word' then 'not a word'
                             else 'ignored a clue: ' || (e -> 'error' ->> 'message') end;
      return next;
    end if;
  end loop;
end $$;

create view reidog.guesses with (security_barrier) as
  select s.submission_id, s.league_id, s.challenge_id, s.day, reidog.today(s.league_id) - s.day as days_ago,
         s.league_id = (select league_id from reidog.who()) as current_league, s.name,
         r.step, r.at_seconds,
         -- the solving guess of today's daily is today's word: never shown
         case when s.challenge_id is null and s.day >= reidog.today(s.league_id) and r.tiles = '🟩🟩🟩🟩🟩' then null else r.guess end as guess,
         r.tiles, r.penalty, r.penalty_reason
  from submissions s cross join lateral reidog.replay(s.playback) r
  where s.league_id in (select reidog.my_leagues()) and s.playback is not null and (
    case when s.challenge_id is null
      then s.day < reidog.today(s.league_id)
        or exists (select 1 from submissions m where m.league_id = s.league_id and m.day = s.day
                   and m.challenge_id is null and m.name = (select name from reidog.who()))
      else exists (select 1 from submissions m where m.challenge_id = s.challenge_id and m.name = (select name from reidog.who()))
    end);

-- A week's standings as rows, in standings order.
create function reidog.week_table(p_week date, p_league bigint default null)
returns table (place int, name text, points numeric, total_time numeric, days_played int)
language sql stable set search_path = reidog, pg_catalog as $$
  select x.i::int, x.r ->> 'name', (x.r -> 'results' -> 'totals' ->> 'score')::numeric,
         round((x.r -> 'results' -> 'totals' ->> 'time')::numeric, 1),
         jsonb_array_length(coalesce(x.r -> 'results' -> 'days', '[]'))
  from jsonb_array_elements(coalesce(reidog.week_standings(p_week, p_league), '[]')) with ordinality x(r, i)
$$;

revoke all on function reidog.replay(jsonb), reidog.week_table(date, bigint) from public;
grant select on reidog.guesses to reidog_reader;
grant execute on function reidog.replay(jsonb), reidog.week_table(date, bigint) to reidog_reader;
