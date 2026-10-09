#!/usr/bin/env bash
# Exercises tools/legacy/import.sql against synthetic legacy data on the local stack, then
# restores the standard fixture. Requires `supabase start`.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
psql "$DB" -q -v ON_ERROR_STOP=1 -f tools/legacy/schema.sql -f tools/legacy/fixture.sql -f tools/legacy/import.sql
psql "$DB" -At -f tools/legacy/assertions.sql | tail -1
psql "$DB" -q -c "drop schema legacy cascade"
node_modules/.bin/supabase db reset >/dev/null 2>&1  # back to the standard fixture
