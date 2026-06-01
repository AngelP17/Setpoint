#!/usr/bin/env bash
#
# Aggregate every captured artifact into a single machine-readable
# proof.json. Called by flagship-proof.sh after all captures.
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

OUT="$ARTIFACTS_DIR/proof.json"

# Reduce per-register status into aggregate counts
reduce() {
    jq -r '
        {
            drift_events: ([.status.registers[]?.driftEvents // 0] | add // 0),
            corrections:  ([.status.registers[]?.correctionsApplied // 0] | add // 0),
            in_sync:      ([.status.registers[]?.inSync // false] | all),
            registers:    (.status.registers | length)
        }
    ' "$1"
}

BEFORE_AGG=$(reduce "$ARTIFACTS_DIR/drift-before.json")
AFTER_AGG=$(reduce "$ARTIFACTS_DIR/drift-after.json")

# Did the operator actually detect drift on a register?
DETECTED=$(jq '[.status.registers[]? | select(.inSync == false)] | length' "$ARTIFACTS_DIR/drift-after.json")

# Did any register get auto-corrected? (non-zero corrections on an Auto register)
AUTO_CORRECTED=$(jq '[.status.registers[]? | select(.strategy == "Auto" and .correctionsApplied > 0)] | length' "$ARTIFACTS_DIR/drift-after.json")

# Alert-only registers should NOT have corrections applied
ALERT_OVERCORRECTED=$(jq '[.status.registers[]? | select(.strategy == "Alert" and .correctionsApplied > 0)] | length' "$ARTIFACTS_DIR/drift-after.json")

VERDICT="PASS"
REASONS=()
if [[ "$DETECTED" -lt 1 ]]; then
    VERDICT="FAIL"
    REASONS+=("no drift detected after injection")
fi
if [[ "$ALERT_OVERCORRECTED" -gt 0 ]]; then
    VERDICT="FAIL"
    REASONS+=("Alert-policy register was auto-corrected (policy violated)")
fi
if ! [[ "$BEFORE_AGG" =~ "\"in_sync\": true" ]]; then
    VERDICT="FAIL"
    REASONS+=("PLC was not in sync before drift injection")
fi

REASONS_JSON=$(printf '%s\n' "${REASONS[@]:-}" | jq -R . | jq -s 'map(select(. != ""))')

jq -n \
    --arg plc "$PLC_NAME" \
    --arg captured_at "$TIMESTAMP" \
    --argjson before "$BEFORE_AGG" \
    --argjson after "$AFTER_AGG" \
    --argjson detected "$DETECTED" \
    --argjson auto_corrected "$AUTO_CORRECTED" \
    --argjson alert_overcorrected "$ALERT_OVERCORRECTED" \
    --arg verdict "$VERDICT" \
    --argjson reasons "$REASONS_JSON" \
    '{
        schema: "setpoint.io/proof/v1",
        plc: $plc,
        captured_at: $captured_at,
        before: $before,
        after:  $after,
        detection: {
            registers_in_drift: $detected,
            auto_corrected:     $auto_corrected,
            alert_violations:   $alert_overcorrected
        },
        verdict: $verdict,
        verdict_reasons: $reasons
    }' > "$OUT"

echo "Wrote $OUT"
