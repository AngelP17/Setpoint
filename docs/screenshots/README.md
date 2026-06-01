# Screenshots

This directory holds the captures that go into the README and other
project collateral. Files committed here should be real captures from
the running app or cluster, not mockups.

## README capture list

These are the screenshots currently used in the root README "What it
looks like" section.

| # | File | What to capture | How |
| - | ---- | --------------- | --- |
| 1 | `landing-home.png` | landing page hero (1440x900, dark mode) | Run the local app, force `prefers-color-scheme: dark`, and capture the first viewport of `http://127.0.0.1:3000/`. |
| 2 | `landing-proof.png` | proof and evidence section (1440x900, dark mode) | Capture the `#proof` anchor at `http://127.0.0.1:3000/#proof`. |
| 3 | `landing-console.png` | `/console` page with dashboard surface visible (1440x900, dark mode) | Capture `http://127.0.0.1:3000/console`. The console shows a "Demo data fallback" banner if the Axum API is not running. |
| 4 | `05-kubectl-events-drift.png` | proof-related Kubernetes event evidence | Reuse or refresh from a real drift run. |
| 5 | `landing-flow.png` | "One control loop. Three ways to react." section (full section, ~1440x1650) | Capture the section after scrolling into view so all three steps render. |
| 6 | `landing-shape.png` | "Shape the resource before it hits the cluster." section (full section, ~1440x918) | Capture the section with the form filled in to its defaults. |

## How to capture the README screenshots

The README screenshots are 1440-wide single-viewport captures in dark
mode. The console capture renders the demo fallback state by default;
to capture a live-state console, also run `cargo run -p api` (or
`make demo`) so the gateway on `localhost:8081` responds with real
data.

```sh
# 1. Start the landing app and (optionally) the API gateway
npm --prefix landing run dev
# In a second terminal, only needed for the live console capture:
cargo run -p api

# 2. Capture browser screenshots (npx playwright CLI)
npx playwright screenshot \
  --viewport-size=1440,900 --wait-for-timeout=4000 \
  http://127.0.0.1:3000/ docs/screenshots/landing-home.png

npx playwright screenshot \
  --viewport-size=1440,900 --wait-for-timeout=4000 \
  "http://127.0.0.1:3000/#proof" docs/screenshots/landing-proof.png

npx playwright screenshot \
  --viewport-size=1440,900 --wait-for-timeout=6000 \
  http://127.0.0.1:3000/console docs/screenshots/landing-console.png
```

To capture the section-level screenshots or the full-page screenshot
with `whileInView` content correctly revealed, drive Playwright with
a small script that scrolls the page first and then uses
`elementHandle.screenshot()`. See the commit history of this
directory for the last capture script.

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
