# artifacts/

This directory holds proof artifacts produced by the flagship proof run.

## Lifecycle

`make flagship-proof` runs `scripts/flagship-proof.sh`, which:

1. Boots the operator, the mock PLC, and the flagship sample IndustrialPLC.
2. Waits for convergence (status.phase = Connected).
3. Captures `drift-before.json` (in-sync snapshot).
4. Launches the drift simulator against the Alert-policy register.
5. Waits for drift to accumulate, then captures `drift-after.json`.
6. Scrapes Prometheus, fetches Kubernetes events, and tails operator logs.
7. Aggregates everything into `proof.json` and `report.md`.

`make proof-cleanup` tears the run down.

## Files

| File | Producer | Format |
| ---- | -------- | ------ |
| `drift-before.json`        | `kubectl get industrialplc ... -o json`     | JSON status snapshot, captured at convergence |
| `drift-after.json`         | `kubectl get industrialplc ... -o json`     | JSON status snapshot, captured at peak drift |
| `prometheus-metrics.txt`   | `scripts/capture-metrics.sh`                | Plaintext `/metrics` scrape, filtered to `setpoint_*` |
| `kubernetes-events.txt`    | `kubectl get events`                        | Plaintext `kubectl` output, sorted by timestamp |
| `operator-logs.txt`        | `kubectl logs ... --tail=200`                | Plaintext last 200 log lines |
| `drift-simulator.log`      | `target/release/drift-simulator`             | Plaintext drift simulator output |
| `proof.json`               | `scripts/aggregate-proof.sh`                | Single JSON object, machine-readable, with `verdict` field |
| `report.md`                | `scripts/generate-report.sh`                 | Human-readable summary |

## Schemas

`proof.json` schema (`setpoint.io/proof/v1`):

```jsonc
{
  "schema": "setpoint.io/proof/v1",
  "plc": "line-1-printer-plc",
  "captured_at": "2026-01-01T00:00:00Z",
  "before": {
    "drift_events": 0,
    "corrections": 0,
    "in_sync": true,
    "registers": 2
  },
  "after": {
    "drift_events": 1,
    "corrections": 0,
    "in_sync": false,
    "registers": 2
  },
  "detection": {
    "registers_in_drift": 1,
    "auto_corrected": 0,
    "alert_violations": 0
  },
  "verdict": "PASS",
  "verdict_reasons": []
}
```

`verdict` is `PASS` if and only if:

- at least one register is in drift after the injection,
- no Alert-policy register was auto-corrected (the operator respected the policy),
- the PLC was in sync before the injection.

## Schemas (template copies in this directory)

The `.template.*` files in this directory are **templates**, not real proof runs. They show the shape of each artifact without claiming proof of anything. A real proof run overwrites them.
