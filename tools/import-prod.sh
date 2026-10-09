#!/usr/bin/env bash
# One-shot port of LEGACY production data into a NEW-schema database (staging or fresh prod).
# Read-only against the source. Nothing is ever written to SOURCE_DB_URL.
#
#   SOURCE_DB_URL=<legacy prod, read-only role>  TARGET_DB_URL=<new-schema db>  \
#   [PROD_GUARD=<legacy prod project ref>] [TARGET_SUPABASE_URL=.. TARGET_SERVICE_ROLE_KEY=..] \
#   tools/import-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SOURCE_DB_URL:?set SOURCE_DB_URL (legacy prod, read-only)}"
: "${TARGET_DB_URL:?set TARGET_DB_URL (new-schema database)}"
[ "$SOURCE_DB_URL" != "$TARGET_DB_URL" ] || { echo "refusing: source == target" >&2; exit 1; }
if [ -n "${PROD_GUARD:-}" ] && [[ "$TARGET_DB_URL" == *"$PROD_GUARD"* ]]; then
  echo "refusing: target matches PROD_GUARD ($PROD_GUARD) — that is the legacy production project" >&2; exit 1
fi
SB=node_modules/.bin/supabase
DUMP="$(mktemp)"; trap 'rm -f "$DUMP" "$DUMP.legacy"' EXIT

echo "1/4 migrating target to the new schema"
"$SB" db push --db-url "$TARGET_DB_URL" --include-all >/dev/null
echo "2/4 dumping legacy data (read-only)"
"$SB" db dump --db-url "$SOURCE_DB_URL" --schema public --data-only --use-copy -f "$DUMP" >/dev/null
awk -f tools/retarget-dump.awk "$DUMP" > "$DUMP.legacy"
echo "3/4 importing"
psql "$TARGET_DB_URL" -q -v ON_ERROR_STOP=1 -f tools/legacy/schema.sql -f "$DUMP.legacy" -f tools/legacy/import.sql
echo "3b/4 verifying (legacy vs new)"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f tools/legacy/verify.sql
psql "$TARGET_DB_URL" -q -c "drop schema legacy cascade" 2>/dev/null
if [ -n "${TARGET_SUPABASE_URL:-}" ] && [ -n "${TARGET_SERVICE_ROLE_KEY:-}" ]; then
  echo "4/4 creating auth users for every player"
  SUPABASE_URL="$TARGET_SUPABASE_URL" SERVICE_ROLE_KEY="$TARGET_SERVICE_ROLE_KEY" DB_URL="$TARGET_DB_URL" node tools/sync-auth-users.ts
else
  echo "4/4 skipped auth sync (set TARGET_SUPABASE_URL + TARGET_SERVICE_ROLE_KEY)"
fi
