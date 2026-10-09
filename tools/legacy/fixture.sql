-- Synthetic legacy data with the same warts as prod, for tools/test-import.sh.
insert into legacy.players (name, email) values ('alice','a@x.y'), ('bob', null);
insert into legacy.words values ('CRANE'),('SLATE'),('CRATE');
insert into legacy.answers values ('CRATE'),('SLATE');
insert into legacy.daily_words values (current_date, 'CRANE', 'CRATE'), (current_date + 1, 'SLATE', 'SLATE');
insert into legacy.challenges values (10, now(), 'CRANE', 'CRATE'), (11, now(), 'SLATE', 'SLATE');
insert into legacy.submissions (submission_id, name, "time", penalty, playback, day, challenge_id, paste) values
  (1, 'alice', 63.4, 0, '{"events":[{"time":1,"letter":"C"}]}', current_date - 1, null, 'p'),
  (2, 'bob',   50.0, 5, '{"events":[]}',                       current_date - 1, null, 'p'),
  (3, 'carol', 40.0, 0, '{"events":[]}',                       current_date - 1, null, 'p'),   -- orphan name
  (4, 'carol', 99.0, 0, '{"events":[]}',                       current_date - 1, null, 'dupe'), -- duplicate daily
  (5, 'bob',   30.0, 0, '{"events":[]}',                       current_date,     10,   'p'),
  (6, 'bob',   31.0, 0, '{"events":[]}',                       current_date - 1, 10,   'dupe'), -- same challenge, another day
  (7, 'dave',  20.0, 0, '{"events":[]}',                       current_date,     10,   'p'),
  (8, '',      20.0, 0, '{"events":[]}',                       current_date,     null, 'p');    -- empty name
insert into legacy.winners values ('alice', '2026-09-28'), ('bob', '2026-09-28'), ('bob', '2026-10-05');
insert into legacy.messages (message_id, name, message, likes) values (5, 'erin', 'hi', '{alice}'), (6, '', 'ghost', '{}'), (7, 'alice', '', '{}');
insert into legacy.message_reads values ('frank', now());
insert into legacy.checkpoints (name, penalty) values ('gina', 5);
insert into legacy.battles (battle_id, state, users) values (7, '{"round":1}', '["alice"]'), (40, '{}', '[]');
insert into legacy.page_views (name, url, method) values ('alice', '/', 'GET');
