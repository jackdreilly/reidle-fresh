# AGENTS.md — Reidle

Reidle = a Wordle-like daily game with head-to-head challenges, live battles, a weekly
leaderboard and power rankings. **The whole backend is Supabase; the frontend is a static SPA.**
No app server exists. Keep it that way: lean, fast, vibe-friendly.

## Stack

- **Frontend**: Vite + Preact + Tailwind v4 (build-time), TypeScript. Static output in `dist/`,
  deployable to any CDN. Hand-rolled router (`src/router.tsx`), code-split per page.
- **Backend**: Supabase only — Postgres (schema + RPC functions), Auth, Realtime.
- **Tests**: vitest (unit), pgTAP (database), Playwright (headless E2E). All run locally and in CI.

## Layout

```
supabase/migrations/   schema + RPC layer   <- source of truth for data logic
supabase/seed/words.sql (generated) + seed.sql: fake-data fixture, relative to today
supabase/tests/        pgTAP tests (npm run test:db)
src/lib/               supabase client, auth, session store, wordle rules, time helpers
src/routes.ts          route table: path -> page chunk + data loader (one RPC each)
src/router.tsx         navigation, prefetch on hover, progress bar
src/pages/             one component per route
src/components/        Game, Battle, tables, charts, layout
src/data/*.csv         word lists (client validation AND generated DB migration)
e2e/                   Playwright specs (+ helpers: sql(), signIn(), typeWord())
tools/                 clone-db.sh, sync-auth-users.ts, gen-words-seed.mjs, check-bundle.mjs (first-load budget)
```

## Data access rules

- Tables are **closed** (RLS on, no grants) except `battles` (realtime + direct state writes).
  All reads/writes go through `security definer` RPCs in `supabase/migrations/*_rpc.sql`.
- One RPC per page returns ready-to-render `jsonb` → one round trip per page. Add new
  pages the same way: SQL function + entry in `src/routes.ts` + page component.
- Identity: `me()` resolves the player from `auth.uid()`. Auth is **name-only by design**
  (same trust model as the legacy app): `src/lib/credentials.ts` derives a deterministic
  email/password per name; sign-in tries login then signs up; a trigger links `players`.
- **Function privileges are an allowlist** (`20260101000300_harden.sql`): everything is revoked from
  PUBLIC/anon/authenticated and only the page/action RPCs are granted. A new function is private
  by default; if it is part of the API, `grant execute ... to authenticated` in its migration. Helpers
  (`play_payload`, `week_scores`, ...) must stay ungranted. pgTAP pins the exact allowlist.
  Supabase advisor lint 0029 (24 warnings, one per public RPC) and 0008 (closed tables) are expected.
- Anti-cheat is not a goal (honors system). Server-side hiding of today's pastes/playbacks exists
  but don't add more machinery for it. What matters: **starting a game is an explicit POST**
  (`start_play`), never a side effect of loading a page.
- Today's pastes/playbacks are hidden server-side until you've played (`daily_page`,
  `get_playback`, `challenge_page`). Keep that invariant (pgTAP covers it).
- Changing schema/functions: add a **new migration** (`supabase migration new x`); don't edit
  applied ones once anything is deployed. (Pre-first-deploy they were edited in place.)
- **Migrations ship through CI, never by hand.** Pushing a branch that touches `supabase/migrations/` applies the
  pending files to staging (`.github/workflows/db.yml`); "Deploy prod" applies them to prod before the Worker.
  Both use `tools/db-migrate.mjs` (Management API + `SUPABASE_ACCESS_TOKEN` secret), which records each file
  under its filename version in `supabase_migrations.schema_migrations` and refuses to run if a live DB has a
  version the repo doesn't. So don't use the MCP `apply_migration` tool or the SQL editor for schema changes
  (they record a different version and break the next run). Drift check (staging/prod vs a fresh local build,
  comments ignored): `node tools/db-migrate.mjs prod --dry-run --drift <local db url>`; prod runs it nightly.
- Word tables are DATA, not migrations (prod has its own, UPPERCASE). Local/staging fixture words come from `supabase/seed/words.sql`, generated from `src/data/*.csv` via `npm run words`.

