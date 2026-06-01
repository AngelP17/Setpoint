use crate::crd::{IndustrialPLC, IndustrialPLCStatus, RemediationStrategy};
use crate::metrics::OperatorMetrics;
use crate::plc_client::{build_adapter, PLCAdapter};
use chrono::{DateTime, Utc};
use kube::api::{Api, Patch, PatchParams};
use kube::runtime::controller::Action;
use kube::runtime::events::{Event, EventType, Recorder, Reporter};
use kube::{Client, Resource, ResourceExt};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::Instant;
use tracing::{error, info, warn};

/// Context passed to reconciliation
#[derive(Clone)]
pub struct Context {
    pub client: Client,
    pub metrics: Arc<OperatorMetrics>,
    pub reporter: Reporter,
}

/// Main reconciliation function.
///
/// Loops over each register in the spec, reads its current value, compares
/// to the desired value, and applies the per-register remediation policy.
pub async fn reconcile(plc: Arc<IndustrialPLC>, ctx: Arc<Context>) -> Result<Action, Error> {
    let name = plc.name_any();
    let namespace = plc.namespace().unwrap_or_default();

    // Check if we are the leader
    if !crate::leader::is_leader() {
        info!(
            "Not the lease leader, skipping reconciliation for PLC: {}/{}",
            namespace, name
        );
        return Ok(Action::requeue(Duration::from_secs(10)));
    }

    let start = Instant::now();

    info!(
        "Reconciling PLC: {}/{} ({} register(s))",
        namespace,
        name,
        plc.spec.registers.len()
    );

    let api: Api<IndustrialPLC> = Api::namespaced(ctx.client.clone(), &namespace);
    let finalizer_name = "setpoint.io/finalizer";

    // 1. Check if the object is being deleted
    if let Some(_deletion_timestamp) = &plc.metadata.deletion_timestamp {
        info!("Deleting PLC resource: {}/{}", namespace, name);

        // Log a final zero-trust audit block documenting deletion
        let audit_block =
            crate::crypto::generate_audit_block(name.clone(), Vec::new(), "Deleted".to_string());
        info!(
            "Zero-Trust deletion audit block generated: hash={}",
            audit_block.hash
        );

        // Remove the finalizer
        let mut finalizers = plc.metadata.finalizers.clone().unwrap_or_default();
        if let Some(pos) = finalizers.iter().position(|f| f == finalizer_name) {
            finalizers.remove(pos);
            let patch = serde_json::json!({
                "metadata": {
                    "finalizers": finalizers
                }
            });
            api.patch(&name, &PatchParams::default(), &Patch::Merge(patch))
                .await
                .map_err(Error::Kube)?;
        }
        return Ok(Action::await_change());
    }

    // 2. Ensure our finalizer is registered if not being deleted
    let mut finalizers = plc.metadata.finalizers.clone().unwrap_or_default();
    if !finalizers.iter().any(|f| f == finalizer_name) {
        finalizers.push(finalizer_name.to_string());
        let patch = serde_json::json!({
            "metadata": {
                "finalizers": finalizers
            }
        });
        api.patch(&name, &PatchParams::default(), &Patch::Merge(patch))
            .await
            .map_err(Error::Kube)?;
    }

    let mut status = plc
        .status
        .clone()
        .unwrap_or_else(|| IndustrialPLCStatus::new(&plc.spec));

    // If the spec has registers that aren't in the status yet, add them.
    // (Handles a status that was carried over from an older single-register schema.)
    for r in &plc.spec.registers {
        if !status.registers.iter().any(|s| s.name == r.name) {
            status.registers.push(crate::crd::RegisterStatus {
                name: r.name.clone(),
                address: r.address,
                strategy: r.remediation.strategy.clone(),
                ..Default::default()
            });
        }
    }

    // Update managed PLCs count
    let all_plcs = Api::<IndustrialPLC>::all(ctx.client.clone());
    if let Ok(plc_list) = all_plcs.list(&Default::default()).await {
        ctx.metrics.set_managed_plcs(plc_list.items.len() as i64);
    }

    // Create PLC client
    let plc_client = build_adapter(
        &plc.spec.protocol,
        plc.spec.device_address.clone(),
        plc.spec.port,
    );
    let recorder = Recorder::new(
        ctx.client.clone(),
        ctx.reporter.clone(),
        plc.object_ref(&()),
    );

    // Health check
    match plc_client.health_check().await {
        Ok(true) => {
            ctx.metrics.set_connection_status(&name, true);
            info!("PLC {}/{} is reachable", namespace, name);
        }
        Ok(false) | Err(_) => {
            ctx.metrics.set_connection_status(&name, false);
            status.set_error("PLC unreachable".to_string());
            update_status(&api, &name, status).await?;
            return Ok(Action::requeue(Duration::from_secs(10)));
        }
    }

    // Reconcile each register
    for register_spec in &plc.spec.registers {
        if let Err(e) = reconcile_register(
            &name,
            register_spec,
            plc_client.as_ref(),
            &mut status,
            &recorder,
            &ctx.metrics,
        )
        .await
        {
            warn!(
                "Register '{}' reconcile error on PLC {}/{}: {}",
                register_spec.name, namespace, name, e
            );
        }
    }

    // Create cryptographic audit block
    let mut audit_registers = Vec::new();
    for r_spec in &plc.spec.registers {
        let current_val = status.register(&r_spec.name).and_then(|r| r.current_value);
        let strategy_str = match r_spec.remediation.strategy {
            RemediationStrategy::Auto => "Auto",
            RemediationStrategy::Alert => "Alert",
            RemediationStrategy::Halt => "Halt",
        }
        .to_string();

        audit_registers.push(crate::crypto::RegisterAuditState {
            name: r_spec.name.clone(),
            address: r_spec.address,
            desired_value: r_spec.desired_value,
            current_value: current_val,
            strategy: strategy_str,
        });
    }

    let action_taken = if status.registers.iter().any(|r| !r.in_sync) {
        "DriftDetected".to_string()
    } else {
        "Reconciled".to_string()
    };

    let audit_block =
        crate::crypto::generate_audit_block(name.clone(), audit_registers, action_taken);

    info!(
        "Cryptographic Audit Block generated: hash={}, prev_hash={}, signature={}",
        audit_block.hash, audit_block.prev_hash, audit_block.signature
    );

    // Persist status
    update_status(&api, &name, status).await?;

    // Record metrics
    let duration = start.elapsed().as_secs_f64();
    ctx.metrics.record_reconciliation_duration(&name, duration);

    // Requeue at the minimum poll interval across all registers
    let min_poll = plc
        .spec
        .registers
        .iter()
        .map(|r| r.remediation.poll_interval_secs)
        .min()
        .unwrap_or(5);

    Ok(Action::requeue(Duration::from_secs(min_poll)))
}

