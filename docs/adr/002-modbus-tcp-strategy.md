# ADR 002: Modbus TCP Polling Strategy

## Status

**Accepted**

## Context

Setpoint needs to communicate with Industrial PLCs using Modbus TCP protocol. The key decisions are:
1. How to detect drift (polling vs. interrupts)
2. How often to poll
3. How to handle connection failures

Industrial PLCs are typically passive devices that don't push updates - they must be polled.

## Decision

We will implement an **Active Reconciliation Loop with Polling** strategy.

### Key Design Points

1. **Polling-Based Monitoring**: The operator polls PLC registers at configurable intervals (default: 5 seconds)

2. **Circuit Breaker Pattern**: After 3 consecutive failures, the operator backs off with exponential delay (max 60s)

3. **Per-register remediation**: When drift is detected, the operator applies the per-register policy (`Auto`, `Alert`, or `Halt`) rather than a single per-device boolean.

4. **Metrics Export**: Every poll updates Prometheus metrics for observability

## Consequences

### Positive

1. **Simplicity**: Polling is straightforward to implement and debug

2. **Compatibility**: Works with all Modbus TCP devices without special hardware support

3. **Observability**: Regular polling provides continuous health data

4. **Control**: Operator maintains full control over timing and error handling

### Negative

1. **Network Load**: Frequent polling generates network traffic even when no changes occur

2. **Latency**: Drift is only detected at poll intervals, not immediately

3. **Battery/Power**: For battery-powered devices, polling wastes energy

## Alternatives Considered

### Modbus Exception Status / Interrupt-Driven

**Pros:**
- Immediate notification of changes
- Lower network usage

**Cons:**
- Not supported by all PLCs
- More complex implementation
- Requires persistent connections

**Verdict:** Rejected due to limited hardware support.

### WebSocket/Modern Protocol

**Pros:**
- Real-time updates
- Lower latency

**Cons:**
- Legacy PLCs don't support modern protocols
- Would require protocol gateway

**Verdict:** Rejected to maintain compatibility with existing industrial hardware.

## Implementation Details

### Polling Configuration

```yaml
spec:
  registers:
    - name: conveyor-speed
      address: 4001
      desiredValue: 2500
      remediation:
        strategy: Auto
        pollIntervalSecs: 5
        maxCorrectionsPerHour: 60
        cooldownSecs: 5
    - name: print-head-position
      address: 4002
      desiredValue: 1200
      remediation:
        strategy: Alert    # detect, do not write
        pollIntervalSecs: 5
```

### Circuit Breaker Logic

```rust
match plc_client.read_register(register).await {
    Ok(value) => {
        failures = 0;
        // Process value
    }
    Err(e) => {
        failures += 1;
        let backoff = min(2_u64.pow(failures), 60);
        // Requeue with backoff
    }
}
```

### Metrics Exposed

- `setpoint_drift_events_total{plc,register,strategy}`: Counter of drift detections
- `setpoint_corrections_total{plc,register,strategy}`: Counter of successful corrections
- `setpoint_plc_connection_status{plc}`: Gauge (1=connected, 0=disconnected)
- `setpoint_register_value{plc,register}`: Gauge of the last-read value
- `setpoint_reconciliation_duration_seconds{plc}`: Gauge of the last reconcile loop duration
- `setpoint_managed_plcs`: Gauge of the number of IndustrialPLC resources being managed

## References

- [Modbus TCP Specification](https://modbus.org/docs/Modbus_Messaging_Implementation_Guide_V1_0b.pdf)
- [Kubernetes Controller Pattern](https://kubernetes.io/docs/concepts/architecture/controller/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
