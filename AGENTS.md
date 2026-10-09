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
supabase/migrations/   schema, RPC layer, word lists (generated)   <- source of truth for data logic
supabase/seed.sql      fake-data fixture, relative to today
supabase/tests/        pgTAP tests (npm run test:db)
src/lib/               supabase client, auth, session store, wordle rules, time helpers
src/routes.ts          route table: path -> page chunk + data loader (one RPC each)
src/router.tsx         navigation, prefetch on hover, progress bar
src/pages/             one component per route
src/components/        Game, Battle, tables, charts, layout
src/data/*.csv         word lists (client validation AND generated DB migration)
e2e/                   Playwright specs (+ helpers: sql(), signIn(), typeWord())
tools/                 clone-db.sh, sync-auth-users.ts, gen-words-migration.mjs
```

## Data access rules

- Tables are **closed** (RLS on, no grants) except `battles` (realtime + direct state writes).
  All reads/writes go through `security definer` RPCs in `supabase/migrations/*_rpc.sql`.
- One RPC per page returns ready-to-render `jsonb` → one round trip per page. Add new
  pages the same way: SQL function + entry in `src/routes.ts` + page component.
- Identity: `me()` resolves the player from `auth.uid()`. Auth is **name-only by design**
  (same trust model as the legacy app): `src/lib/credentials.ts` derives a deterministic
  email/password per name; sign-in tries login then signs up; a trigger links `players`.
- Today's pastes/playbacks are hidden server-side until you've played (`daily_page`,
  `get_playback`, `challenge_page`). Keep that invariant (pgTAP covers it).
- Changing schema/functions: add a **new migration** (`supabase migration new x`); don't edit
  applied ones once anything is deployed. (Pre-first-deploy they were edited in place.)
- After editing `src/data/*.csv`: `npm run words` regenerates the word-list migration.

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
npm run test:e2e        # resets DB, starts vite, runs Playwright headless
```
Playwright in the Claude web sandbox: `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.
Docker daemon may need `dockerd &` first in the sandbox.

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

## Known gaps / TODO

- Prod import: legacy tables (`score` col, json playback, alembic) need a one-time mapping to
  this schema (`submissions.score` dropped; `battles.users` jsonb). Not done yet — fixture first.
- Battles are ported but least tested (E2E coverage pending).
- `rankings()` recomputes full history per request; materialise if it gets slow.
- Giphy API key is hardcoded in `src/components/MessageText.tsx` (inherited).
- Hosting target not chosen (any static host + SPA fallback to `/index.html`).
