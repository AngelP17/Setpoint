# Screenshots

This directory holds the captures that go into the README, the
landing page, and the executive summary.

## Capture list

The five screenshots the project is expected to ship, in the order
they appear in the README "What it looks like" section.

| # | File | What to capture | How |
| - | ---- | --------------- | --- |
| 1 | `01-setpointctl-get-status.png` | `setpointctl get-status` showing all registers in sync | Run `./target/release/setpointctl get-status` after a clean deploy, screenshot the terminal. |
| 2 | `02-setpointctl-watch-drift.png` | `setpointctl watch` showing one register in red, one in green | Start `setpointctl watch --interval 1`, launch `drift-simulator` against register 4002, wait one poll cycle, screenshot. |
| 3 | `03-operator-logs-reconcile.png` | operator logs showing per-register reconcile lines with strategy labels | `kubectl logs -l app=setpoint-operator --tail=40` after a drift cycle, screenshot. |
| 4 | `04-grafana-dashboard.png` | the Setpoint Grafana dashboard with `setpoint_drift_events_total` ticking and `setpoint_register_value` gauges | Open `http://localhost:3000/d/setpoint-operator`, wait for at least one drift cycle, screenshot. |
| 5 | `05-kubectl-events-drift.png` | `kubectl get events` showing a `Warning DriftDetected` on the PLC | `kubectl get events --field-selector involvedObject.name=line-1-printer-plc` after a drift cycle, screenshot. |

## How to capture

```sh
# Pre-flight: start a clean demo
make obs-up
make k8s-apply
kubectl wait --for=condition=ready pod -l app=setpoint-operator --timeout=120s
kubectl wait --for=condition=ready pod -l app=setpoint-mock-plc   --timeout=120s

# 1. Get status (in sync)
./target/release/setpointctl get-status
# Screenshot.

# 2 + 5. Inject drift, capture watch + events
./target/release/setpointctl watch --interval 1 &
./target/release/drift-simulator \
    --target=setpoint-mock-plc.default.svc.cluster.local:5502 \
    --register=4002 --value=9999 --interval=5 &
sleep 15
# Screenshot watch output. Screenshot `kubectl get events` output.

# 3. Operator logs
kubectl logs -l app=setpoint-operator --tail=40
# Screenshot.

# 4. Grafana dashboard
open http://localhost:3000/d/setpoint-operator
# Screenshot.
```

The files committed to this directory should be **real** captures, not
mockups. Empty directory = no real run yet.
