#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  autoscale.sh — CPU-driven horizontal auto-scaler for the backend tier
#
#  Demonstrates the auto-scaling mechanism required by the brief (Task 1.6):
#  it polls the average CPU of the `backend` replicas via `docker stats` and
#  scales the replica count up/down between MIN and MAX. The Nginx LB picks up
#  new replicas automatically (variable proxy_pass + 5s DNS re-resolution), so
#  the extra capacity starts absorbing load without any manual reload.
#
#  Usage:
#     ./scripts/autoscale.sh
#  In another terminal, generate load:
#     locust -f loadtest/locustfile.py --host http://localhost:8080
# ════════════════════════════════════════════════════════════════
set -euo pipefail

SERVICE="backend"
MIN=2
MAX=6
SCALE_UP_AT=60       # avg CPU % to add a replica
SCALE_DOWN_AT=20     # avg CPU % to remove a replica
INTERVAL=10          # seconds between checks
COMPOSE="docker compose"

current_replicas() {
  $COMPOSE ps --status running "$SERVICE" 2>/dev/null | grep -c "$SERVICE" || echo 0
}

avg_cpu() {
  # IDs of running backend containers
  local ids
  ids=$($COMPOSE ps -q "$SERVICE")
  [ -z "$ids" ] && { echo 0; return; }
  # Average the CPU% column from docker stats (strip the % sign)
  docker stats --no-stream --format '{{.CPUPerc}}' $ids \
    | tr -d '%' \
    | awk '{ sum += $1; n++ } END { if (n>0) printf "%.0f", sum/n; else print 0 }'
}

echo "autoscaler online | min=$MIN max=$MAX up>${SCALE_UP_AT}% down<${SCALE_DOWN_AT}%"
while true; do
  reps=$(current_replicas)
  cpu=$(avg_cpu)
  printf '[%s] replicas=%s avg_cpu=%s%%\n' "$(date +%T)" "$reps" "$cpu"

  if [ "$cpu" -ge "$SCALE_UP_AT" ] && [ "$reps" -lt "$MAX" ]; then
    target=$((reps + 1))
    echo "  ↑ scaling UP to $target"
    $COMPOSE up -d --no-recreate --scale "$SERVICE=$target" "$SERVICE"
  elif [ "$cpu" -le "$SCALE_DOWN_AT" ] && [ "$reps" -gt "$MIN" ]; then
    target=$((reps - 1))
    echo "  ↓ scaling DOWN to $target"
    $COMPOSE up -d --no-recreate --scale "$SERVICE=$target" "$SERVICE"
  fi

  sleep "$INTERVAL"
done
