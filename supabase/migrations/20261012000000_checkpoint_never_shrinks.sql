-- A daily game's progress only ever grows (guesses can't be taken back, penalties only add up).
-- Saves can land out of order (several in flight, retries, a second device mounting with an empty
-- board before it restores), so a stale save must never overwrite a longer history.
create or replace function save_checkpoint(p_penalty double precision, p_history jsonb) returns void
language sql volatile security definer set search_path = public as $$
  update checkpoints
  set history = case when jsonb_array_length(p_history) >= jsonb_array_length(history)
                     then p_history else history end,
      penalty = greatest(penalty, p_penalty)
  where name = require_me() and day = current_date
    and jsonb_typeof(p_history) = 'array'
$$;
