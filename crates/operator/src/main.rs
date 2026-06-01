mod controller;
mod crd;
mod crypto;
mod leader;
mod metrics;
mod plc_client;
mod policy;

use crate::controller::{error_policy, reconcile, Context};
use crate::crd::IndustrialPLC;
use crate::metrics::OperatorMetrics;
use axum::{
    routing::{get, post},
    Json, Router,
};
use futures::StreamExt;
use kube::runtime::events::Reporter;
use kube::{Api, Client};
use prometheus::TextEncoder;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting Setpoint Operator...");

    // Initialize Kubernetes client
    let client = Client::try_default().await?;
    info!("Connected to Kubernetes cluster");

    // Initialize leader election
    let operator_namespace =
        std::env::var("POD_NAMESPACE").unwrap_or_else(|_| "default".to_string());
    crate::leader::start_leader_election(client.clone(), operator_namespace).await;

    // Initialize metrics
    let metrics = Arc::new(OperatorMetrics::new()?);
    info!("Metrics initialized");

    // Create context for controller
    let ctx = Arc::new(Context {
        client: client.clone(),
        metrics: metrics.clone(),
        reporter: Reporter {
            controller: "setpoint-operator".to_string(),
            instance: std::env::var("HOSTNAME").ok(),
        },
    });

    // Start metrics server
    let metrics_router = Router::new()
        .route("/metrics", get(metrics_handler))
        .route("/health", get(health_handler))
        .route("/validate", post(validate_handler))
        .route("/audit", get(audit_handler));

    let metrics_addr: SocketAddr = "0.0.0.0:8080".parse()?;
    let metrics_clone = metrics.clone();

    tokio::spawn(async move {
        info!("Starting metrics server on {}", metrics_addr);
        let app = metrics_router.layer(axum::Extension(metrics_clone));
        axum::serve(
            tokio::net::TcpListener::bind(metrics_addr).await.unwrap(),
            app,
        )
        .await
        .unwrap();
    });

    // Start controller
    info!("Starting IndustrialPLC controller for setpoint.io/v1...");
    let plcs = Api::<IndustrialPLC>::all(client.clone());

    // Ensure CRD exists
    if let Err(e) = plcs.list(&Default::default()).await {
        info!("CRD may not exist yet: {}", e);
    }

    kube::runtime::Controller::new(plcs, Default::default())
        .run(reconcile, error_policy, ctx)
        .for_each(|res| async move {
            match res {
                Ok(o) => info!("Reconciled: {:?}", o),
                Err(e) => error!("Reconciliation error: {:?}", e),
            }
        })
        .await;

    Ok(())
}

/// Handler for /metrics endpoint
async fn metrics_handler(
    axum::Extension(metrics): axum::Extension<Arc<OperatorMetrics>>,
) -> String {
    let encoder = TextEncoder::new();
    let metric_families = metrics.registry.gather();
    encoder
        .encode_to_string(&metric_families)
        .unwrap_or_default()
}

