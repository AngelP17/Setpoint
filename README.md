# Setpoint

> **GitOps for the factory floor.**
> A Kubernetes operator that reconciles industrial PLCs as first-class
> resources, with per-register remediation policies and a machine-checkable
> proof of behavior.

[![CI](https://github.com/apinzon/setpoint-operator/actions/workflows/ci.yml/badge.svg)](https://github.com/apinzon/setpoint-operator/actions/workflows/ci.yml)
[![E2E proof](https://github.com/apinzon/setpoint-operator/actions/workflows/e2e-proof.yml/badge.svg)](https://github.com/apinzon/setpoint-operator/actions/workflows/e2e-proof.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Rust](https://img.shields.io/badge/Rust-1.75%2B-orange?logo=rust)
![Kubernetes](https://img.shields.io/badge/Kubernetes-1.28%2B-326CE5?logo=kubernetes)

```yaml
apiVersion: setpoint.io/v1
kind: IndustrialPLC
metadata:
  name: line-1-printer-plc
spec:
  deviceAddress: plc-1.factory.lan
  port: 502
  registers:
    - name: conveyor-speed
      address: 4001
      desiredValue: 2500
      remediation:
        strategy: Auto
        pollIntervalSecs: 5
    - name: print-head-position
      address: 4002
      desiredValue: 1200
      remediation:
        strategy: Alert       # detected, not auto-corrected
        pollIntervalSecs: 5
```

The desired state of every register is git-tracked YAML. The operator
polls the live device, detects drift, and applies the per-register
remediation policy. **Auto** silently writes the desired value back;
**Alert** emits a `Warning DriftDetected` event and bumps a metric
but does not write; **Halt** marks the resource `Failed`.

## Run the flagship proof

The whole project is built around a single CI-checkable claim:

> An operator that auto-corrects an Alert-policy register is broken,
> even if everything else looks fine.

Reproduce it locally:

```sh
make flagship-proof
cat artifacts/latest/proof.json
cat artifacts/latest/report.md
```

This boots a kind cluster, deploys the operator + mock PLC, injects
deterministic drift on the Alert-policy register, and writes a
binary `verdict: PASS | FAIL` plus a human-readable report. The
same flow runs in CI on every PR; see
[`.github/workflows/e2e-proof.yml`](.github/workflows/e2e-proof.yml).
If `kind` is not installed, the proof script gracefully degrades
against the current `kubectl` context.

## What it looks like

<table>
<tr>
<td align="center"><b>Landing page</b></td>
<td align="center"><b>Evidence section</b></td>
</tr>
<tr>
<td><img src="docs/screenshots/landing-home.png" alt="Setpoint landing page hero and platform overview" width="480" /></td>
<td><img src="docs/screenshots/landing-proof.png" alt="Setpoint proof section showing command, telemetry, and verdict" width="480" /></td>
</tr>
<tr>
<td align="center"><b>Control loop</b></td>
<td align="center"><b>YAML builder</b></td>
</tr>
<tr>
<td><img src="docs/screenshots/landing-flow.png" alt="Setpoint 'One control loop. Three ways to react.' section" width="480" /></td>
<td><img src="docs/screenshots/landing-shape.png" alt="Setpoint 'Shape the resource before it hits the cluster.' YAML builder" width="480" /></td>
</tr>
<tr>
<td align="center"><b>Console</b></td>
<td align="center"><b>Flagship proof</b></td>
</tr>
<tr>
<td><img src="docs/screenshots/landing-console.png" alt="Setpoint console showing dashboard and policy simulation" width="480" /></td>
<td><img src="docs/screenshots/05-kubectl-events-drift.png" alt="kubectl events showing DriftDetected warnings" width="480" /></td>
</tr>
</table>

The screenshots above are static captures committed under
`docs/screenshots/`. For a live view, run the local demo
(see [Flagship demo path](#flagship-demo-path) below).

## Install

### Helm

```sh
helm repo add setpoint https://apinzon.github.io/setpoint-operator
helm install setpoint setpoint/setpoint
```

### Raw manifests

```sh
kubectl apply -f k8s/crd.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f config/samples/industrialplc-line1.yaml
```

The sample targets an in-cluster `setpoint-mock-plc` service on
port 5502; deploy `k8s/mock-plc.yaml` first if you don't have real
hardware. Use `k8s/deployment-local.yaml` (imagePullPolicy: Never,
tag `:latest`) for local kind/minikube work.

## Development

### Prerequisites

The repo uses different toolchains depending on which part you are
working on:

- Rust and Cargo for the workspace binaries
- Docker for local images and compose services
- `kubectl` and Helm for cluster packaging and deployment
- `jq` for proof artifact generation
- `kind` for local end-to-end cluster runs (optional; the proof
  script falls back to the current `kubectl` context when `kind` is
  unavailable)
- Node/npm for the `landing/` Next.js app

`ci-local.sh` checks for `cargo`, `docker`, `helm`, and `kubectl`
up front, and skips some optional checks when `trivy` or `kind`
are not installed.

### Flagship demo path

This is the path a reviewer can run end to end. Every command is
discoverable from `Makefile`, `landing/package.json`, or
`scripts/flagship-proof.sh`.

1. Install JS deps and verify the frontend builds and typechecks:
   ```sh
   npm --prefix landing install
   cd landing && npm exec -- tsc --noEmit
   npm --prefix landing run build
   ```
2. Build and test the Rust workspace:
   ```sh
   make fmt
   make lint
   make test
   make build
   ```
3. Lint and render the Helm chart:
   ```sh
   make helm-lint
   make helm-template
   ```
4. Start the local demo (operator + mock PLC + Axum API gateway on
   port 8081 + Next.js dev server on port 3000):
   ```sh
   make demo
   ```
5. Open `http://localhost:3000/` for the marketing page and
   `http://localhost:3000/console` for the live console. The console
   reports whether it is reading the Axum API or the bundled replica.
6. From a second terminal, exercise each per-policy drift injector:
   ```sh
   make demo-drift-conveyor   # Auto strategy: operator silently corrects
   make demo-drift-printhead  # Alert strategy: detected, never written
   make demo-drift-halt       # Halt strategy: IndustrialPLC marked Failed
   ```
7. Tear down: `make demo-cleanup`.
8. Reproduce the CI proof locally: `make flagship-proof`. The verdict
   and artifacts land under `artifacts/latest/`.

### Common commands

From the repo root:

```sh
make build            # cargo build --release --workspace
make build-debug      # cargo build --workspace
make fmt              # cargo fmt --all -- --check
make fmt-fix          # cargo fmt --all
make lint             # cargo clippy --workspace --all-targets -- -D warnings
make test             # cargo test --workspace
make ci-local         # local CI bundle
make helm-lint        # helm lint charts/setpoint
make helm-template    # render chart locally
make k8s-apply        # apply raw manifests for local cluster work
make k8s-delete       # remove raw manifests
make obs-up           # start Prometheus + Grafana
make obs-down         # stop Prometheus + Grafana
make demo             # start local demo environment
make demo-cleanup     # stop demo resources and local processes
make demo-drift-conveyor   # inject drift into the Auto conveyor register
make demo-drift-printhead  # inject drift into the Alert print-head register
make demo-drift-halt       # trigger the Halt safety fault
make flagship-proof   # run the proof end to end
make proof-cleanup    # clean resources created by the proof
make proof-report     # regenerate report from captured artifacts
```

For the landing app:

```sh
npm --prefix landing install
npm --prefix landing run dev
npm --prefix landing run build
npm --prefix landing run start
npm --prefix landing run lint
cd landing && npm exec -- tsc --noEmit
```

For the API gateway (used by the console demo):

```sh
cargo run -p api
curl http://localhost:8081/api/health
```

There is no dedicated root-level JavaScript task runner. The TypeScript
typecheck command above is derived from the checked-in `landing/tsconfig.json`
and local `typescript` dependency.

### Console, mock data, and the API

The `/console` route is a typed Next.js client that talks to the
`crates/api` Axum gateway on `http://localhost:8081`. When the
gateway is offline, the console surfaces a "Demo data fallback"
banner and reads from a typed bundled replica so the layout is
still exercisable. Audit (`/api/audit`) and SSE
(`/api/stream/events`) responses are clearly labeled in the payload
(`isMock: true`, `source: "mock"`) — they are demo data meant to
render the verification surface end to end while the operator
service is not colocated.

## How it works

```
┌──────────┐  watch  ┌─────────────┐  poll  ┌──────────────┐
│  git /   │ ──────▶ │  Setpoint   │ ─────▶ │  Modbus PLC  │
│  kubectl │ ◀────── │  operator   │ ◀───── │  (registers) │
└──────────┘  patch  └─────────────┘  write └──────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │  setpoint_*      │
                     │  Prometheus      │
                     │  metrics         │
                     └──────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  Warning DriftDetected │
                  │  / Normal              │
                  │  DriftCorrected events │
                  └────────────────────────┘
```

The full architecture, including failure modes and reconciliation
loop, lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```
crates/
  operator/         the Kubernetes operator (reconciler + metrics)
  setpointctl/      CLI (get-status, watch, sync)
  mock-plc/         Modbus TCP server with optional chaos mode
  drift-simulator/  overwrites a register on demand for the proof run
  api/              Axum gateway used by the console (typed health, audit, events, simulate-policy)
k8s/                raw manifests (CRD, RBAC, deployment, sample, mock)
charts/setpoint/    Helm chart
config/samples/     reference IndustrialPLC resources
docs/               architecture, ADRs, executive summary, proof
artifacts/          proof run output (templates ship here; real run overwrites)
scripts/            flagship-proof.sh, capture-metrics.sh, generate-report.sh, aggregate-proof.sh
landing/
  app/              marketing page and /console route
  components/       marketing page sections (nav, hero, proof bento, etc.)
```

Generated or local-output directories that agents should usually leave
alone:

- `target/`
- `artifacts/latest/`
- `landing/.next/`
- `landing/node_modules/`

Files with generated or machine-output characteristics that agents
should not edit unless the task requires it:

- `Cargo.lock`
- `landing/package-lock.json`
- `landing/next-env.d.ts`

## Architecture Decision Records

| ADR | Decision |
| --- | -------- |
| [001](docs/adr/001-why-rust-operator.md) | Use Rust + kube-rs for the operator |
| [002](docs/adr/002-modbus-tcp-strategy.md) | Target Modbus TCP first |
| [003](docs/adr/003-rename-to-setpoint.md) | Rename the project from FabGitOps to Setpoint |

## Documentation

- [Executive summary](docs/executive-summary.md) — one-pager, non-technical
- [Proof of concept](docs/proof.md) — technical deep-dive on the proof run
- [Live demo script](docs/demo-script.md) — 5-minute demo walkthrough
- [Architecture](docs/ARCHITECTURE.md) — system design
- [Screenshots capture list](docs/screenshots/README.md) — what to capture, how

## Verification

The current CI contract is defined by:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for `fmt`, `clippy`,
  `cargo test`, release build, and Helm lint/template checks
- [`.github/workflows/e2e-proof.yml`](.github/workflows/e2e-proof.yml) for the
  kind-based flagship proof run

If you are making documentation-only changes, the cheapest meaningful
verification steps are usually:

```sh
make fmt
make lint
make test
make helm-lint
npm --prefix landing run build
cd landing && npm exec -- tsc --noEmit
```

Run `make flagship-proof` when the task affects the proof flow, manifests,
or behavior claims tied to the end-to-end demo.

## Notes And Known Inconsistencies

- The working directory is `fabgitops`, but the current product name and
  docs are `Setpoint`.
- Some historical metadata still references older repo names. For example,
  `crates/api/Cargo.toml` points to
  `https://github.com/AngelP17/fabgitops` while the rest of the workspace
  mostly references `https://github.com/apinzon/setpoint-operator`.
- `landing/.next/` and `landing/node_modules/` are currently present in the
  working tree and should be treated as generated artifacts, not source.
- The console demo depends on the Axum gateway on `localhost:8081`. When
  that gateway is offline, the console falls back to a typed bundled
  replica and labels the data accordingly. The audit ledger and SSE
  stream are bundled mock payloads in either case; the response payload
  includes `isMock: true` and `source: "mock"` so the console can
  honestly tell the difference.
- Drift demo commands (`make demo-drift-conveyor`, `make demo-drift-printhead`,
  `make demo-drift-halt`) only work after `make demo` has port-forwarded the
  in-cluster mock PLC to `127.0.0.1:5502`.

## License

MIT. See [LICENSE](LICENSE).
