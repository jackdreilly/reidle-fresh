# AGENTS.md — Reidle project context

Notes for agents working in this repo. Keep up to date when intent changes.

## What this is

Reidle = a Wordle-like daily game with head-to-head "challenges"/battles, a weekly
leaderboard, and a year-end "wrapped". Frontend is Deno Fresh (Preact, Twind),
data layer is Postgres/Supabase. Analytics SQL is written as **dbt models under
`reidbt/models/`** and compiled into `sql/*.sql`, which the Deno server reads at
runtime via `runSql` (`utils/sql_files.ts`). The compiled `sql/` files are
committed.

Build / SQL generation:
- `deno task start` — Fresh dev server.
- `deno task build` — Fresh build (what CI does; CI does **not** run dbt).
- `deno task sql` → `build_sql.ts` — runs `dbt compile --vars "{export: true}"`
  in `reidbt/` and copies compiled models into `sql/`. Requires dbt + DB
  profile (not present by default in this checkout).
- At runtime `runSql` reads `sql/<model>.sql` if it exists; only if missing does
  it invoke `dbt compile`. So **editing a dbt model is not enough** — the
  corresponding committed `sql/<model>.sql` must also be regenerated/hand-edited.

## Weekly scoring (the part currently being reworked)

Source of truth: `reidbt/models/week_table.sql`, `reidbt/models/week_json.sql`.

### Current ("lower is better", multiplicative)

- `week_table`: for the week of `$week` (Mon–Sun), cross-joins all names seen
  that week with all days seen. Per (name, day):
  - `round_time` = submission `time`, or for non-players a penalty time
    (`least(300, max(time)+120)` for that day).
  - `played` = boolean (submitted that day).
  - `score` = `ROW_NUMBER() over (partition by day order by played desc,
    round_time asc)`, capped at 9; non-players = 10. So 1 is best, 10 is worst.
- `week_json`: per name, JSON with
  - `days`: `[{day, time, score, submission_id}]`
  - `totals`: `{time: sum(round_time), score: round(exp(sum(ln(score))))}`
    (i.e. product / geometric mean of daily ranks).
  - Ordered by `total score asc, sum(time) asc` → winner is first.
- `current_winner`: takes the first row of `week_json` for the previous week and
  inserts it into `winners`.
- `update_week`: copies `week_table.score` into `submissions.score`.
  `week_table.score` is deliberately kept as the legacy rank (int, 1–9/10), so
  this model and `submissions.score` are unaffected by the additive change.
- UI: `routes/stats/weekly/[startDay].tsx` renders the table. Header uses `Π`
  (product). `getColor(score)` maps 1→green … 9→red; 10/unknown → gray.
  `islands/*` use `score` for Wordle letter scoring, unrelated.
- Other consumers of rank/score: `routes/players/[name].tsx` (player_stats
  `rank`/week chart) and `routes/api/submit.ts` (sets `submissions.rank` and
  `submissions.score = LEAST(rank, 9)` on submit).

### Implemented: additive scoring (current week onwards)

Per-day points by daily rank (rank among players who actually played):
- rank 1 = 4, rank 2 = 2, rank 3 = 1
- rank r >= 4 = `greatest(0, 1.1 - 0.1*r)` → 4th 0.7, 5th 0.6, 6th 0.5, 7th
  0.4, 8th 0.3, 9th 0.2, 10th 0.1, 11th+ 0
- did-not-play = 0

Points decrease by rank with a minimum 0.1 increment (no even split of the
remaining pool). Per-day max is 9.8 (4+2+1+2.8); not required to sum to 10.
Weekly total = sum of daily points; winner = highest total, tie-break lowest
total time. UI column `Π` → `Σ`, colors re-based on points (0–4).

Rollout / legacy split (IMPORTANT):
- `week_table` now emits `is_new` (true when the viewed week's Monday `>=` the
  current week's Monday), `score` (legacy rank, always, so `update_week`/
  `submissions.score` are untouched) and `points` (new additive value).
- `week_json` selects `points` when `is_new`, else legacy `score`; totals use
  `sum(points)` when new, else `exp(sum(ln(score)))`; ordering is
  `sum(points) desc` when new, else legacy product asc.
- The current week is therefore scored additively for **all** of its days, so a
  mid-week rollout backfills the elapsed days automatically. Prior weeks are
  untouched.
- `current_winner` is only ever called for the previous week (`utils/get_winner.ts`
  → `now - 7d`), which is `is_new = false`, so past winners stay on legacy
  scoring. `sql/current_winner.sql` is intentionally left as-is.
- No data migration/backfill is needed: weekly scores are computed on read.
  Only the code/SQL deploy matters, on local and prod alike.

