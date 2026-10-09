#!/usr/bin/env bash
# Idempotent: bring up Docker + the local Supabase stack in a fresh/restarted agent sandbox.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! docker info >/dev/null 2>&1; then
  (dockerd > /tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
docker info >/dev/null 2>&1 || { echo "docker daemon failed to start (see /tmp/dockerd.log)" >&2; exit 1; }
if ! curl -fsS -o /dev/null -m 3 http://127.0.0.1:54321/auth/v1/health -H "apikey: x" 2>/dev/null && ! curl -s -m 3 -o /dev/null http://127.0.0.1:54321/; then
  npx supabase start >/dev/null
fi
echo "local stack ready: $(npx supabase status -o env 2>/dev/null | grep ^API_URL | cut -d'"' -f2)"