/// Handler for /health endpoint
async fn health_handler() -> &'static str {
    "OK"
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AdmissionReviewRequest {
    request: Option<AdmissionRequest>,
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AdmissionRequest {
    uid: String,
    object: Option<serde_json::Value>,
    old_object: Option<serde_json::Value>,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AdmissionReviewResponse {
    api_version: String,
    kind: String,
    response: AdmissionResponse,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AdmissionResponse {
    uid: String,
    allowed: bool,
    status: Option<AdmissionStatus>,
}

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AdmissionStatus {
    code: u16,
    message: String,
}

async fn validate_handler(
    Json(body): Json<AdmissionReviewRequest>,
) -> Json<AdmissionReviewResponse> {
    info!("Received admission validation request");

    let req = match body.request {
        Some(r) => r,
        None => {
            return Json(AdmissionReviewResponse {
                api_version: "admission.k8s.io/v1".to_string(),
                kind: "AdmissionReview".to_string(),
                response: AdmissionResponse {
                    uid: "".to_string(),
                    allowed: true,
                    status: None,
                },
            });
        }
    };

    let uid = req.uid.clone();

    let new_obj = match req.object {
        Some(obj) => obj,
        None => {
            return Json(AdmissionReviewResponse {
                api_version: "admission.k8s.io/v1".to_string(),
                kind: "AdmissionReview".to_string(),
                response: AdmissionResponse {
                    uid,
                    allowed: true,
                    status: None,
                },
            });
        }
    };

    let plc: Result<IndustrialPLC, _> = serde_json::from_value(new_obj);
    let plc = match plc {
        Ok(p) => p,
        Err(e) => {
            return Json(AdmissionReviewResponse {
                api_version: "admission.k8s.io/v1".to_string(),
                kind: "AdmissionReview".to_string(),
                response: AdmissionResponse {
                    uid,
                    allowed: false,
                    status: Some(AdmissionStatus {
                        code: 400,
                        message: format!("Failed to parse IndustrialPLC resource: {}", e),
                    }),
                },
            });
        }
    };

    // Rule A: Check register boundaries (dynamic spec-level minValue and maxValue, plus the default conveyor speed check)
    for r in &plc.spec.registers {
        if let Some(min) = r.min_value {
            if r.desired_value < min {
                return Json(AdmissionReviewResponse {
                    api_version: "admission.k8s.io/v1".to_string(),
                    kind: "AdmissionReview".to_string(),
                    response: AdmissionResponse {
                        uid: uid.clone(),
                        allowed: false,
                        status: Some(AdmissionStatus {
                            code: 400,
                            message: format!(
                                "Validation failed: register '{}' desiredValue {} is below the safe minimum {}",
                                r.name, r.desired_value, min
                            ),
                        }),
                    },
                });
            }
        }
        if let Some(max) = r.max_value {
            if r.desired_value > max {
                return Json(AdmissionReviewResponse {
                    api_version: "admission.k8s.io/v1".to_string(),
                    kind: "AdmissionReview".to_string(),
                    response: AdmissionResponse {
                        uid: uid.clone(),
                        allowed: false,
                        status: Some(AdmissionStatus {
                            code: 400,
                            message: format!(
                                "Validation failed: register '{}' desiredValue {} exceeds the safe maximum {}",
                                r.name, r.desired_value, max
                            ),
                        }),
                    },
                });
            }
        }

        // Conveyor speed hard safe limit
        if r.name.contains("speed") && r.desired_value > 3000 {
            return Json(AdmissionReviewResponse {
                api_version: "admission.k8s.io/v1".to_string(),
                kind: "AdmissionReview".to_string(),
                response: AdmissionResponse {
                    uid: uid.clone(),
                    allowed: false,
                    status: Some(AdmissionStatus {
                        code: 400,
                        message: format!(
                            "Validation failed: speed register '{}' desiredValue {} exceeds safe limit 3000",
                            r.name, r.desired_value
                        ),
                    }),
                },
            });
        }
    }

    // Rule B: Validate safety registers (e.g. emergency-halt or SafetyCritical criticality) strategy cannot be modified from Halt to Alert/Auto
    if let Some(old_val) = req.old_object {
        if let Ok(old_plc) = serde_json::from_value::<IndustrialPLC>(old_val) {
            for old_r in &old_plc.spec.registers {
                let is_safety_critical = old_r.name.contains("halt")
                    || old_r.criticality.as_deref() == Some("SafetyCritical");

                if is_safety_critical
                    && old_r.remediation.strategy == crate::crd::RemediationStrategy::Halt
                {
                    if let Some(new_r) = plc.spec.registers.iter().find(|r| r.name == old_r.name) {
                        if new_r.remediation.strategy != crate::crd::RemediationStrategy::Halt {
                            return Json(AdmissionReviewResponse {
                                api_version: "admission.k8s.io/v1".to_string(),
                                kind: "AdmissionReview".to_string(),
                                response: AdmissionResponse {
                                    uid: uid.clone(),
                                    allowed: false,
                                    status: Some(AdmissionStatus {
                                        code: 400,
                                        message: format!(
                                            "Validation failed: safety register '{}' remediation strategy cannot be downgraded from Halt to {:?}",
                                            old_r.name, new_r.remediation.strategy
                                        ),
                                    }),
                                },
                            });
                        }
                    }
                }
            }
        }
    }

    Json(AdmissionReviewResponse {
        api_version: "admission.k8s.io/v1".to_string(),
        kind: "AdmissionReview".to_string(),
        response: AdmissionResponse {
            uid,
            allowed: true,
            status: Some(AdmissionStatus {
                code: 200,
                message: "Validation passed".to_string(),
            }),
        },
    })
}

async fn audit_handler() -> Json<serde_json::Value> {
    let verifying_key = crate::crypto::get_verifying_key();
    let vk_hex = hex::encode(verifying_key.to_bytes());
    let ledgers = crate::crypto::get_ledger("line-1-printer-plc");

    Json(serde_json::json!({
        "verifyingKey": vk_hex,
        "blocks": ledgers,
    }))
}
