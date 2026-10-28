-- Reidog's views, a little easier for the model to query (first tries on staging tripped over "name is ambiguous" when
-- joining leagues, and over date arithmetic): leagues.name is league_name, and daily_results / challenges say how many
-- days ago they were (0 = today in that league) and whether they're in the player's current league.
drop view reidog.leagues, reidog.daily_results, reidog.challenges;

create view reidog.leagues with (security_barrier) as
  select l.league_id, l.name as league_name, l.is_public, l.tz, l.reset_hour, l.scoring, l.open_invite, l.created_by, l.created_at,
         reidog.today(l.league_id) as today, m.role as my_role, l.league_id = w.league_id as is_current,
         (select count(*) from league_members x where x.league_id = l.league_id) as members
  from reidog.who() w join league_members m on m.name = w.name join leagues l on l.league_id = m.league_id;

create view reidog.daily_results with (security_barrier) as
  select s.submission_id, s.league_id, s.day, s.name, s."time", s.penalty, s."rank", s.created_at as played_at,
         reidog.today(s.league_id) - s.day as days_ago, s.league_id = (select league_id from reidog.who()) as current_league,
         case when s.day < reidog.today(s.league_id) then upper(s.word) end as answer,
         case when s.day < reidog.today(s.league_id) or exists (
           select 1 from submissions m where m.league_id = s.league_id and m.day = s.day and m.challenge_id is null
             and m.name = (select name from reidog.who())) then s.paste end as paste
  from submissions s
  where s.challenge_id is null and s.league_id in (select reidog.my_leagues());

create view reidog.challenges with (security_barrier) as
  select c.challenge_id, c.league_id, c.day, reidog.today(c.league_id) - c.day as days_ago,
         c.league_id = (select league_id from reidog.who()) as current_league, c.created_at, upper(c.starting_word) as starting_word,
         case when exists (select 1 from submissions m where m.challenge_id = c.challenge_id
                           and m.name = (select name from reidog.who())) then upper(c.answer) end as answer,
         (select s.name from submissions s where s.challenge_id = c.challenge_id order by s.created_at limit 1) as set_by,
         (select count(*) from submissions s where s.challenge_id = c.challenge_id) as players
  from challenges c where c.league_id in (select reidog.my_leagues());

grant select on reidog.leagues, reidog.daily_results, reidog.challenges to reidog_reader;
