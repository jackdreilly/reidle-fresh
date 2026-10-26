do $$
declare r record;
begin
  for r in select * from (values ('alice','maya'),('bob','theo'),('carol','priya'),('dave','jordan'),('erin','sam'),('frank','nico'),('grace','rosa'),('heidi','ben')) v(o,n) loop
    update players set name = r.n where name = r.o;
    update winners set name = r.n where name = r.o;
    update messages set likes = array_replace(likes, r.o, r.n);
    update leagues set created_by = r.n where created_by = r.o;
  end loop;
end $$;
update leagues set name = 'Word Nerds' where league_id = 1;
delete from messages;
insert into messages (name, message, likes, created_at, league_id) values
  ('maya', 'PLAIN in 0:27 ☕ beat that', '{theo,priya}', now() - interval '3 hours', 1),
  ('theo', 'I had it in 3 and fat-fingered the enter key 😭', '{maya}', now() - interval '2 hours 40 minutes', 1),
  ('priya', 'theo the penalty is character building', '{maya,jordan,nico}', now() - interval '2 hours 30 minutes', 1),
  ('jordan', 'weekly is still wide open btw, maya is only 12 pts up', '{}', now() - interval '1 hour', 1),
  ('maya', 'come and get it 👑', '{rosa}', now() - interval '20 minutes', 1);

-- Today's times: close enough that a quick solve takes #1.
update submissions s set time = v.t, penalty = 0
from (values ('priya', 21.4), ('jordan', 24.9), ('maya', 27.2), ('theo', 33.8)) v(n, t)
where s.name = v.n and s.day = current_date and s.challenge_id is null and s.league_id = 1;
-- No "nudge each day" card in the footage.
update players set reminder_prompt_seen = true;
