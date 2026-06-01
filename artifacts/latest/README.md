# Proof artifacts

The committed files in this directory are **templates** with the `template.` filename prefix. A real proof run overwrites them with the same paths, removing the `template.` prefix and writing actual proof data.

Run a real proof with:

```sh
make flagship-proof
```

Inspect:

```sh
cat artifacts/latest/proof.json      # machine-readable verdict
cat artifacts/latest/report.md       # human-readable summary
cat artifacts/latest/prometheus-metrics.txt
cat artifacts/latest/kubernetes-events.txt
cat artifacts/latest/operator-logs.txt
```

Tear it down:

```sh
make proof-cleanup
```
