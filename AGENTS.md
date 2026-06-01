# AGENTS.md

This repository builds and demos **Setpoint**, a Rust workspace for a Kubernetes operator, supporting CLI/tools, deployment manifests, proof scripts, and a Next.js landing/demo UI. The folder name still contains `fabgitops`, but current product-facing docs and package names use `Setpoint`.

Read this file before planning or editing. It is meant to reduce avoidable stops in future Codex sessions.

## Project Snapshot

- Product name: `Setpoint`
- Repo/workspace root: `/Users/apinzon/Desktop/Projects/fabgitops`
- Main languages: Rust, Bash, YAML, TypeScript
- Main surfaces:
  - `crates/operator`: Kubernetes operator and shared CRD/status logic
  - `crates/setpointctl`: CLI for status/watch/sync flows
  - `crates/mock-plc`: local Modbus TCP mock server
  - `crates/drift-simulator`: deterministic drift injector used by proof/demo flows
  - `crates/api`: Axum API used by the landing console/demo
  - `landing/`: Next.js 15 app with marketing page and `/console`
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

Notes:

- There is no dedicated root JS/TS task runner.
- The landing app uses Next.js 15, React 19, Tailwind v4, and `motion`.

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
