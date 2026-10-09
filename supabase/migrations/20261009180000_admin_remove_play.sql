-- Admin-only: remove a player's play (daily by default, or one challenge) and recompute what depends
-- on it. Not granted to anon/authenticated (default privileges revoke execute), so only the database
-- owner can call it: SQL editor, or Claude via the Supabase connector:
--   select admin_remove_play('jacktest');                         -- today's daily
--   select admin_remove_play('jacktest', date '2026-10-09');      -- a given day's daily
--   select admin_remove_play('jacktest', null, 767);              -- a challenge play
create function admin_remove_play(p_name text, p_day date default current_date, p_challenge_id integer default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare removed jsonb; w date;
begin
  with d as (
    delete from submissions
    where name = p_name
      and case when p_challenge_id is null then challenge_id is null and day = p_day
               else challenge_id = p_challenge_id end
    returning submission_id, day, "time", challenge_id)
  select coalesce(jsonb_agg(to_jsonb(d)), '[]') into removed from d;

  if p_challenge_id is null then
    -- let them start that day's game fresh
    delete from checkpoints where name = p_name and day = p_day;
    -- daily ranks for that day
    update submissions s set "rank" = r.rn
    from (select submission_id, row_number() over (order by "time", submission_id) rn
          from submissions where day = p_day and challenge_id is null) r
    where s.submission_id = r.submission_id and s."rank" <> r.rn;
    -- weekly: additive weeks are computed live; drop a memoised winner of that week if it was the removed player
    w := week_start(p_day);
    if w >= scoring_cutover() then
      delete from winners where week = w and name = p_name;
    end if;
  end if;
  return jsonb_build_object('removed', removed);
end $$;
revoke execute on function admin_remove_play(text, date, integer) from public, anon, authenticated;

-- Admin-only: correct a player's time (daily by default, or one challenge) and recompute.
--   select admin_update_time('rob', 11.5);                        -- today's daily
--   select admin_update_time('rob', 11.5, date '2026-10-08');     -- a given day's daily
--   select admin_update_time('rob', 11.5, null, 767);             -- a challenge play
create function admin_update_time(p_name text, p_time double precision, p_day date default current_date,
                                  p_challenge_id integer default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare changed jsonb; w date;
begin
  with u as (
    update submissions s set "time" = p_time
    from (select submission_id, "time" as old_time from submissions
          where name = p_name
            and case when p_challenge_id is null then challenge_id is null and day = p_day
                     else challenge_id = p_challenge_id end) o
    where s.submission_id = o.submission_id
    returning s.submission_id, s.day, o.old_time, s."time" as new_time, s.challenge_id)
  select coalesce(jsonb_agg(to_jsonb(u)), '[]') into changed from u;

  if p_challenge_id is null and changed <> '[]'::jsonb then
    update submissions s set "rank" = r.rn
    from (select submission_id, row_number() over (order by "time", submission_id) rn
          from submissions where day = p_day and challenge_id is null) r
    where s.submission_id = r.submission_id and s."rank" <> r.rn;
    w := week_start(p_day);
    if w >= scoring_cutover() then
      delete from winners where week = w;          -- memoised winner is recomputed on next view
    else
      delete from week_snapshots where week = w;   -- frozen legacy week is recomputed on next view
    end if;
  end if;
  return jsonb_build_object('changed', changed);
end $$;
revoke execute on function admin_update_time(text, double precision, date, integer) from public, anon, authenticated;
