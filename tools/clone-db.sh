#!/usr/bin/env bash
# Clone one Reidle database's DATA into another (prod -> staging, prod -> local, ...).
# Schema comes from migrations (run first); the auth schema is never copied — players get
# fresh deterministic logins via tools/sync-auth-users.ts, so a clone can't leak sessions.
#
#   SOURCE_DB_URL=<read-only prod url> TARGET_DB_URL=<staging/local url> \
#   [TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=...] tools/clone-db.sh
#
# Guards: refuses to write to the source, or to anything matching PROD_GUARD (substring of the
# production host/project ref, e.g. "abcd1234efgh").
set -euo pipefail
: "${SOURCE_DB_URL:?set SOURCE_DB_URL (read-only)}"
: "${TARGET_DB_URL:?set TARGET_DB_URL}"
[ "$SOURCE_DB_URL" != "$TARGET_DB_URL" ] || { echo "refusing: source == target" >&2; exit 1; }
if [ -n "${PROD_GUARD:-}" ] && [[ "$TARGET_DB_URL" == *"$PROD_GUARD"* ]]; then
  echo "refusing: target looks like production ($PROD_GUARD)" >&2; exit 1
fi
SB="$(dirname "$0")/../node_modules/.bin/supabase"
DUMP="$(mktemp)"; trap 'rm -f "$DUMP"' EXIT

echo "1/4 migrating target schema"
"$SB" db push --db-url "$TARGET_DB_URL" --include-all >/dev/null

echo "2/4 dumping source data (public schema only)"
"$SB" db dump --db-url "$SOURCE_DB_URL" --schema public --data-only --use-copy -f "$DUMP" >/dev/null
# players.user_id points into auth.users, which we don't copy: null it out.
awk 'BEGIN{FS=OFS="\t"} /^COPY public\.players /{inp=1; print; next} inp&&/^\\\.$/{inp=0} inp{$2="\\N"} {print}' "$DUMP" > "$DUMP.tmp" && mv "$DUMP.tmp" "$DUMP"

echo "3/4 restoring into target"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
begin;
truncate players, words, answers, daily_words, challenges, submissions, checkpoints,
         messages, message_reads, winners, battles, week_snapshots restart identity cascade;
\i $DUMP
-- re-link players to auth users that already exist in the target (re-clones)
update players p set user_id = u.id from auth.users u
  where p.user_id is null and u.raw_user_meta_data ->> 'name' = p.name;
commit;
SQL

if [ -n "${TARGET_SUPABASE_URL:-}" ] && [ -n "${TARGET_SERVICE_ROLE_KEY:-}" ]; then
  echo "4/4 syncing auth users"
  SUPABASE_URL="$TARGET_SUPABASE_URL" SERVICE_ROLE_KEY="$TARGET_SERVICE_ROLE_KEY" DB_URL="$TARGET_DB_URL" \
    node "$(dirname "$0")/sync-auth-users.ts"
else
  echo "4/4 skipped auth sync (set TARGET_SUPABASE_URL + TARGET_SERVICE_ROLE_KEY)"
fi