## Leagues

Every group plays in a league (`leagues`, `league_members`, migration `*_leagues.sql`): its own daily word,
reset time (`tz` + `reset_hour`), scoring (`scoring` jsonb, set by a commissioner), weekly winners, challenges
and chat. Battles stay global. League 1 "Reidle OG" holds everyone from before leagues; league 2 "Reidle Global"
is public (invite code `global`) and is where guests and brand-new name-only players start.

- **Which league**: the client sends `x-league: <id>` on every RPC (`src/lib/league.ts`, `rpc()` in supabase.ts).
  `lg()` honours it only for a league you're in, else your first league; `bootstrap()` returns the league it
  used and the client adopts it. RPC signatures did not change. A daily game pins its league at mount (Game.tsx).
  `?league=N` on any URL switches first (notification links use it).
- **Day**: `league_day(league)` = date in its tz counted from its reset hour; resets from noon label the next
  date. Never use `current_date` in league logic; client mirror is `dayIn()` / `today()` (session.ts).
- **Tables**: per-league tables have `league_id default 1` so legacy inserts land in OG; RPCs always pass it.
- **Accounts**: `account_kind()` = guest (anonymous) | legacy (name-only) | verified (OAuth or confirmed email).
  Private leagues need verified, or legacy while `app_flags.legacy_logins` is on (the name-only grace period).
- **Nicknames**: `players.name` is still the key; renames (`set_nickname`) cascade through `on update cascade`
  foreign keys plus the plain-text copies (likes, winners, outbox, week_snapshots, leagues.created_by).
- Pages: `/` (one league -> its stats, several -> `/leagues` dashboard, none -> `/welcome`), `/league`
  (invite link, members, commissioner settings), `/leagues/new`, `/join/:code` (works signed out).
- **Who can invite**: `leagues.open_invite` (default true: every member sees the link). Off, `league_page()` returns
  `invite_code` null to non-commissioners. Public leagues always show it.

## New-player tour and Help

