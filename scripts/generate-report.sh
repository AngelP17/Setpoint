#!/usr/bin/env bash
#
# Generate report.md from the captured artifacts under artifacts/latest/.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$REPO_ROOT/artifacts/latest}"
PLC_NAME="${PLC_NAME:-line-1-printer-plc}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required" >&2
    exit 1
fi

BEFORE="$ARTIFACTS_DIR/drift-before.json"
AFTER="$ARTIFACTS_DIR/drift-after.json"
OUT="$ARTIFACTS_DIR/report.md"

if [[ ! -f "$BEFORE" || ! -f "$AFTER" ]]; then
    echo "Missing $BEFORE or $AFTER; run 'make flagship-proof' first." >&2
    exit 1
fi

# Extract per-register summary
summary() {
    local file="$1"
    local label="$2"
    jq -r --arg label "$label" '
        .status.registers[]? |
        "  " + $label + " | " + .name + " @ " + (.address|tostring) +
        " | desired=" + ((.desiredValue // "n/a")|tostring) +
        " | current=" + ((.currentValue // "n/a")|tostring) +
        " | in_sync=" + (.inSync|tostring) +
        " | drift_events=" + (.driftEvents|tostring) +
        " | corrections=" + (.correctionsApplied|tostring) +
        " | strategy=" + (.strategy // "n/a"|tostring)
    ' "$file"
}

PHASE_BEFORE=$(jq -r '.status.phase // "Unknown"' "$BEFORE")
PHASE_AFTER=$(jq -r '.status.phase // "Unknown"' "$AFTER")
MESSAGE_BEFORE=$(jq -r '.status.message // ""' "$BEFORE")
MESSAGE_AFTER=$(jq -r '.status.message // ""' "$AFTER")

# Aggregate drift/correction totals from the per-register status
DRIFT_BEFORE=$(jq '[.status.registers[]?.driftEvents // 0] | add // 0' "$BEFORE")
DRIFT_AFTER=$(jq '[.status.registers[]?.driftEvents // 0] | add // 0' "$AFTER")
CORR_AFTER=$(jq '[.status.registers[]?.correctionsApplied // 0] | add // 0' "$AFTER")

cat > "$OUT" <<EOF
# Setpoint Flagship Proof Report

- Generated: ${TIMESTAMP}
- PLC: \`${PLC_NAME}\`
- Operator namespace: \`default\`

## Outcome

| Stage        | Phase        | Message |
|--------------|--------------|---------|
| Pre-drift    | ${PHASE_BEFORE} | ${MESSAGE_BEFORE} |
| Post-drift   | ${PHASE_AFTER} | ${MESSAGE_AFTER} |

- Total drift events before injection: **${DRIFT_BEFORE}**
- Total drift events after injection:  **${DRIFT_AFTER}**
- Total corrections applied:           **${CORR_AFTER}**

## Per-register state

### Before drift injection

$(summary "$BEFORE" "BEFORE")

### After drift injection

$(summary "$AFTER" "AFTER")

## Artifacts in this directory

| File | Description |
| ---- | ----------- |
| \`drift-before.json\`        | Status snapshot at convergence (all in sync) |
| \`drift-after.json\`         | Status snapshot at peak drift |
| \`prometheus-metrics.txt\`   | Operator \`/metrics\` scrape, filtered to \`setpoint_*\` |
| \`kubernetes-events.txt\`    | \`kubectl get events\` for the IndustrialPLC object |
| \`operator-logs.txt\`        | Last 200 lines of operator logs |
| \`drift-simulator.log\`      | Drift simulator output |
| \`proof.json\`               | Machine-readable aggregate (see \`scripts/aggregate-proof.sh\`) |
| \`report.md\`                | This file |
EOF

echo "Wrote $OUT"
