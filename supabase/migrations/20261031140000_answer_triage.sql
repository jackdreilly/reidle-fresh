-- Answer words triage (Jack, 2026-10-31: "I'll be rapidly triaging these words ... a filter for already triaged?").
-- Besides removing a word, the owner can now mark it kept; either way it counts as triaged (reviewed_at).
-- Removed words count as triaged already.
--
-- Reidle OG (league 1) has daily_words set ahead for every day into 2027 (imported from the legacy app), so removing a
-- word also redraws it on every future day it's scheduled for (today and earlier stay as played).

alter table answers add column reviewed_at timestamptz;
update answers set reviewed_at = removed_at where removed_at is not null;

drop function admin_set_answer(text, boolean);

-- Redraws p_word wherever it's scheduled after a league's current day.
create function redraw_future_days(p_word text) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare k integer; rec record; a text;
begin
  k := 0;
  for rec in select league_id, day from daily_words where answer = p_word and day > league_day(league_id) loop
    a := random_answer();
    update daily_words set answer = a, word = (select w.word from words w where w.word <> a order by random() limit 1)
      where league_id = rec.league_id and day = rec.day;
    k := k + 1;
  end loop;
  return k;
end $$;
revoke all on function redraw_future_days(text) from public, anon, authenticated;
select redraw_future_days(answer) from answers where removed_at is not null;

create or replace function admin_answers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'active', (select count(*) from answers where removed_at is null),
    'words', (select coalesce(jsonb_agg(jsonb_build_object('word', a.answer, 'removed_at', a.removed_at, 'reviewed_at', a.reviewed_at,
                                                           'days', coalesce(d.n, 0)) order by a.answer), '[]')
              from answers a left join (select answer, count(*) n from daily_words where day <= league_day(league_id) group by answer) d using (answer)));
end $$;

-- p_state: 'keep' (stays in the pool, triaged), 'remove' (out of the pool, triaged) or 'untriaged' (back in the pool, not triaged).
create function admin_triage_answer(p_word text, p_state text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare r answers;
begin
  if not is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_state not in ('keep', 'remove', 'untriaged') then raise exception 'bad state: %', p_state using errcode = '22023'; end if;
  update answers set removed_at = case when p_state = 'remove' then coalesce(removed_at, now()) end,
                     reviewed_at = case when p_state <> 'untriaged' then now() end
    where answer = p_word returning * into r;
  if not found then raise exception 'not an answer: %', p_word using errcode = '22023'; end if;
  if p_state = 'remove' then perform redraw_future_days(r.answer); end if;
  return jsonb_build_object('word', r.answer, 'removed_at', r.removed_at, 'reviewed_at', r.reviewed_at,
                            'active', (select count(*) from answers where removed_at is null));
end $$;

revoke all on function admin_triage_answer(text, text) from public, anon;
grant execute on function admin_triage_answer(text, text) to authenticated;
