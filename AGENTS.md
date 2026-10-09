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
tools/                 clone-db.sh, sync-auth-users.ts, gen-words-seed.mjs, check-bundle.mjs
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
- Word tables are DATA, not migrations (prod has its own, UPPERCASE). Local/staging fixture words come from `supabase/seed/words.sql`, generated from `src/data/*.csv` via `npm run words`.

## Scoring (weekly)

`week_scores(date)` in `*_rpc.sql`. Current week = additive points per day by rank among
players who played: 1st 4, 2nd 2, 3rd 1, rank r>=4 `max(0, 1.1-0.1r)`, no-show 0; total = sum,
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

## Known gaps / TODO

- Battles are ported but least tested (E2E coverage pending).
- `rankings()` recomputes full history per request; materialise if it gets slow.
- Giphy API key is hardcoded in `src/components/MessageText.tsx` (inherited).
- Hosting: Cloudflare Workers. `npm run deploy:staging` builds with `.env.staging`, packs `dist/` into one
  Worker module (`tools/build-worker.mjs`: SPA fallback, immutable asset caching) and `wrangler deploy`s it
  -> https://reidle-staging.reidle.workers.dev. Why not wrangler's asset upload / Pages direct upload: in the
  Claude sandbox the API token is injected by a proxy that overwrites every `Authorization` header to
  api.cloudflare.com (use `CLOUDFLARE_API_TOKEN=placeholder CLOUDFLARE_ACCOUNT_ID=<id>`), which breaks the
  short-lived asset-upload JWT. Plain Worker script uploads work. NEVER run `wrangler pages ...` or `wrangler
  deploy` autoconfig in this repo: it rewrites vite.config.ts/package.json (adds @cloudflare/vite-plugin).
  Prod: build with `.env.production`, `wrangler deploy --name reidle`. Supabase cannot host the SPA.
  Staging site is public with fake data + open name-only signup: put it behind Cloudflare Access before
  loading cloned prod data.
- Staging is live: Supabase project `reidle-staging` (`noxissvouravthzvoapw`) with schema, RPCs and fixture
  data (applied via the Supabase MCP connector; Confirm email is OFF) + the Worker above. Verified end to end
  with a headless browser. Optional: `STAGING_DB_URL` secret for bulk loads/`db push`.
