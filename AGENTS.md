# AGENTS.md

This repository builds and demos **Setpoint**, a Rust workspace for a Kubernetes operator, supporting CLI/tools, deployment manifests, proof scripts, and a Next.js landing/demo UI. The folder name still contains `fabgitops`, but current product-facing docs and package names use `Setpoint`.

Read this file before planning or editing. It is meant to reduce avoidable stops in future Codex sessions.

## Project Snapshot

- Product name: `Setpoint`
- Repo/workspace root: `/Users/apinzon/Desktop/Projects/fabgitops`
- Main languages: Rust, Bash, YAML, TypeScript
- Main surfaces:
  - `crates/operator`: Kubernetes operator and shared CRD/status/policy logic
  - `crates/setpointctl`: CLI for status/watch/sync flows
  - `crates/mock-plc`: local Modbus TCP mock server
  - `crates/drift-simulator`: deterministic drift injector used by proof/demo flows
  - `crates/api`: Axum API used by the landing console/demo. Routes (stable names): `/api/health`, `/api/plcs`, `/api/plcs/:namespace/:name`, `/api/plcs/:namespace/:name/sync`, `/api/events`, `/api/audit`, `/api/simulate-policy`, `/api/stream/events`
  - `landing/`: Next.js 15 app with marketing page and `/console`. Console components live in `landing/app/console/_components/` and shared types/contracts in `landing/app/console/_lib/`
  - `k8s/` and `charts/setpoint/`: raw manifests and Helm chart
  - `scripts/`: flagship proof and artifact generation scripts
  - `docs/`: architecture, proof, ADRs, demo material

## First Pass Checklist

Inspect before editing. Start with these files:

1. `README.md`
2. `Makefile`
3. `.github/workflows/ci.yml`
4. `.github/workflows/e2e-proof.yml`
5. `Cargo.toml`
6. `landing/package.json`
7. Relevant files under `scripts/`, `k8s/`, `charts/setpoint/`, and `docs/`

## Source Of Truth

Use these as the authoritative command and workflow sources:

- Build/test/lint orchestration: `Makefile`
- CI contract: `.github/workflows/ci.yml`
- End-to-end proof contract: `.github/workflows/e2e-proof.yml`
- Workspace membership: `Cargo.toml`
- Landing app commands: `landing/package.json`
- Proof artifact schema/flow: `scripts/flagship-proof.sh`, `scripts/generate-report.sh`, `scripts/aggregate-proof.sh`

If docs disagree with these files, update docs to match the code and scripts. Do not invent alternate workflows.

## Commands

Run from repo root unless noted otherwise.

### Rust workspace

- Build release: `make build`
- Build debug: `make build-debug`
- Format check: `make fmt`
- Apply formatting: `make fmt-fix`
- Clippy: `make lint`
- Unit tests: `make test`
- Local CI bundle: `make ci-local`

### Containers and packaging

- Build published-style images: `make build-images`
- Build local demo images: `make build-images-local`
- Helm lint: `make helm-lint`
- Helm render: `make helm-template`

### Kubernetes and demo flows

- Apply local manifests: `make k8s-apply`
- Delete local manifests: `make k8s-delete`
- Start observability stack: `make obs-up`
- Stop observability stack: `make obs-down`
- Start local demo environment: `make demo`
- Clean up demo environment: `make demo-cleanup`
- Inject drift into the Auto-correct conveyor register: `make demo-drift-conveyor`
- Inject drift into the Alert-only print-head register: `make demo-drift-printhead`
- Trigger the Halt safety fault: `make demo-drift-halt`
- Run flagship proof: `make flagship-proof`
- Proof cleanup only: `make proof-cleanup`
- Regenerate proof report from captured artifacts: `make proof-report`

### Landing app

Run from `landing/` or with `npm --prefix landing ...`.

- Install deps: `npm --prefix landing install`
- Dev server: `npm --prefix landing run dev`
- Production build: `npm --prefix landing run build`
- Start built app: `npm --prefix landing run start`
- Lint: `npm --prefix landing run lint`
- TypeScript check without emitting:
  `cd landing && npm exec -- tsc --noEmit`

### API gateway (demo)

- Run standalone: `cargo run -p api`
- Health: `curl http://localhost:8081/api/health`
- Policy simulation: `curl -X POST http://localhost:8081/api/simulate-policy -H 'Content-Type: application/json' -d '{"strategy":"Auto","desiredValue":100,"currentValue":200,"cooldownSecs":30,"maxCorrectionsPerHour":5,"correctionsLastHour":0}'`

Notes:

- There is no dedicated root JS/TS task runner.
- The landing app uses Next.js 15, React 19, Tailwind v4, and `motion`.
- `make demo` boots the operator, mock PLC, the Axum API on port 8081, and the Next.js dev server on port 3000. The console at `/console` calls the API and falls back to a typed bundled replica when the API is unreachable.
- `/api/audit` and `/api/stream/events` currently serve a clearly labeled mock payload (`isMock: true`, `source: "mock"`) so the console can render the verification surface end-to-end. The audit response includes a `note` field describing the mock contract.