`src/components/Tour.tsx`: a 5-card walkthrough shown over normal pages (never in a game or before a league is picked)
while `bootstrap().tour_seen` is false. Closing it any way calls `dismiss_tour()`, which flips `players.tour_seen`,
so it stays gone on every device (guests are players too). Accounts from before the tour start with it seen.
`/help` (`src/pages/Help.tsx`) explains the basics and can replay the tour. Keep both (and Reidog's prompt) in step with features.

## Ask Reidog

`/ask` (`src/pages/Ask.tsx`, menu + Help + tour): an AI help chat. The `ask` edge function (`supabase/functions/ask`,
`verify_jwt = false`) calls `ask_begin` **as the player** (their token + x-league, so PostgREST checks auth, the 50/day
cap and the league), then streams Gemini (`GEMINI_MODEL`, default `gemini-flash-latest`) back as plain text and
stores the answer with `ask_finish`. `ask_log` feeds the "Asked Reidog" card on /admin. The system prompt
(`supabase/functions/ask/prompt.ts`) is identical for everyone (Gemini's implicit cache reuses it); per-player facts go
in a `[Player context]` part of the first user turn. **Keep prompt.ts in step with features**, like Help and the tour.
Key: GitHub secret `GEMINI_API_KEY`, copied to the function secret by db.yml (staging) and Deploy prod. Locally (no
edge runtime) the page's request fails; E2E mocks the function.

## Chat push notifications

Opt-in per browser from the Messages page (`src/lib/push.ts`, bell button). Subscriptions live in the closed
`push_subscriptions` table (`push_subscribe`/`push_unsubscribe`). Sending is the one edge function,
`supabase/functions/push` (Deno, `verify_jwt = false` in config.toml): the page POSTs to it after posting; it
claims recent unsent messages once (`push_claim`, service_role only) and Web-Pushes them to everyone else's
browsers; `public/sw.js` shows them. VAPID keys are generated on first use into `push_vapid` (no secrets to set).
CI deploys functions (db.yml -> staging, Deploy prod -> prod). Local stack runs no edge runtime: the page's ping
just fails silently; run the function with `deno run -A supabase/functions/push/index.ts` to try it.
iPhone/iPad: push only works from the Home Screen app (iOS 16.4+).

## Scoring (weekly)

`week_scores(date)` in `*_rpc.sql`. Current week = additive points per day by rank among
players who played: 1st 40, 2nd 20, 3rd 10, rank r>=4 `max(0, 11-r)`, no-show 0 (whole numbers); total = sum,
winner = highest, tie → lowest total time. Past weeks keep the **legacy** score
(geometric product of capped daily ranks; no-show 10). `last_week_winner()` memoises into
`winners`. Challenges leaderboard (`challenges_page`) is a separate additive system:
win = +player_count, every played challenge = -1.

## Commands

```
npm run db:start        # local Supabase (Docker; headless, no studio)
npm run db:reset        # migrations + seed fixture
npm run dev             # http://127.0.0.1:3000 against local Supabase (.env.development)
npm run check           # typecheck + unit + pgTAP + E2E + build (what CI runs)
npm run test:e2e        # resets DB, builds + serves the prod bundle, runs Playwright headless
npm run qa:staging      # closed-loop QA against the DEPLOYED staging site (throwaway `qa…` players)
npm run sandbox:up      # agent sandbox: (re)start dockerd + local Supabase if they died
```
Playwright in the Claude web sandbox: `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.
Docker daemon may need `dockerd &` first in the sandbox.

## Logins

Sign-in page (also the signed-out landing page: dog, what Reidle is, 3 steps): sign-in is the main path (Google's button, then
email), with a quieter "Not ready? Try it as a guest" link (Supabase anonymous sign-in, starts in Reidle Global) and the old
name-only form (folded away). **Invite links** (`/join/:code`, `Join.tsx`) carry the same login options inline: private leagues
need a login (guests see "Save your account to join", which links), and a returning `?join=1` joins by itself; anyone not
signing in gets a quiet "play as a guest in Reidle Global" link. Guest helpers live in `src/lib/guest.ts`. Guests and name-only players **link** Google or an email from
Settings (same auth user, same history); after linking, `finishLink()` replaces the name-derived password so the
name can't be typed in any more. Hand-rolled in `src/lib/supabase.ts` (`auth.*`) and `src/lib/auth.ts`; OAuth
uses the implicit flow back to `/auth/callback`. New logins get an auto nickname (`pick_nickname`) and are sent
to `/nickname` once. Hosted auth settings (guests, linking, confirm email ON, email-code templates, Google) are
applied by `tools/auth-config.mjs` from CI (db.yml -> staging; GitHub secrets GOOGLE_CLIENT_ID/SECRET).
Confirm email ON means new name-only sign-ups no longer work on hosted projects; existing name-only accounts are
already confirmed. Before switching prod over, run `npm run sync-auth` so every legacy player has an account.
Locally confirmations stay off (config.toml) so E2E can still create name-only players.
**Name-only sunset**: `app_flags.legacy_until` (2026-10-28 07:00Z, midnight Pacific) ends name-only sign-in with no
deploy: `require_me()` refuses name-only accounts (the app sends them to `/save-account` to link Google/email,
keeping their history), `confirm_legacy_claim` stops confirming name claims, the sign-in page hides the name form
(`name_sign_in_open()`). Until then the banner (`AccountBanner.tsx`) shows the date. Seed sets it to `infinity`
so local/CI keep name-only test players; move the date with one `update app_flags`.

## Auth note ("email")

No email is ever sent or collected. Supabase Auth keys accounts by email, so each player name maps
to a synthetic login id `<hash>@players.reidle.app` (see `src/lib/credentials.ts`). Hosted projects
default to "Confirm email" ON, which blocks these accounts: turn it OFF per project
(Auth -> Providers -> Email) or via `supabase config push` (config.toml already has it off for local).

## Environments

| env     | DB                         | build                      |
|---------|----------------------------|----------------------------|
| local   | `supabase start` + seed    | `npm run dev`              |
| staging | separate Supabase project  | `vite build --mode staging` with `.env.staging` |
| prod    | prod Supabase project      | `vite build` with `.env.production` |

Staging builds look different on purpose (`reidle-staging` plugin in vite.config.ts): icons from `public-staging/`
(teal STAGING pill; regenerate with `python3 tools/gen-staging-icons.py`), app name "Reidle Staging", teal theme colour,
a teal strip on the header, and a STAGING tag on sign-in (`src/components/StagingTag.tsx`). Prod builds are unchanged.

Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (publishable key only; never ship service keys).

**Clone prod → staging/local** (data only; auth is never copied, logins are re-derived):
```
SOURCE_DB_URL=<read-only prod> TARGET_DB_URL=<staging or local> PROD_GUARD=<prod project ref> \
TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... npm run clone
```
Runs migrations on the target, dumps `public` data, nulls `players.user_id`, truncates+restores,
relinks existing auth users, then creates missing ones. Refuses source==target or a target
matching `PROD_GUARD`. Local URLs need `?sslmode=disable`.

## Porting legacy prod (read-only, never in place)

Legacy prod (project `reidle`) is live and uses the old schema. Plan: import into a **new**
Supabase project (staging first, then the real one) and switch the app over; legacy stays untouched.
```
SOURCE_DB_URL=<legacy, read-only role> TARGET_DB_URL=<new project> PROD_GUARD=<legacy ref> \
TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... tools/import-prod.sh      # or: npm run import-prod
npm run test:import     # proves tools/legacy/import.sql on synthetic legacy data (local)
```
Legacy facts (inspected): words/answers are UPPERCASE and differ from `src/data/*.csv`; no FKs on
names (dozens of names exist only in submissions/messages -> importer creates players); duplicate
daily/challenge submissions and `winners` weeks (first wins); json (not jsonb) columns; float4
times (cast via numeric). Dropped on purpose: `page_views`, `email`/`notifications_enabled`,
`submissions.score`, `alembic_version`. Ids are preserved. After import, run `npm run sync-auth`.
**Legacy `public.page_views` has RLS disabled (anon key can read/modify 400k rows of name/URL logs)** —
enable RLS or retire it independently of this port.

## Prod cutover runbook (legacy `reidle` -> new project)

Facts: legacy data is ~55 MB (21k submissions incl. 37 MB playback json; `page_views` 39 MB is dropped).
Import is idempotent (truncate + reload) and takes seconds. Legacy stays untouched = instant rollback.
Scoring: weeks from **2026-10-05** are additive; earlier weeks are legacy and frozen (`week_snapshots`,
pre-computed by the importer). `winners` history is imported verbatim.

1. **Project**: free plan allows 2 active projects (legacy + staging), so prod needs Pro (also: free projects
   pause after a week idle, no backups) or reuse staging as prod and create a new staging later.
2. Create prod project -> `supabase db push` -> Auth: Confirm email OFF -> deploy Worker
   `wrangler deploy --name reidle` built with `.env.production`.
3. **Rehearse** into staging as often as wanted: `npm run import-prod` (prints the verify report:
   `failed_checks` must be 0) then `npm run qa:staging`. Needs `SOURCE_DB_URL` (read-only legacy) and
   `TARGET_DB_URL` as plain env secrets (Postgres is not HTTP, so network-secret injection can't carry it).
   Players get auth users lazily on first sign-in (trigger links by name); `npm run sync-auth` is optional.
4. **Cutover** (~15 min): tell players to pause -> final `import-prod` into prod -> verify -> smoke
   (`STAGING_URL=<prod url> npm run qa:staging`) -> point the domain at the Worker. Everyone signs in once
   (cookie -> token). `public/service-worker.js` removes the legacy service worker.
5. After 1-2 stable weeks: pause/retire legacy after a final `pg_dump` archive (and fix/retire `page_views`).
Real data on staging: names + messages become readable by anyone with the staging URL/key (same exposure
as prod today: name-only honors system). Gate the Worker or scrub messages if that is a concern.

## Admin fixes (prod)

Owner-only SQL functions (not granted to clients; call from the SQL editor or the Supabase connector):
`select admin_remove_play('name' [, day] [, challenge_id]);` and `select admin_update_time('name', 12.3 [, day] [, challenge_id]);`
Both re-rank the day and clear memoised weekly results. After cutover, `tools/legacy/catchup.sql` copies games that still
landed on legacy (append-only, idempotent).

## Logging and analytics

- **Workers Logs** (`observability` in wrangler.jsonc, both Workers): every request is searchable in the Cloudflare
  dashboard (Workers & Pages -> reidle / reidle-staging -> Logs). Free plan: 200k events/day, 3 days kept.
- **Cloudflare Web Analytics** (page views, referrers, countries, Core Web Vitals; no cookies): `beacon()` in
  vite.config.ts adds Cloudflare's deferred beacon to index.html when the build has `VITE_CF_BEACON_TOKEN`
  (a public site token from Analytics & Logs -> Web Analytics). Not in the bundle budget. No token -> no beacon.
  **Prod is already tracked without it**: the reillybrothers.net zone's Web Analytics site auto-injects the beacon on
  reidle.reillybrothers.net (filter by that host). Don't set the token for prod: it would count every visit twice.
- **Supabase** keeps API, Postgres and Auth logs natively (dashboard -> Logs, or the MCP `get_logs`).
- **Activity log** (`events`, migration `*_events.sql`): triggers record sign_up / sign_in (auth.sessions) / link
  (auth.identities) / game_start (checkpoints) / game_finish (submissions) / message / league_create / league_join;
  never message text. Browser errors (window errors, unhandled rejections, router load failures, which the router
  rethrows) queue in `window.__errs` (inline script in index.html) until `src/lib/telemetry.ts` loads at idle after the
  first page and sends them to `log_error()` (anon too; capped per hour). Nothing in the first-load bundle. `log_event`
  swallows its own failures so logging can't break a game. A daily cron keeps a year (errors 90 days).
- **Visits** (`visits`, `page_views`, migration `*_visits.sql`): `src/lib/telemetry.ts` (same idle chunk as errors) sends
  each page shown as a route pattern (`/players/:name`, `/stats/daily/:date`) with its time on screen to `log_visit()`
  (anon too): a few seconds after a page change, every minute and when the tab hides. A visit = one tab until it is
  hidden 30 min. Views older than a day or in the future are dropped. Help -> Your account tells players.
- **/admin** (owner page, not in the menu): `admin_stats(days)` (KPIs, daily chart, play-time heatmap, visit lengths,
  pages, funnel, retention cohorts, leagues, players, grouped errors, activity) and `admin_player(name)` (drill-down).
  Needs a name in `admins` (prod/staging: `jack`; local seed: `alice`) AND a verified login (`is_admin()`), so the
  name-only form never opens it. Styled by `src/pages/admin.css` only: Admin.tsx is excluded from the Tailwind scan
  (`@source not` in index.css), so the dashboard adds nothing to the first-load CSS.
- **Growth** (migration `*_growth.sql`, Jack 2026-10-25): `admin_growth(days)` feeds the Leagues and Funnel sections of
  /admin (`admin_page(days)` = `admin_stats` + `growth` in one call): player-made leagues (not OG/Global) week by week (new, names, cumulative, joins,
  active) and per league with week-over-week deltas; one row per new player (started, first game, next day, week,
  saved, reminder, which league they came into); invite links (`log_invite(code, sid)` from `/join/:code`, signed out too,
  tied to the account via the telemetry tab id `reidle:sid`; members opening their own link are left out).
- **Reminder card** (`src/components/Remind.tsx`, lazy): after a new player's first finished game,
  `bootstrap().reminder_prompt` shows "Want a nudge each day?" linking to Settings -> Notifications. Either answer calls
  `dismiss_reminder_prompt()` (players.reminder_prompt_seen, so it follows the player; logged as a `reminder_prompt`
  event). Setting a reminder in Settings hides it too. Players from before it shipped (14+ days old) start with it seen.
- **First-load budget** (tools/check-bundle.mjs, gzip; 2026-10-25: JS ~18.4/20KB, CSS ~8.5/10KB): the entry chunk,
  the `preact` vendor chunk it preloads, and index.css. Keep new code out of it: page-only code belongs in the page's
  chunk, and big optional parts load lazily (`useLazy` in Layout.tsx, `loadWordle` in routes.ts, `auth-api.ts` for
  sign-in calls). Libraries sit in their own chunks (`manualChunks` in vite.config.ts: `preact`, `realtime`) so a
  deploy doesn't make returning players re-download them.
- **Instant pages** (`instant: true` in routes.ts, `src/lib/pagecache.ts`): read-only pages keep their last data in
  localStorage (per league + URL, 30 pages, dropped on sign-out, by `clearPrefetch()` after a game, and on every new
  build). A page seen before renders from it at once and swaps in the fresh RPC result when it lands, in place (same
  component, no remount), so a page that copies `data` into state must not be `instant` (League's form, Messages).
- **Speed numbers**: the router times every page from tap (or document request) to paint (`shown` / `onShown` in
  router.tsx); telemetry sends them as `page_views.load_ms` + `nav` (cold | warm | nav | cache); /admin "Speed"
  (`admin_speed`) shows medians and p90 by kind and page. Check it before and after performance work.
- **Slow SQL**: `pg_stat_statements` on prod (Supabase MCP `execute_sql`, read-only) shows RPC mean times. Watch
  one-row CTEs referenced inside per-row subqueries: the planner may inline them and re-run them per row (fixed in
  player_stats with `as materialized`).
- **Game stylesheet** (`src/components/game.chunk.css`): Game, ErrorBar, PartyChat and Confetti are left out of
  index.css's Tailwind scan (`@source not`) and get their own sheet that loads with the game chunk. The build
  (`chunkCss` in vite.config.ts) drops from it every utility index.css already has, so the two sheets never repeat a
  rule (a repeat loaded later would beat index.css's ordering on other pages), and fails if one of those files is
  imported outside the game. Within a game element, a game-only class always beats a first-load class it conflicts
  with, so don't put two conflicting utilities on one game element and rely on Tailwind's order (e.g.
  `animate-bounce animate-pulse`).

## Known gaps / TODO

- Battles are ported but least tested (E2E coverage pending).
- Giphy API key is hardcoded in `src/components/MessageText.tsx` (inherited).
- Hosting: Cloudflare Workers. `npm run deploy:staging` builds with `.env.staging`, packs `dist/` into one
  Worker module (`tools/build-worker.mjs`: SPA fallback, immutable asset caching) and `wrangler deploy`s it
  -> https://reidle-staging.reidle.workers.dev. Why not wrangler's asset upload / Pages direct upload: in the
  Claude sandbox the API token is injected by a proxy that overwrites every `Authorization` header to
  api.cloudflare.com (use `CLOUDFLARE_API_TOKEN=placeholder CLOUDFLARE_ACCOUNT_ID=<id>`), which breaks the
  short-lived asset-upload JWT. Plain Worker script uploads work. NEVER run `wrangler pages ...` or `wrangler
  deploy` autoconfig in this repo: it rewrites vite.config.ts/package.json (adds @cloudflare/vite-plugin).
  Prod: one click on GitHub (Actions -> Deploy prod -> Run workflow, `.github/workflows/deploy-prod.yml`),
  which tags each successful deploy `prod-YYYY-MM-DD-N` (UTC; `git tag -l 'prod-*'` = release history).
  **That workflow is the only way to release prod**: an agent asked to deploy prod triggers it on `main`
  (GitHub MCP `actions_run_trigger`, workflow `deploy-prod.yml`); never `wrangler deploy` prod by hand, so every
  release is tested, migrated, verified and tagged the same way. Supabase cannot host the SPA.
  Staging site is public with fake data + open name-only signup: put it behind Cloudflare Access before
  loading cloned prod data.
- Staging is live: Supabase project `reidle-staging` (`noxissvouravthzvoapw`) with schema, RPCs and fixture
  data (migrations now via CI, see Data access rules; Confirm email is OFF) + the Worker above. Verified end to end
  with a headless browser. Optional: `STAGING_DB_URL` secret for bulk loads/`db push`.
