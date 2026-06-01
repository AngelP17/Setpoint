# ADR 003: Rename the project from FabGitOps to Setpoint

## Status

**Accepted**

## Context

The project started as **FabGitOps**: a "Fabrication + GitOps" compound
name. The brand survived the MVP but stopped carrying its weight as
the scope grew. Three problems:

1. **"Fab" reads as fabrication, not as the industrial floor.** Every
   reviewer who saw the name assumed it was about semiconductor
   fabrication or a fab-style software product. It is neither. It is
   about reconciling physical PLCs.
2. **"GitOps" is no longer the differentiator.** GitOps is a given in
   2026. The compound name implies the value is "we do GitOps for
   fabrication," but the value is the per-register remediation model
   and the proof of behavior. The name obscured the actual bet.
3. **The CRD group was `fabgitops.io`.** The group name is the most
   visible artifact of the project (`apiVersion: fabgitops.io/v1`),
   and the name was a liability in any customer conversation. It is
   also a one-way door: changing the CRD group breaks every
   downstream manifest.

A rename was overdue. The question was when and to what.

## Decision

Rename the project to **Setpoint**, with the new CRD group
`setpoint.io` and a tagline of "GitOps for the factory floor."

The rename is **full**, with no backward-compat shim:

- Crate `fabctl` is renamed to `setpointctl`.
- Crate `operator` keeps its name (function-describing) but its
  controller and image are renamed to `setpoint-operator`.
- Crate `mock-plc` keeps its name; image renamed to `setpoint-mock-plc`.
- New crate `drift-simulator` added for the proof run.
- Helm chart moved from `charts/fabgitops/` to `charts/setpoint/`.
- All raw k8s manifests, the Grafana dashboard, the prometheus scrape
  job, and the docker-compose stack renamed.
- New GitHub repo at `apinzon/setpoint-operator`.

## Why "Setpoint"

A **setpoint** in control engineering is the target value a controller
is trying to maintain. A PLC's job is to keep a measured variable at
its setpoint. Drift is the difference between the setpoint and the
measured value. This is the precise vocabulary the operator works in.

The name is also:

- **One word.** Easy to say, easy to type, easy to put in a CLI flag.
- **Industrial, not consumer.** No "Ops" suffix, no "AI", no fluffy
  abstraction. It names a thing a control engineer already knows.
- **Distinct from the brand cosplay that litters the space.** No
  "Opsio", no "Fabrikam", no "ProcessAI".

## Consequences

### Positive

1. The CRD group `setpoint.io` reads as a real product in any
   customer manifest, not a hobby project.
2. The CLI `setpointctl` follows the `kubectl` convention without
   coining a fresh suffix (`-ctl` is a well-understood control-plane
   suffix).
3. The tagline is short and true: "GitOps for the factory floor."
4. The flagship proof run, the per-register remediation model, and
   the binary `verdict` are now the load-bearing artifacts, not the
   name.

### Negative

1. Every external reference to `FabGitOps` is now stale. The repo's
   first commit message, the original GitHub URL, the nested
   `fabgitops/fabgitops/` worktree remnant, and any external blog
   post that links to the old name all need to be redirected or
   updated.
2. The rename breaks every `IndustrialPLC` resource currently
   checked in under the old CRD group. The decision is to make the
   break clean rather than ship a translation shim; no
   `IndustrialPLC` resources exist outside this repo.
3. The README lost the "FabGitOps" name that some readers
   remembered; new readers gain nothing from a name they never saw.

## Alternatives considered

### "Setpointctl" as the project name

The CLI binary is `setpointctl`, the convention after `kubectl`.
Naming the whole project "Setpointctl" would have been coherent but
loses the noun-vs-verb distinction. The project is the thing
(Setpoint); the CLI is the way you talk to it (setpointctl).

### "SetpointIO" / "Setpoint Operator" / "Setpoint Controller"

Compound names add words without adding information. "Setpoint" is
the right level of specificity.

### Keep "FabGitOps" and add a "Setpoint" product line

Two names for one project is worse than one bad name. Picked the
new name and committed.

## Migration

Migration is committed in this single change set:

- Workspace `Cargo.toml` updated.
- `git mv crates/fabctl crates/setpointctl`.
- All Rust source updated.
- All k8s, Helm, Docker, and shell-script references updated.
- New ADR (`docs/adr/003-rename-to-setpoint.md`, this file).
- Architecture doc and prior ADRs updated to use Setpoint vocabulary.

The GitHub repo will be renamed to `apinzon/setpoint-operator`; any
cached `git` remotes pointing at `apinzon/fabgitops` need to be
updated.
