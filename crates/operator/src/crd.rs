use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// IndustrialPLC is the Custom Resource Definition for managing
/// industrial PLCs via GitOps principles.
///
/// Each IndustrialPLC targets a single Modbus TCP device and monitors
/// one or more registers, each with its own remediation policy.
#[derive(CustomResource, Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[kube(
    group = "setpoint.io",
    version = "v1",
    kind = "IndustrialPLC",
    plural = "industrialplcs",
    shortname = "plc",
    namespaced,
    status = "IndustrialPLCStatus"
)]
#[serde(rename_all = "camelCase")]
pub struct IndustrialPLCSpec {
    /// IP address or hostname of the PLC device
    pub device_address: String,

    /// Port for Modbus TCP communication (default: 502)
    #[serde(default = "default_port")]
    pub port: u16,

    /// The set of registers to monitor and reconcile on this PLC.
    /// Each register has its own address, desired value, and remediation policy.
    pub registers: Vec<RegisterSpec>,

    /// Tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_port() -> u16 {
    502
}

fn default_in_sync() -> bool {
    true
}

/// A single Modbus holding register monitored by the operator.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterSpec {
    /// Logical name of the register (e.g. "conveyor-speed", "print-head-position")
    pub name: String,

    /// Modbus register address
    pub address: u16,

    /// Desired value for this register
    pub desired_value: u16,

    /// Remediation policy for drift on this register
    #[serde(default)]
    pub remediation: RemediationPolicy,
}

/// How the operator should respond to drift on a register.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemediationPolicy {
    /// Strategy: Auto (correct), Alert (detect only), or Halt (mark PLC Failed)
    #[serde(default = "default_strategy")]
    pub strategy: RemediationStrategy,

    /// Polling interval in seconds for this register (default: 5)
    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u64,

    /// Maximum automatic corrections per hour (0 = unlimited, default: 10)
    #[serde(default = "default_max_corrections")]
    pub max_corrections_per_hour: u32,

    /// Cooldown between corrections in seconds (default: 30)
    #[serde(default = "default_cooldown")]
    pub cooldown_secs: u64,
}

impl Default for RemediationPolicy {
    fn default() -> Self {
        Self {
            strategy: default_strategy(),
            poll_interval_secs: default_poll_interval(),
            max_corrections_per_hour: default_max_corrections(),
            cooldown_secs: default_cooldown(),
        }
    }
}

fn default_strategy() -> RemediationStrategy {
    RemediationStrategy::Auto
}
fn default_poll_interval() -> u64 {
    5
}
fn default_max_corrections() -> u32 {
    10
}
fn default_cooldown() -> u64 {
    30
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema, PartialEq, Eq)]
pub enum RemediationStrategy {
    #[default]
    Auto,
    Alert,
    Halt,
}

