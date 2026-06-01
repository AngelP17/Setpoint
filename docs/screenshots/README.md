# Screenshots

This directory holds the captures that go into the README and other
project collateral.

## README capture list

These are the screenshots currently used in the root README "What it
looks like" section.

| # | File | What to capture | How |
| - | ---- | --------------- | --- |
| 1 | `landing-home.png` | landing page hero and top platform framing | Run the local app and capture `http://127.0.0.1:3000`. |
| 2 | `landing-proof.png` | proof and evidence section | Capture `http://127.0.0.1:3000/#proof`. |
| 3 | `landing-console.png` | `/console` page with dashboard surface visible | Capture `http://127.0.0.1:3000/console`. |
| 4 | `05-kubectl-events-drift.png` | proof-related Kubernetes event evidence | Reuse or refresh from a real drift run. |

## How to capture the README screenshots

```sh
# 1. Start the landing app
npm --prefix landing run dev

# 2. Capture browser screenshots
npx playwright screenshot --device="Desktop Chrome" --full-page \
  http://127.0.0.1:3000 docs/screenshots/landing-home.png
npx playwright screenshot --device="Desktop Chrome" --full-page \
  http://127.0.0.1:3000/#proof docs/screenshots/landing-proof.png
npx playwright screenshot --device="Desktop Chrome" --full-page \
  http://127.0.0.1:3000/console docs/screenshots/landing-console.png
```

## Proof and terminal captures

The older ops screenshots are still valid repo artifacts when you want
to show the raw operator, CLI, and cluster evidence surface.

| File | What to capture |
| ---- | --------------- |
| `01-setpointctl-get-status.png` | `setpointctl get-status` showing all registers in sync |
| `02-setpointctl-watch-drift.png` | `setpointctl watch` during a drift cycle |
| `03-operator-logs-reconcile.png` | operator logs with reconcile decisions |
| `04-grafana-dashboard.png` | Grafana dashboard with Setpoint metrics |
| `05-kubectl-events-drift.png` | `kubectl get events` showing `Warning DriftDetected` |

To refresh those:

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

The files committed to this directory should be real captures, not
mockups.
