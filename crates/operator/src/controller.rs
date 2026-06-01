use crate::crd::{IndustrialPLC, IndustrialPLCStatus, RemediationStrategy};
use crate::metrics::OperatorMetrics;
use crate::plc_client::PLCClient;
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
    let start = Instant::now();
    let name = plc.name_any();
    let namespace = plc.namespace().unwrap_or_default();

    info!(
        "Reconciling PLC: {}/{} ({} register(s))",
        namespace,
        name,
        plc.spec.registers.len()
    );

    let api: Api<IndustrialPLC> = Api::namespaced(ctx.client.clone(), &namespace);
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
    let plc_client = PLCClient::new(&plc.spec.device_address, plc.spec.port);
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
            &plc_client,
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
    plc_client: &PLCClient,
    status: &mut IndustrialPLCStatus,
    recorder: &Recorder,
    metrics: &OperatorMetrics,
) -> Result<(), Error> {
    let reg_name = &register_spec.name;
    let strategy = &register_spec.remediation.strategy;
    let strategy_label = strategy_label(strategy);

    let current = plc_client.read_register(register_spec.address).await?;
    metrics.set_register_value(plc_name, reg_name, current);

    info!(
        "PLC '{}' register '{}' @{}: current={}, desired={}, strategy={}",
        plc_name,
        reg_name,
        register_spec.address,
        current,
        register_spec.desired_value,
        strategy_label
    );

    if current == register_spec.desired_value {
        status.mark_synced(reg_name, current);
        return Ok(());
    }

    // Drift detected
    metrics.record_drift(plc_name, reg_name, strategy_label);
    status.mark_drift(reg_name, register_spec.desired_value, current);

    recorder
        .publish(Event {
            type_: EventType::Warning,
            reason: "DriftDetected".to_string(),
            note: Some(format!(
                "Register '{}' (addr {}) drifted: desired={}, actual={}, strategy={}",
                reg_name,
                register_spec.address,
                register_spec.desired_value,
                current,
                strategy_label
            )),
            action: "Reconcile".to_string(),
            secondary: None,
        })
        .await
        .ok();

    match strategy {
        RemediationStrategy::Auto => {
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
        RemediationStrategy::Alert => {
            info!(
                "PLC '{}' register '{}' drift detected; Alert strategy, no correction",
                plc_name, reg_name
            );
        }
        RemediationStrategy::Halt => {
            warn!(
                "PLC '{}' register '{}' drift detected; Halt strategy, marking PLC Failed",
                plc_name, reg_name
            );
            status.set_error(format!(
                "Halt: register '{}' drifted to {} (desired {})",
                reg_name, current, register_spec.desired_value
            ));
        }
    }

    Ok(())
}

async fn apply_auto_correction(
    plc_name: &str,
    register_spec: &crate::crd::RegisterSpec,
    plc_client: &PLCClient,
    status: &mut IndustrialPLCStatus,
    recorder: &Recorder,
    metrics: &OperatorMetrics,
) -> Result<(), Error> {
    let reg_name = &register_spec.name;
    let cooldown = register_spec.remediation.cooldown_secs;
    let max_per_hour = register_spec.remediation.max_corrections_per_hour;

    // Cooldown check
    if let Some(rs) = status.register(reg_name) {
        if let Some(last_ts) = &rs.last_correction_at {
            if let Ok(last) = DateTime::parse_from_rfc3339(last_ts) {
                let elapsed = (Utc::now() - last.with_timezone(&Utc)).num_seconds();
                if elapsed < cooldown as i64 {
                    info!(
                        "PLC '{}' register '{}' cooldown active ({}s < {}s), skipping correction",
                        plc_name, reg_name, elapsed, cooldown
                    );
                    return Ok(());
                }
            }
        }
    }

    // Max corrections per hour check
    if max_per_hour > 0 {
        if let Some(rs) = status.register(reg_name) {
            if rs.corrections_applied >= max_per_hour {
                warn!(
                    "PLC '{}' register '{}' reached max corrections/hour ({}), skipping",
                    plc_name, reg_name, max_per_hour
                );
                return Ok(());
            }
        }
    }

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
