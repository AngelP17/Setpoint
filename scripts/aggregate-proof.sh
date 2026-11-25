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

# Require the exact register and compare status counters before/after.
ADDR="${DRIFT_REGISTER:-4002}"
POLICY="${PROOF_POLICY:-Alert}"
VALUE="${DRIFT_VALUE:-9999}"
before="$ARTIFACTS_DIR/drift-before.json"
after="$ARTIFACTS_DIR/drift-after.json"
selector='.status.registers[] | select(.address == $addr and .strategy == $policy)'
b=$(jq -cer --argjson addr "$ADDR" --arg policy "$POLICY" "$selector" "$before")
a=$(jq -cer --argjson addr "$ADDR" --arg policy "$POLICY" "$selector" "$after")
DETECTED=$(jq '[.status.registers[]? | select(.inSync == false)] | length' "$after")
AUTO_CORRECTED=$(jq '[.status.registers[]? | select(.strategy == "Auto" and .correctionsApplied > 0)] | length' "$after")
ALERT_OVERCORRECTED=$(jq '[.status.registers[]? | select(.strategy == "Alert" and .correctionsApplied > 0)] | length' "$after")
WRITE_ATTEMPTS=$(grep -Ec "MODBUS_WRITE_ATTEMPT address=$ADDR value=" "$ARTIFACTS_DIR/mock-plc.log" || true)
VERDICT="PASS"
REASONS=()
reject() { VERDICT="FAIL"; REASONS+=("$1"); }
if ! jq -e '.inSync == true and .currentValue != null' <<<"$b" >/dev/null; then reject "Target register not in sync initially"; fi
if ! jq -e --argjson before "$(jq '.driftEvents' <<<"$b")" '.driftEvents > $before' <<<"$a" >/dev/null; then reject "No drift detected on target"; fi
if [[ "$ALERT_OVERCORRECTED" -ne 0 ]]; then reject "Alert policy was auto-corrected"; fi
case "$POLICY" in
    Auto)
        if [[ "$WRITE_ATTEMPTS" != 2 ]] || ! jq -e '.before == .after and (.samples | length > 0)' "$ARTIFACTS_DIR/plc-readback.json" >/dev/null || ! jq -e --argjson before "$(jq '.correctionsApplied' <<<"$b")" '.inSync == true and .correctionsApplied == ($before + 1)' <<<"$a" >/dev/null; then reject "Auto did not independently restore drift with exactly one correction"; fi
        ;;
    Alert|Halt)
        if [[ "$WRITE_ATTEMPTS" != 1 ]] || ! jq -e --argjson value "$VALUE" '(.before != $value) and (.after == $value) and ([.samples[] == $value] | all) and (.samples | length > 0)' "$ARTIFACTS_DIR/plc-readback.json" >/dev/null || ! jq -e --argjson before "$(jq '.correctionsApplied' <<<"$b")" '.inSync == false and .correctionsApplied == $before' <<<"$a" >/dev/null; then reject "$POLICY wrote or failed independent drift readback"; fi
        if [[ "$POLICY" == Halt ]] && ! jq -e '.status.phase == "Failed"' "$after" >/dev/null; then reject "Halt did not mark resource Failed"; fi
        ;;
    *) reject "Unsupported policy $POLICY" ;;
esac

REASONS_JSON=$(printf '%s\n' "${REASONS[@]:-}" | jq -R . | jq -s 'map(select(. != ""))')

jq -n \
    --arg policy "$POLICY" \
    --argjson target "$ADDR" \
    --arg commit "$(git rev-parse HEAD)" \
    --arg plc "$PLC_NAME" \
    --arg captured_at "$TIMESTAMP" \
    --argjson before "$BEFORE_AGG" \
    --argjson after "$AFTER_AGG" \
    --argjson detected "$DETECTED" \
    --argjson auto_corrected "$AUTO_CORRECTED" \
    --argjson alert_overcorrected "$ALERT_OVERCORRECTED" \
    --argjson write_attempts "$WRITE_ATTEMPTS" \
    --arg verdict "$VERDICT" \
    --argjson reasons "$REASONS_JSON" \
    '{
        schema: "setpoint.io/proof/v1",
        plc: $plc,
        policy: $policy,
        target_register: $target,
        commit: $commit,
        captured_at: $captured_at,
        before: $before,
        after:  $after,
        detection: {
            registers_in_drift: $detected,
            auto_corrected:     $auto_corrected,
            alert_violations:   $alert_overcorrected,
            mock_write_attempts: $write_attempts
        },
        verdict: $verdict,
        verdict_reasons: $reasons
    }' > "$OUT"

echo "Wrote $OUT"