Files: `reidbt/models/week_table.sql`, `reidbt/models/week_json.sql`, compiled
`sql/week_json.sql` (there is no `sql/week_table.sql`; it is ephemeral), and UI
`routes/stats/weekly/[startDay].tsx` (`startOfWeek`, `getPointsColor` vs
`getLegacyColor`). dbt is not installed in this checkout, so `sql/week_json.sql`
was hand-synced with the model.

### Still open / assumptions

1. Daily time ties keep the arbitrary `ROW_NUMBER` tie-break.
2. Fewer than 3 players on a day: 1st/2nd/3rd still get 4/2/1.

## Trash list: features removed by 791b3c1 and restored by the revert 80587d9 (DONE)

The last commit (80587d9) reverted 791b3c1 wholesale. 791b3c1 was a mixed
commit (mobile gameplay polish + messaging simplification + fixture/seed tooling)
that also deleted several features. The revert brought those features back.
These have now been deleted again (see git status / diff):
- Wrapped year-in-review: `routes/wrapped/**` (7 pages + index), `wrapped.py`,
  `static/wrapped.jpg`, `sql/wrapped/**` (12 queries), and wrapped schema entries
  in `utils/sql_files.ts`.
- Dev dashboard: `state_of_reidle.py`.
- Email reminder subsystem: `routes/unsubscribe.tsx`,
  `reidbt/models/emails_to_send.sql`, `sql/emails_to_send.sql`,
  `reidbt/models/my_account.sql`, `sql/my_account.sql`, plus the email /
  `notifications_enabled` fields on `Player` in `schema.py`, the
  `emails_to_send` view type in `utils/supabase.ts`, and the notification form
  in `routes/account.tsx`.
- Shared references cleaned: `fresh.gen.ts` (regenerated via `deno task build`),
  nav links in `components/reidle_template.tsx`, `build_sql.ts` wrapped skip,
  `utils/sql_files.ts`, `utils/supabase.ts`, `reidbt/models/sources.yml`.
  `islands/Battle.tsx` line `channel.unsubscribe()` is unrelated (keep).
- Byproduct files 791b3c1 *added* (BUGS.md, `fixtures/daily_history.sql`, the two
  migrations) are absent after the revert and were intentionally NOT brought back.
- No Alembic migration was created for the dropped `players.email` /
  `notifications_enabled` columns or the `emails_to_send` view; `migrations/versions/`
  is gitignored and empty in this checkout. DB columns, if present, are now unused.

## Local dev / fixtures

Local Homebrew Postgres works with the app's default URL
(`postgres://postgres:postgres@localhost:5432/postgres`), so no env is needed.
Two helper scripts (not run by CI, safe to re-run):

- `.venv/bin/python scripts/init_local_db.py` — drops/recreates `public` from
  `schema.py`, then adds the bits `schema.py` cannot express but the app needs:
  the `page_views` table, the `submissions_submission_id_seq` default for
  `submissions.submission_id` (required or every submit 500s), and the
  `messages.likes` column (required by `/messages` and the like endpoint).
- `.venv/bin/python scripts/seed_local_data.py` — seeds `players`, `submissions`
  (a full legacy prior week + an additive current week with decreasing
  participation) and the word lists (`words`, `answers`, `daily_words` from
  `static/words.csv` / `static/answers.csv`).

Then `deno task start` and sign in at `/sign-in` as `alice` … `heidi`:
- current week (Σ additive): `/stats/this_week` (redirects to `/stats/weekly/<today>`)
- prior week (Π legacy): `/stats/weekly/<last monday>`
- play: `/play`. The fixture plays `alice/bob/carol/dave` today, so use
  `erin/frank/grace/heidi` to have an unplayed daily game.

Screenshots were validated with `playwright-core` + system Chrome
(`chromium.launch({ channel: "chrome" })`), no console/page errors.

## Key files map

- Scoring: `reidbt/models/week_table.sql`, `week_json.sql`, `current_winner.sql`,
  `update_week.sql`; compiled in `sql/`.
- Weekly UI: `routes/stats/weekly/[startDay].tsx`, `routes/stats/this_week.tsx`.
- Types: `utils/sql_files.ts` (`WeekOutput`, `current_winner` schema).
- Winner: `utils/get_winner.ts`.
- Submit / rank: `routes/api/submit.ts`, `schema.py` (`Submission.score`).
- Challenges/battles scoring (separate system, additive already):
  `reidbt/models/{winner_points,loser_points,total_points,rankings}.sql`.
- Removed: wrapped (`routes/wrapped`, `wrapped.py`, `sql/wrapped`), state_of_reidle,
  email reminders (`unsubscribe`, `emails_to_send`, `my_account`, player email /
  notifications). `routes/account.tsx` is now just the profile header.
