use prometheus::{CounterVec, GaugeVec, Opts, Registry};

/// Metrics exposed by the operator.
///
/// All counters and gauges are labeled by `plc` (the IndustrialPLC name),
/// `register` (the logical register name), and `strategy` (Auto|Alert|Halt)
/// so dashboards can slice the proof run by line, by register, and by policy.
#[derive(Clone)]
pub struct OperatorMetrics {
    pub registry: Registry,

    /// Total drift events detected, labeled by plc/register/strategy
    pub drift_events_total: CounterVec,

    /// Total corrections applied, labeled by plc/register/strategy
    pub corrections_total: CounterVec,

    /// Number of IndustrialPLC resources being managed
    pub managed_plcs: GaugeVec,

    /// Duration of the last reconciliation loop in seconds, labeled by plc
    pub reconciliation_duration_seconds: GaugeVec,

    /// Connection status of PLC (1 = connected, 0 = disconnected), labeled by plc
    pub plc_connection_status: GaugeVec,

    /// Current register value, labeled by plc/register
    pub register_value: GaugeVec,
}

impl OperatorMetrics {
    pub fn new() -> anyhow::Result<Self> {
        let registry = Registry::new();

        let drift_events_total = CounterVec::new(
            Opts::new(
                "setpoint_drift_events_total",
                "Total number of drift events detected, labeled by plc/register/strategy",
            ),
            &["plc", "register", "strategy"],
        )?;

        let corrections_total = CounterVec::new(
            Opts::new(
                "setpoint_corrections_total",
                "Total number of successful drift corrections, labeled by plc/register/strategy",
            ),
            &["plc", "register", "strategy"],
        )?;

        let managed_plcs = GaugeVec::new(
            Opts::new(
                "setpoint_managed_plcs",
                "Number of IndustrialPLC resources being managed",
            ),
            &[],
        )?;

        let reconciliation_duration_seconds = GaugeVec::new(
            Opts::new(
                "setpoint_reconciliation_duration_seconds",
                "Duration of the last reconciliation loop in seconds, labeled by plc",
            ),
            &["plc"],
        )?;

        let plc_connection_status = GaugeVec::new(
            Opts::new(
                "setpoint_plc_connection_status",
                "Connection status of PLC (1 = connected, 0 = disconnected)",
            ),
            &["plc"],
        )?;

        let register_value = GaugeVec::new(
            Opts::new(
                "setpoint_register_value",
                "Current register value, labeled by plc/register",
            ),
            &["plc", "register"],
        )?;

        registry.register(Box::new(drift_events_total.clone()))?;
        registry.register(Box::new(corrections_total.clone()))?;
        registry.register(Box::new(managed_plcs.clone()))?;
        registry.register(Box::new(reconciliation_duration_seconds.clone()))?;
        registry.register(Box::new(plc_connection_status.clone()))?;
        registry.register(Box::new(register_value.clone()))?;

        Ok(Self {
            registry,
            drift_events_total,
            corrections_total,
            managed_plcs,
            reconciliation_duration_seconds,
            plc_connection_status,
            register_value,
        })
    }

    pub fn record_drift(&self, plc: &str, register: &str, strategy: &str) {
        self.drift_events_total
            .with_label_values(&[plc, register, strategy])
            .inc();
    }

    pub fn record_correction(&self, plc: &str, register: &str, strategy: &str) {
        self.corrections_total
            .with_label_values(&[plc, register, strategy])
            .inc();
    }

    pub fn set_managed_plcs(&self, count: i64) {
        self.managed_plcs.with_label_values(&[]).set(count as f64);
    }

    pub fn set_connection_status(&self, plc: &str, connected: bool) {
        self.plc_connection_status
            .with_label_values(&[plc])
            .set(if connected { 1.0 } else { 0.0 });
    }

    pub fn set_register_value(&self, plc: &str, register: &str, value: u16) {
        self.register_value
            .with_label_values(&[plc, register])
            .set(value as f64);
    }

    pub fn record_reconciliation_duration(&self, plc: &str, seconds: f64) {
        self.reconciliation_duration_seconds
            .with_label_values(&[plc])
            .set(seconds);
    }
}

impl Default for OperatorMetrics {
    fn default() -> Self {
        Self::new().expect("Failed to create metrics")
    }
}
