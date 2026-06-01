# Setpoint — Live Demo Script

A 7-minute live demo. The audience is technical (engineers, SREs,
platform teams). The setup is: terminal on the left, browser on the
right.

## Pre-flight (run this once, 5 minutes)

```sh
# 1. Create a kind cluster
kind create cluster --name setpoint --wait 60s

# 2. Verify tools
kind version
kubectl version --client
helm version
docker version
cargo --version
```

## Step 0 — open the right windows

- Terminal 1: `cd ~/…/setpoint` — for the demo.
- Browser tabs: `http://localhost:3000` (Grafana, login admin/setpoint),
  `http://localhost:9090` (Prometheus).
- (Optional) Terminal 2: `kubectl get industrialplc -A -w`.

## Step 1 — show the source (60s)

Open `config/samples/industrialplc-line1.yaml`. Read the spec aloud.

> "This is a single git-tracked YAML. It declares the desired state of
> two Modbus registers on the same physical device. Notice the per-register
> remediation policy: `Auto` for the conveyor belt, `Alert` for the
> print head. The two registers live on the same PLC and the policies
> are per-register, not per-device."

## Step 2 — start observability (10s)

```sh
make obs-up
```

Switch to the browser. Show Grafana at `localhost:3000` — empty
dashboards because no operator is running yet.

## Step 3 — deploy (45s)

```sh
make k8s-apply
```

Show the rollout:

```sh
kubectl get pods -A -w
```

> "Two pods: the operator and the mock PLC. The CRD, RBAC, deployment,
> and sample are all applied in one command."

Wait until both pods are `Running` and the sample IndustrialPLC is
`Connected`:

```sh
kubectl get industrialplc
```

> "Phase `Connected` means every register in the spec is at its
> desired value."

## Step 4 — show it working (60s)

```sh
./target/release/setpointctl get-status
```

> "This is the same status the Kubernetes API returns. No special
> path, no agent on the host — it's the resource status."

```sh
./target/release/setpointctl watch --interval 1
```

Leave it running. Note the per-register state.

Switch to the Grafana dashboard. Show the `setpoint_*` metrics.

## Step 5 — inject drift (30s)

In Terminal 1:

```sh
./target/release/drift-simulator \
    --target=setpoint-mock-plc.default.svc.cluster.local:5502 \
    --register=4002 \
    --value=9999 \
    --interval=5
```

> "This is what an external controller doing the wrong thing looks
> like at the wire. It's writing 9999 to a register that should be
> 1200, every five seconds."

Switch back to `setpointctl watch` (or the Grafana dashboard). Within
one poll interval (~5s):

- The `print-head-position` register's row goes red.
- A `DriftDetected` event appears in `kubectl events`.
- The `setpoint_drift_events_total{strategy="Alert"}` counter ticks up.
- The resource phase flips to `DriftDetected`.

> "Notice: no auto-correction. The operator detected the drift, but
> the Alert policy means the operator refuses to write. The line
> engineer gets a Warning event, the dashboard shows the alert, and
> the system stays in the safe state for the human to look at."

## Step 6 — show the proof (60s)

Stop the drift simulator (Ctrl-C). Run the proof:

```sh
make flagship-proof
```

> "The proof is a deterministic, recorded end-to-end run. It boots
> the system, waits for convergence, injects the same drift, and
> writes a verdict."

Show the verdict:

```sh
cat artifacts/latest/proof.json
cat artifacts/latest/report.md
```

> "This is a CI-checkable property of the system. If a future change
> makes the operator auto-correct an Alert-policy register, this
> proof fails."

## Step 7 — the ask (30s)

> "Three things I'm looking for feedback on:
>
> 1. The per-register remediation model — does it match how you think
>    about drift in your own plant?
> 2. The drift proof — is `proof.json` with a binary verdict the right
>    shape for the operational gate?
> 3. Multi-protocol support — what's the second protocol I should add
>    after Modbus TCP? EtherNet/IP, S7, OPC UA?"

## Recovery

```sh
make k8s-delete
make obs-down
```

## Timing budget

| Step | Section             | Time |
| ---- | ------------------- | ---- |
| 0    | Pre-flight          | done |
| 1    | Show the source     | 60s  |
| 2    | Start observability | 10s  |
| 3    | Deploy              | 45s  |
| 4    | Show it working     | 60s  |
| 5    | Inject drift        | 30s  |
| 6    | Show the proof      | 60s  |
| 7    | The ask             | 30s  |
|      | **Total**           | **5m 5s** |
