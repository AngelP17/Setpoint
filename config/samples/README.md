# Reference IndustrialPLC samples

This directory contains reference IndustrialPLC resources for Setpoint.

| File | What it shows |
| ---- | ------------- |
| `industrialplc-line1.yaml` | Flagship multi-register sample: `conveyor-speed` (Auto policy) + `print-head-position` (Alert policy). The flagship proof run targets this resource. |

To apply:

```sh
kubectl apply -f config/samples/industrialplc-line1.yaml
```

To inspect:

```sh
kubectl get industrialplc -A
kubectl describe industrialplc line-1-printer-plc
```