/// Reconcile a single register against the PLC.
async fn reconcile_register(
    plc_name: &str,
    register_spec: &crate::crd::RegisterSpec,
    plc_client: &dyn PLCAdapter,
    status: &mut IndustrialPLCStatus,
    recorder: &Recorder,
    metrics: &OperatorMetrics,
) -> Result<(), Error> {
    let reg_name = &register_spec.name;
    let strategy = &register_spec.remediation.strategy;
    let strategy_label = strategy_label(strategy);

    let current = plc_client.read_register(register_spec.address).await?;
    metrics.set_register_value(plc_name, reg_name, current);

    // 1. Gather all historical/rolling values for context
    let mut last_correction_at = None;
    let mut corrections_last_hour = 0;

    if let Some(rs) = status.register(reg_name) {
        if let Some(last_ts) = &rs.last_correction_at {
            if let Ok(last) = DateTime::parse_from_rfc3339(last_ts) {
                last_correction_at = Some(last.with_timezone(&Utc));
            }
        }

        // Count rolling corrections in the last hour
        let cutoff = Utc::now() - chrono::Duration::hours(1);
        corrections_last_hour = rs
            .recent_corrections
            .iter()
            .filter(|c| {
                if let Ok(dt) = DateTime::parse_from_rfc3339(&c.timestamp) {
                    dt.with_timezone(&Utc) > cutoff
                } else {
                    false
                }
            })
            .count() as u32;
    }

    let ctx = crate::policy::PolicyContext {
        plc_name: plc_name.to_string(),
        register_name: reg_name.clone(),
        desired_value: register_spec.desired_value,
        current_value: current,
        strategy: strategy.clone(),
        last_correction_at,
        corrections_last_hour,
        max_corrections_per_hour: register_spec.remediation.max_corrections_per_hour,
        cooldown_secs: register_spec.remediation.cooldown_secs,
    };

    // 2. Evaluate decision using PolicyEngine
    let decision = crate::policy::PolicyEngine::evaluate(&ctx);

    info!(
        "PLC '{}' register '{}' @{}: current={}, desired={}, strategy={}. Decision = {:?}",
        plc_name,
        reg_name,
        register_spec.address,
        current,
        register_spec.desired_value,
        strategy_label,
        decision
    );

    // 3. Act on Decision
    match decision {
        crate::policy::PolicyDecision::NoOp { .. } => {
            status.mark_synced(reg_name, current);
        }
        crate::policy::PolicyDecision::DetectOnly { reason } => {
            metrics.record_drift(plc_name, reg_name, strategy_label);
            status.mark_drift(reg_name, register_spec.desired_value, current);

            recorder
                .publish(Event {
                    type_: EventType::Warning,
                    reason: "DriftDetected".to_string(),
                    note: Some(reason),
                    action: "Reconcile".to_string(),
                    secondary: None,
                })
                .await
                .ok();
        }
        crate::policy::PolicyDecision::Halt { reason } => {
            metrics.record_drift(plc_name, reg_name, strategy_label);
            status.mark_drift(reg_name, register_spec.desired_value, current);
            status.set_error(reason.clone());

            recorder
                .publish(Event {
                    type_: EventType::Warning,
                    reason: "HaltTriggered".to_string(),
                    note: Some(reason),
                    action: "Reconcile".to_string(),
                    secondary: None,
                })
                .await
                .ok();
        }
        crate::policy::PolicyDecision::Skip { reason } => {
            warn!(
                "PLC '{}' register '{}' correction skipped: {}",
                plc_name, reg_name, reason
            );
            status.mark_drift(reg_name, register_spec.desired_value, current);
        }
        crate::policy::PolicyDecision::Correct {
            desired_value,
            reason,
        } => {
            metrics.record_drift(plc_name, reg_name, strategy_label);
            status.mark_drift(reg_name, desired_value, current);

            recorder
                .publish(Event {
                    type_: EventType::Warning,
                    reason: "DriftDetected".to_string(),
                    note: Some(reason),
                    action: "Reconcile".to_string(),
                    secondary: None,
                })
                .await
                .ok();

            apply_auto_correction(
                plc_name,
                register_spec,
                plc_client,
                status,
                recorder,
                metrics,
            )
            .await?;
        }
    }

    Ok(())
}

