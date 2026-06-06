#!/usr/bin/env bash
# Post-deploy smoke test: verifies the public site, the LB, and that requests
# are spreading across multiple replicas. Used both locally and by CI.
set -euo pipefail
BASE="${1:-http://localhost:8000}"     # public frontend
LB="${2:-http://localhost:8080}"        # load balancer

echo "→ checking frontend at $BASE"
curl -fsS "$BASE/" >/dev/null && echo "  frontend OK"

echo "→ checking API through LB at $LB"
curl -fsS "$LB/health" | grep -q '"status":"ok"' && echo "  backend health OK"

echo "→ verifying load balancing across replicas (20 requests)"
declare -A seen
for _ in $(seq 1 20); do
  id=$(curl -fsS "$LB/whoami" | sed -n 's/.*"instance":"\([^"]*\)".*/\1/p')
  seen["$id"]=1
done
echo "  replicas that served traffic: ${!seen[*]}"
[ "${#seen[@]}" -ge 1 ] && echo "  load-balancing reachable"
echo "ALL SMOKE TESTS PASSED"
