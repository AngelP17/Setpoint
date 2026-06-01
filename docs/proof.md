# Setpoint — Proof of Concept

This document is the technical deep-dive on the proof run. For a
non-technical overview, see [`docs/executive-summary.md`](executive-summary.md).

## The scenario

A production line has a Modbus TCP device (the `line-1-printer-plc`)
exposing two registers:

| Register             | Address | Desired | Policy | Why |
| -------------------- | ------- | ------- | ------ | --- |
| `conveyor-speed`     | 4001    | 2500    | Auto   | Production-critical; safe to self-correct |
| `print-head-position`| 4002    | 1200    | Alert  | Mid-print auto-correction would scrap the run |

A drift source (in production, a panel-mounted HMI; in the proof, the
`drift-simulator` binary) periodically overwrites register 4002 with
`9999`.

## What the operator must do

1. **Detect** the drift on `print-head-position` within one poll interval
   of the write landing.
2. **Respect** the per-register remediation policy: emit a Warning
   event and bump the `setpoint_drift_events_total{strategy="Alert"}`
   counter, but **do not write**.
3. **Not react** to drift on registers that did not drift
   (`conveyor-speed` stays in sync).
4. **Aggregate** the per-register state into a single resource phase
   (`DriftDetected` if any register is out of sync; `Connected`
   otherwise).

## What the proof run captures

After a real `make flagship-proof` run, `artifacts/latest/` contains:

| File | What it shows |
| ---- | ------------- |
| `drift-before.json`     | All registers `inSync=true`, phase `Connected` |
| `drift-after.json`      | `print-head-position.inSync=false`, `driftEvents=1`, `correctionsApplied=0` |
| `prometheus-metrics.txt`| `setpoint_drift_events_total{register="print-head-position",strategy="Alert"} > 0` |
| `kubernetes-events.txt` | `Warning DriftDetected` event on the IndustrialPLC |
| `operator-logs.txt`     | The per-register reconcile lines showing the decision |
| `drift-simulator.log`   | The write events that injected drift |
| `proof.json`            | `{ "verdict": "PASS", ... }` |
| `report.md`             | Human-readable summary |

## How the verdict is computed

`scripts/aggregate-proof.sh` reduces the per-register status into:

```jsonc
{
  "before":            { "drift_events": 0, "corrections": 0, "in_sync": true,  "registers": 2 },
  "after":             { "drift_events": 1, "corrections": 0, "in_sync": false, "registers": 2 },
  "detection": {
    "registers_in_drift":   1,    // at least one drift was detected
    "auto_corrected":       0,    // no Auto register needed correction this run
    "alert_violations":     0     // CRITICAL: no Alert register was auto-corrected
  },
  "verdict":            "PASS",
  "verdict_reasons":    []
}
```

`verdict` is `PASS` if and only if:

- `detection.registers_in_drift >= 1` (the operator saw the drift),
- `detection.alert_violations == 0` (the operator respected the Alert policy),
- `before.in_sync == true` (the operator was in steady state at the start).

Any other shape yields `FAIL` with a populated `verdict_reasons[]`.

## Why this matters

The proof is not "look, the operator does something." It is a
machine-checkable property of the system:

> **An operator that auto-corrects an Alert-policy register is broken,
> even if everything else looks fine.**

That property is asserted in CI via `.github/workflows/e2e-proof.yml`,
which boots a kind cluster, runs the proof, and uploads
`artifacts/latest/` as a build artifact on every PR.

## How to extend

To add a new register or a new policy, edit
`config/samples/industrialplc-line1.yaml`, re-run `make flagship-proof`,
and inspect the new `drift-after.json`. The verdict is the test.

To add a new Modbus device class, edit `crates/operator/src/plc_client.rs`.
The current implementation is single-protocol (Modbus TCP); a multi-protocol
trait abstraction is a natural next step but is out of scope for the
flagship demonstrator.