async fn apply_auto_correction(
    plc_name: &str,
    register_spec: &crate::crd::RegisterSpec,
    plc_client: &dyn PLCAdapter,
    status: &mut IndustrialPLCStatus,
    recorder: &Recorder,
    metrics: &OperatorMetrics,
) -> Result<(), Error> {
    let reg_name = &register_spec.name;

    status.mark_correcting(reg_name);

    match plc_client
        .write_register(register_spec.address, register_spec.desired_value)
        .await
    {
        Ok(()) => {
            metrics.record_correction(plc_name, reg_name, "Auto");
            status.mark_corrected(reg_name, register_spec.desired_value);

            recorder
                .publish(Event {
                    type_: EventType::Normal,
                    reason: "DriftCorrected".to_string(),
                    note: Some(format!(
                        "Register '{}' (addr {}) corrected to {}",
                        reg_name, register_spec.address, register_spec.desired_value
                    )),
                    action: "Reconcile".to_string(),
                    secondary: None,
                })
                .await
                .ok();

            info!(
                "PLC '{}' register '{}' corrected to {}",
                plc_name, reg_name, register_spec.desired_value
            );
        }
        Err(e) => {
            status.set_error(format!("Failed to correct register '{}': {}", reg_name, e));
            error!("Failed to correct register '{}': {}", reg_name, e);
        }
    }

    Ok(())
}

fn strategy_label(s: &RemediationStrategy) -> &'static str {
    match s {
        RemediationStrategy::Auto => "Auto",
        RemediationStrategy::Alert => "Alert",
        RemediationStrategy::Halt => "Halt",
    }
}

/// Update the status subresource
async fn update_status(
    api: &Api<IndustrialPLC>,
    name: &str,
    status: IndustrialPLCStatus,
) -> Result<(), Error> {
    let patch = Patch::Merge(serde_json::json!({
        "status": status
    }));

    api.patch_status(name, &PatchParams::default(), &patch)
        .await
        .map_err(Error::Kube)?;

    Ok(())
}

/// Error policy for failed reconciliations
pub fn error_policy(_plc: Arc<IndustrialPLC>, error: &Error, _ctx: Arc<Context>) -> Action {
    error!("Reconciliation failed: {:?}", error);
    Action::requeue(Duration::from_secs(5))
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Kubernetes error: {0}")]
    Kube(#[from] kube::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("PLC client error: {0}")]
    PlcClient(#[from] anyhow::Error),
}
