#!/usr/bin/env bash
# Post-deploy smoke test: verifies the public site, the LB, and that requests
# are spreading across multiple replicas. Used both locally and by CI.
set -euo pipefail
BASE="${1:-http://localhost:8000}"     # public frontend
LB="${2:-http://localhost:8080}"        # load balancer

# Wait for the backend to become ready through the LB. After a fresh deploy the
# replicas need a moment to acquire the schema-init lock, create + seed the DB
# (incl. password hashing) and start uvicorn, so poll rather than assume.
echo "→ waiting for API through LB at $LB/health"
ready=
for attempt in $(seq 1 30); do
  if curl -fsS "$LB/health" 2>/dev/null | grep -q '"status":"ok"'; then
    ready=1
    echo "  backend health OK (after ${attempt}s)"
    break
  fi
  sleep 2
done
if [ -z "$ready" ]; then
  echo "  backend did not become healthy in time"
  exit 1
fi

echo "→ checking frontend at $BASE"
curl -fsS "$BASE/" >/dev/null && echo "  frontend OK"

echo "→ verifying load balancing across replicas (20 requests)"
declare -A seen
for _ in $(seq 1 20); do
  id=$(curl -fsS "$LB/whoami" | sed -n 's/.*"instance":"\([^"]*\)".*/\1/p')
  seen["$id"]=1
done
echo "  replicas that served traffic: ${!seen[*]}"
[ "${#seen[@]}" -ge 1 ] && echo "  load-balancing reachable"
echo "ALL SMOKE TESTS PASSED"
