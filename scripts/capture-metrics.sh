#!/usr/bin/env bash
#
# Scrape the operator's Prometheus /metrics endpoint and print only the
# setpoint_* metrics + the standard process_*/go_* metrics. Used by the
# flagship proof to record proof artifacts.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORT_FORWARD_PID=""
cleanup() {
    if [[ -n "$PORT_FORWARD_PID" ]] && kill -0 "$PORT_FORWARD_PID" 2>/dev/null; then
        kill "$PORT_FORWARD_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Pick a free local port
LOCAL_PORT="${LOCAL_PORT:-18080}"

kubectl port-forward svc/setpoint-operator-metrics "${LOCAL_PORT}:8080" >/dev/null 2>&1 &
PORT_FORWARD_PID=$!

# Wait for the port forward to come up
for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${LOCAL_PORT}/metrics" >/dev/null 2>&1; then
        break
    fi
    sleep 0.25
done

echo "# Captured at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "# Source: setpoint-operator-metrics:8080/metrics"
echo
curl -fsS "http://127.0.0.1:${LOCAL_PORT}/metrics" \
    | grep -E '^(# HELP |# TYPE |setpoint_)' || true