## Flagship Demo Path

This is the path a reviewer can run end-to-end. Each step lists the commands discovered from `Makefile`, `package.json`, and `scripts/`.

1. Install JS deps and verify the frontend typechecks/builds:
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
4. Start the local demo (operator + mock PLC + API gateway + Next.js dev server):
   ```sh
   make demo
   ```
5. Open `http://localhost:3000/` for the marketing page and `http://localhost:3000/console` for the live console. The console will show whether it is reading the Axum API or the bundled replica.
6. From a second terminal, exercise the per-policy drift injectors:
   ```sh
   make demo-drift-conveyor   # Auto strategy: operator silently corrects
   make demo-drift-printhead  # Alert strategy: detected, never written
   make demo-drift-halt       # Halt strategy: IndustrialPLC marked Failed
   ```
7. Tear down: `make demo-cleanup`.
8. Reproduce the CI proof locally: `make flagship-proof`. The verdict and artifacts land under `artifacts/latest/`.

If `kind` is not installed, `make flagship-proof` still runs against the current `kubectl` context (the proof script gracefully degrades when the cluster is not a `kind` cluster).

## Expected Tooling

Some workflows need more than Rust:

- Core Rust work: `cargo`
- Container work: `docker`
- Cluster workflows: `kubectl`, `helm`
- Proof scripts: `jq`
- E2E/local cluster flows: `kind`
- Landing app: `npm`

`ci-local.sh` checks for `cargo`, `docker`, `helm`, and `kubectl`, and conditionally skips `trivy` and `kind` if missing.

## Repository Conventions

- Prefer `Makefile` targets over reconstructing long command sequences by hand.
- Prefer raw manifests under `k8s/` for local cluster work and `charts/setpoint/` for packaged deployment work.
- Treat the flagship proof as a first-class verification path, not just a demo.
- Product naming is intentionally mixed in history:
  - Current product/docs: `Setpoint`
  - Some repository/history references: `fabgitops`
  - Do not bulk-rename unless explicitly asked.

## Files And Directories To Avoid Editing Casually

Generated, runtime, or output-heavy paths:

- `target/`
- `artifacts/latest/`
- `landing/.next/`
- `landing/node_modules/`

Files with generated or machine-output characteristics:

- `Cargo.lock`
- `landing/package-lock.json`
- `landing/next-env.d.ts`

Do not edit these unless the task explicitly requires dependency or generated-output changes.

## High-Risk Areas

- `scripts/flagship-proof.sh`: proof flow contract used by CI
- `.github/workflows/e2e-proof.yml`: CI proof expectations
- `k8s/*.yaml` and `charts/setpoint/*`: deployment behavior
- `crates/operator`: reconciliation logic and policy behavior
- `crates/api`: local demo API expected by `landing/app/console/page.tsx`

If the task is documentation-only, do not change runtime behavior in these areas.

## Known Repo Realities And Unknowns

Document these instead of guessing:

- The repo root directory is `fabgitops`, but the software is branded as `Setpoint`.
- `README.md` says the repo layout includes `scripts/capture-metrics.sh` and `scripts/generate-report.sh`, but `scripts/aggregate-proof.sh` is also part of the proof pipeline and should be considered part of the workflow.
- `crates/api/Cargo.toml` still points `repository` to `https://github.com/AngelP17/fabgitops`, while most other crates point to `https://github.com/apinzon/setpoint-operator`.
- `landing/app/globals.css` imports Google Fonts via `@import`; keep existing behavior unless the task explicitly includes frontend implementation changes.
- `landing/package.json` exposes `lint`, but there is no separate ESLint config file in the repo root. Verify the command before documenting strong guarantees.
- `landing/.next/` and `landing/node_modules/` are present in the working tree. Treat them as generated local artifacts, not source.
- The console at `landing/app/console/page.tsx` calls the Axum API at `http://localhost:8081`. When the API is offline, it falls back to a typed bundled replica and surfaces a "Demo data fallback" banner. Audit and SSE streams are always labeled as mock data in the response payload (`isMock: true`, `source: "mock"`).
- Drift demo commands (`make demo-drift-conveyor`, `make demo-drift-printhead`, `make demo-drift-halt`) target `127.0.0.1:5502`, which only works after `make demo` port-forwards the mock PLC service.

## Verification Guidance

For documentation-only changes, prefer the cheapest meaningful checks first:

1. `make fmt`
2. `make lint`
3. `make test`
4. `make helm-lint`
5. `npm --prefix landing run build`
6. `cd landing && npm exec -- tsc --noEmit`

If cluster or Docker prerequisites are missing, state that explicitly. If you do run heavier checks:

- `make ci-local`
- `make flagship-proof`

## Done When

A documentation or guidance task is done when all of the following are true:

- `AGENTS.md` and relevant docs explain the repo structure quickly and accurately.
- Setup/build/test/lint/format/typecheck commands are documented only when discoverable from the repo.
- Generated paths and risky files are called out explicitly.
- Unknowns, inconsistencies, or prerequisites are listed instead of guessed away.
- Verification run and verification limits are recorded in the final response.
