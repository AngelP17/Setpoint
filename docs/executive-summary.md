# Setpoint — Executive Summary

> **GitOps for the factory floor.**

## The problem

Industrial PLCs sit at the bottom of the automation stack, but the cloud-native
control plane (Kubernetes) sits at the top. When a controller on the plant
floor overwrites a register, there's no record, no alert, and no audit trail
— until something fails hours later and a line engineer has to reconstruct
what happened from a `kubectl describe` of a system that didn't know.

The result: drift is invisible until it's catastrophic, remediation is
ad-hoc, and the gap between "git says X" and "the PLC says Y" is the gap
where scrap gets made.

## What Setpoint is

Setpoint is a Kubernetes operator that reconciles industrial PLCs as
first-class Kubernetes resources. The desired state of every register lives
in a git-tracked `IndustrialPLC` YAML; the operator polls the live device,
detects drift, and applies a per-register remediation policy:

- **Auto** — write the desired value back. For drift you want silently fixed.
- **Alert** — emit a Warning event and bump a metric, but do not write.
  For drift that needs a human at the panel.
- **Halt** — mark the resource `Failed` and stop reconciling. For drift that
  should never be auto-corrected because the cost of being wrong is worse
  than the cost of waiting.

Per-register policies live next to the register they govern, so the
"conveyor belt can self-correct, the print head needs a human" rule is
visible in the YAML that ships it.

## What Setpoint proves

`make flagship-proof` runs a deterministic end-to-end demonstration:

1. Boot the operator, the mock PLC, and the flagship sample.
2. Wait for convergence — every register in sync.
3. Inject deterministic drift on the Alert-policy register.
4. Capture status, events, metrics, and logs.
5. Aggregate into a single `proof.json` with a PASS/FAIL verdict.

The verdict is binary: did the operator detect the drift, and did it
respect the per-register policy? If a future change breaks either
property, the proof fails before the change ships.

## Where Setpoint lives

Setpoint is a single Cargo workspace with five crates:

| Crate              | What it does                                     |
| ------------------ | ------------------------------------------------ |
| `operator`         | The Kubernetes operator. Reconciler + metrics.   |
| `setpointctl`      | CLI. `get-status`, `watch`, `sync --force`.      |
| `mock-plc`         | Modbus TCP server with optional chaos mode.      |
| `drift-simulator`  | Connects to a Modbus device and overwrites a register. |
| `api`              | Axum gateway used by the web console.             |

It ships with a Helm chart, raw `k8s/` manifests, CI workflows, a
Grafana dashboard, a Next.js landing + console, and a sample
`IndustrialPLC` for the flagship proof run.

## What's not here

Setpoint is a reference implementation and a flagship project, not a
vendor product. It is intentionally scoped to Modbus TCP because that
is the protocol a working demonstrator could be written against in a
sitting; production deployments against Siemens S7, EtherNet/IP, or
OPC UA are real engineering projects, not weekend work.
