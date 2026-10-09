-- Lock the callable surface to an explicit allowlist. Internal helpers (play_payload,
-- played_today, week_scores, ...) are only ever called from other security-definer functions,
-- which run as the owner, so signed-in users must NOT be able to call them directly
-- (e.g. play_payload(<other player>) would reveal today's answer without starting the clock).
alter function week_start(date) set search_path = public;
alter function battle_is_active(battles) set search_path = public;

revoke execute on all functions in schema public from public, anon, authenticated;
-- new functions are private until explicitly granted
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  bootstrap(), play_state(), start_play(), save_checkpoint(double precision, jsonb),
  submit_daily(double precision, double precision, jsonb, text, text),
  submit_challenge(integer, double precision, double precision, jsonb, text, text),
  weekly_page(date), daily_page(date), past_winners(), get_playback(bigint),
  player_stats(text), rankings(), challenges_page(), challenge_next(), challenge_play(integer),
  challenge_page(integer), messages_page(), post_message(text), delete_message(integer),
  like_message(integer), battle_home(), new_battle(), battle_get(integer), battle_restart(integer)
to authenticated;