/// Status subresource for IndustrialPLC
#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct IndustrialPLCStatus {
    /// Aggregate phase across all registers
    pub phase: PLCPhase,

    /// Last time the status was updated
    pub last_update: Option<String>,

    /// Per-register status entries
    pub registers: Vec<RegisterStatus>,

    /// Last error message (if any)
    pub last_error: Option<String>,

    /// Human-readable message
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegisterStatus {
    /// Logical register name
    pub name: String,

    /// Modbus register address
    pub address: u16,

    /// Most recently read value
    pub current_value: Option<u16>,

    /// Whether the register matches desired state. Defaults to true
    /// (we trust the spec until drift is observed).
    #[serde(default = "default_in_sync")]
    pub in_sync: bool,

    /// Number of drift events detected on this register
    pub drift_events: u32,

    /// Number of successful corrections on this register
    pub corrections_applied: u32,

    /// RFC3339 timestamp of the last drift event
    pub last_drift_at: Option<String>,

    /// RFC3339 timestamp of the last successful correction
    pub last_correction_at: Option<String>,

    /// Remediation strategy in effect
    pub strategy: RemediationStrategy,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, JsonSchema, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum PLCPhase {
    #[default]
    Pending,
    Connecting,
    Connected,
    DriftDetected,
    Correcting,
    Failed,
}

impl IndustrialPLCStatus {
    /// Build a fresh status from the spec. One RegisterStatus per spec.register.
    pub fn new(spec: &IndustrialPLCSpec) -> Self {
        Self {
            phase: PLCPhase::Pending,
            last_update: Some(chrono::Utc::now().to_rfc3339()),
            registers: spec
                .registers
                .iter()
                .map(|r| RegisterStatus {
                    name: r.name.clone(),
                    address: r.address,
                    strategy: r.remediation.strategy.clone(),
                    ..Default::default()
                })
                .collect(),
            last_error: None,
            message: "Initializing...".to_string(),
        }
    }

    pub fn register_mut(&mut self, name: &str) -> Option<&mut RegisterStatus> {
        self.registers.iter_mut().find(|r| r.name == name)
    }

    pub fn register(&self, name: &str) -> Option<&RegisterStatus> {
        self.registers.iter().find(|r| r.name == name)
    }

    /// Recompute the aggregate phase + message from current per-register status.
    pub fn aggregate(&mut self) {
        let any_drift = self.registers.iter().any(|r| !r.in_sync);
        let all_known = self.registers.iter().all(|r| r.current_value.is_some());

        self.phase = if any_drift {
            PLCPhase::DriftDetected
        } else if all_known && !self.registers.is_empty() {
            PLCPhase::Connected
        } else {
            PLCPhase::Connecting
        };

        self.message = if any_drift {
            let drifted: Vec<&str> = self
                .registers
                .iter()
                .filter(|r| !r.in_sync)
                .map(|r| r.name.as_str())
                .collect();
            format!("Drift detected on register(s): {}", drifted.join(", "))
        } else if all_known {
            "All registers in sync".to_string()
        } else {
            "Connecting to PLC...".to_string()
        };

        self.last_update = Some(chrono::Utc::now().to_rfc3339());
    }

    pub fn mark_synced(&mut self, name: &str, value: u16) {
        if let Some(r) = self.register_mut(name) {
            r.current_value = Some(value);
            r.in_sync = true;
        }
        self.aggregate();
    }

    pub fn mark_drift(&mut self, name: &str, _desired: u16, actual: u16) {
        if let Some(r) = self.register_mut(name) {
            r.current_value = Some(actual);
            r.in_sync = false;
            r.drift_events += 1;
            r.last_drift_at = Some(chrono::Utc::now().to_rfc3339());
        }
        self.aggregate();
    }

    pub fn mark_correcting(&mut self, name: &str) {
        self.phase = PLCPhase::Correcting;
        self.message = format!("Applying correction to register '{}'", name);
        self.last_update = Some(chrono::Utc::now().to_rfc3339());
    }

    pub fn mark_corrected(&mut self, name: &str, value: u16) {
        if let Some(r) = self.register_mut(name) {
            r.corrections_applied += 1;
            r.last_correction_at = Some(chrono::Utc::now().to_rfc3339());
        }
        self.mark_synced(name, value);
    }

    pub fn set_error(&mut self, error: String) {
        self.phase = PLCPhase::Failed;
        self.last_error = Some(error.clone());
        self.message = error;
        self.last_update = Some(chrono::Utc::now().to_rfc3339());
    }
}

impl Default for RegisterStatus {
    fn default() -> Self {
        Self {
            name: String::new(),
            address: 0,
            current_value: None,
            // Default to true: we trust the spec until drift is observed.
            in_sync: true,
            drift_events: 0,
            corrections_applied: 0,
            last_drift_at: None,
            last_correction_at: None,
            strategy: RemediationStrategy::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec_two_registers() -> IndustrialPLCSpec {
        IndustrialPLCSpec {
            device_address: "10.0.0.5".into(),
            port: 502,
            registers: vec![
                RegisterSpec {
                    name: "conveyor-speed".into(),
                    address: 4001,
                    desired_value: 2500,
                    remediation: RemediationPolicy {
                        strategy: RemediationStrategy::Auto,
                        poll_interval_secs: 5,
                        max_corrections_per_hour: 60,
                        cooldown_secs: 0,
                    },
                },
                RegisterSpec {
                    name: "print-head-position".into(),
                    address: 4002,
                    desired_value: 1200,
                    remediation: RemediationPolicy {
                        strategy: RemediationStrategy::Alert,
                        poll_interval_secs: 5,
                        max_corrections_per_hour: 0,
                        cooldown_secs: 0,
                    },
                },
            ],
            tags: vec![],
        }
    }

    #[test]
    fn new_status_seeds_one_register_status_per_spec() {
        let spec = spec_two_registers();
        let status = IndustrialPLCStatus::new(&spec);
        assert_eq!(status.registers.len(), 2);
        assert!(status.register("conveyor-speed").is_some());
        assert!(status.register("print-head-position").is_some());
        assert!(status.register("nope").is_none());
        assert_eq!(status.registers[0].address, 4001);
        assert_eq!(status.registers[1].address, 4002);
        assert_eq!(status.registers[0].strategy, RemediationStrategy::Auto);
        assert_eq!(status.registers[1].strategy, RemediationStrategy::Alert);
    }

    #[test]
    fn mark_synced_then_aggregate_marks_connected() {
        let spec = spec_two_registers();
        let mut status = IndustrialPLCStatus::new(&spec);
        status.mark_synced("conveyor-speed", 2500);
        assert!(matches!(status.phase, PLCPhase::Connecting)); // second register still unknown
        status.mark_synced("print-head-position", 1200);
        assert!(matches!(status.phase, PLCPhase::Connected));
        assert_eq!(status.message, "All registers in sync");
    }

    #[test]
    fn mark_drift_on_one_register_does_not_affect_other() {
        let spec = spec_two_registers();
        let mut status = IndustrialPLCStatus::new(&spec);
        status.mark_synced("conveyor-speed", 2500);
        status.mark_synced("print-head-position", 1200);
        // Corrupt the alert register
        status.mark_drift("print-head-position", 1200, 9999);
        assert!(matches!(status.phase, PLCPhase::DriftDetected));
        assert!(status.message.contains("print-head-position"));
        assert!(!status.message.contains("conveyor-speed"));
        // Per-register state
        assert!(status.register("conveyor-speed").unwrap().in_sync);
        assert!(!status.register("print-head-position").unwrap().in_sync);
        assert_eq!(status.register("print-head-position").unwrap().drift_events, 1);
        assert_eq!(status.register("print-head-position").unwrap().current_value, Some(9999));
    }

    #[test]
    fn mark_corrected_increments_corrections_and_resyncs() {
        let spec = spec_two_registers();
        let mut status = IndustrialPLCStatus::new(&spec);
        status.mark_synced("conveyor-speed", 2500);
        status.mark_drift("conveyor-speed", 2500, 999);
        let rs = status.register("conveyor-speed").unwrap();
        assert_eq!(rs.drift_events, 1);
        assert_eq!(rs.corrections_applied, 0);
        status.mark_corrected("conveyor-speed", 2500);
        let rs = status.register("conveyor-speed").unwrap();
        assert!(rs.in_sync);
        assert_eq!(rs.corrections_applied, 1);
        assert!(rs.last_correction_at.is_some());
    }

    #[test]
    fn set_error_flips_phase_to_failed() {
        let spec = spec_two_registers();
        let mut status = IndustrialPLCStatus::new(&spec);
        status.set_error("modbus timeout".into());
        assert!(matches!(status.phase, PLCPhase::Failed));
        assert_eq!(status.last_error.as_deref(), Some("modbus timeout"));
    }
}

