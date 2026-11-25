# Claim-to-proof matrix

The flagship proof uses a disposable kind cluster and a simulated PLC, not industrial hardware.

| Claim | Implementation | Evidence |
|---|---|---|
| Per-register Auto/Alert/Halt policy | crates/operator/src/policy.rs | Rust unit tests |
| Alert drift detected on the injected register | scripts/aggregate-proof.sh | drift-after.json |
| Alert policy does not write in the tested scenario | scripts/modbus-proof.py; mock PLC write-attempt log | plc-readback.json, mock-plc.log, proof.json |
| Prometheus exposure | crates/operator/src/metrics.rs | prometheus-metrics.txt |

Run `make flagship-proof` against a disposable kind cluster. CI uploads evidence on failure and success. The proposed CI matrix independently exercises all three policies in separate simulated clusters. Auto requires one correction and restoration; Alert/Halt require exactly one write attempt (injection) and persistent drift. Halt also requires Failed status. Halt is an operator state, not a certified physical safety mechanism. Results on this branch are pending CI.
