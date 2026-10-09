-- Index tuning against the RPC access patterns (measured on prod, ~21k submissions, 33 MB heap
-- because playback json is stored inline). Daily-game reads only touch a few small columns, so
-- covering indexes let them run as index-only scans instead of visiting the fat heap rows.

-- Daily games by day: rankings() (whole history), week_scores_calc (a week), play_state/leader
-- (today, ordered by time), rerank_today. Replaces submissions_day_idx: nothing reads challenge
-- rows by day.
create index submissions_daily_by_day on submissions (day, "time")
  include (name, submission_id) where challenge_id is null;
drop index submissions_day_idx;

-- By player: player_stats (daily rows, index-only via the included columns) and the players(name)
-- foreign key (needs every row, so not partial). Replaces the plain name index.
create index submissions_by_name on submissions (name)
  include (challenge_id, day, "time", penalty, "rank");
drop index submissions_name_idx;

-- Challenge lookups (challenge_page, challenge_play, pending_challenge_ids, the challenges_page
-- join, the challenges foreign key) are all served by the unique submissions_challenge_once
-- (challenge_id, name) where challenge_id is not null, so the plain challenge_id index is redundant.
drop index submissions_challenge_idx;

analyze submissions;
