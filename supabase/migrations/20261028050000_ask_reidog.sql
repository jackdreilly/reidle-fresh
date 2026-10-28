-- Ask Reidog (Jack, 2026-10-28: "scrap the ask jack, replace with ask Reidog AI chat"): players ask an AI help dog how
-- Reidle works. The `ask` edge function (supabase/functions/ask) answers with Gemini; it calls these RPCs with the
-- player's own token, so PostgREST checks who is asking and lg() picks their league from the x-league header.
--   ask_begin(question) -> who is asking and their league (for the prompt), within a daily cap; logs the question
--   ask_finish(id, answer, ms, model) -> stores the answer, so /admin can show what people ask
-- Contact Jack (20261028030000_contact.sql, since deleted) only ever reached staging: this clears it there and is a
-- no-op everywhere else (prod never had it). bootstrap() and admin_page() below replace its versions too.

drop function if exists contact_page(), send_feedback(text, text, text, text), admin_inbox(), admin_feedback(text),
  admin_reply(text, text), admin_feedback_done(text, boolean), feedback_messages(text);
drop table if exists feedback, feedback_threads;

create table ask_log (
  id bigint generated always as identity primary key,
  name text not null references players (name) on update cascade on delete cascade,
  league_id bigint references leagues (league_id) on delete set null,
  question text not null check (char_length(question) between 1 and 1000),
  answer text check (char_length(answer) <= 8000),
  ms integer,
  model text,
  created_at timestamptz not null default now()
);
create index ask_log_name_at on ask_log (name, created_at);
create index ask_log_at on ask_log (created_at);
alter table ask_log enable row level security;
revoke all on ask_log from anon, authenticated;

create function ask_begin(p_question text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := me();
  l bigint := lg();
  q text := btrim(p_question);
  id bigint;
begin
  if n is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if coalesce(q, '') = '' then raise exception 'Ask a question first'; end if;
  if (select count(*) from ask_log where name = n and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Reidog needs a nap: that''s 50 questions today. Try again tomorrow!';
  end if;
  insert into ask_log (name, league_id, question) values (n, l, left(q, 1000)) returning ask_log.id into id;
  return jsonb_build_object('id', id, 'name', n, 'account', account_kind(), 'played_today', played_today(n),
    'league', league_brief(l) || coalesce((select jsonb_build_object('is_public', x.is_public, 'open_invite', x.open_invite,
      'members', (select count(*) from league_members m where m.league_id = x.league_id)) from leagues x where x.league_id = l), '{}'),
    'leagues', (select count(*) from league_members where name = n));
end $$;

create function ask_finish(p_id bigint, p_answer text, p_ms integer, p_model text) returns void
language sql volatile security definer set search_path = public as $$
  update ask_log set answer = left(p_answer, 8000), ms = p_ms, model = left(p_model, 60)
  where id = p_id and name = me() and answer is null
$$;

-- /admin: what people ask Reidog (last 100), next to everything else in its one call.
create or replace function admin_page(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select admin_stats(p_days) || jsonb_build_object('growth', admin_growth(p_days),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'question', a.question, 'answer', a.answer,
                                                          'ms', a.ms, 'at', a.created_at) order by a.created_at desc)
                      from (select * from ask_log order by created_at desc limit 100) a), '[]'),
    'asks_7d', (select count(*) from ask_log where created_at > now() - interval '7 days'))
$$;

-- bootstrap() as it was before Contact Jack (20261025060000_growth.sql)
create or replace function bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  with ctx as (select me() as n, lg() as l)
  select jsonb_build_object(
    'name', ctx.n,
    'played_today', played_today(ctx.n),
    'unread', coalesce(
      coalesce((select last_read from message_reads where league_id = ctx.l and name = ctx.n), 'epoch')
        < (select max(created_at) from messages where league_id = ctx.l), false),
    'pending_challenges', case when ctx.n is null or ctx.l is null then 0
      else (select count(*) from pending_challenge_ids(ctx.n)) end,
    'account', case when ctx.n is not null then account_kind() end,
    'legacy_until', case when ctx.n is not null and account_kind() = 'legacy'
      then (select case when legacy_logins then legacy_until else 'epoch' end from app_flags) end,
    'nickname_set', (select nickname_set from players where name = ctx.n),
    'tour_seen', (select tour_seen from players where name = ctx.n),
    -- after their first finished game, until they answer it once (or set a reminder in Settings)
    'reminder_prompt', (select not p.reminder_prompt_seen
                          and exists (select 1 from submissions s where s.name = p.name)
                          and not exists (select 1 from notify_prefs np where np.name = p.name and np.reminder_before is not null)
                        from players p where p.name = ctx.n),
    'league', league_brief(ctx.l),
    'leagues', coalesce((select jsonb_agg(jsonb_build_object('id', x.league_id, 'name', x.name)
                                          order by m.joined_at, m.league_id)
                         from league_members m join leagues x using (league_id) where m.name = ctx.n), '[]'))
  from ctx
$$;

revoke all on function ask_begin(text), ask_finish(bigint, text, integer, text) from public, anon;
grant execute on function ask_begin(text), ask_finish(bigint, text, integer, text) to authenticated;
-- keep ask_log a year, like events
select cron.schedule('reidle-ask-cleanup', '29 4 * * *', $$delete from public.ask_log where created_at < now() - interval '1 year'$$);
