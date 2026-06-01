use axum::{http::StatusCode, Json};
use kube::Client;
use operator::crd::IndustrialPLC;
use serde::Serialize;

use crate::error::ApiError;

pub const SERVICE_NAME: &str = "setpoint-api";
pub const SERVICE_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
    pub timestamp: String,
    pub kube_client_loaded: bool,
    pub mode: &'static str,
}

pub async fn health_response() -> HealthResponse {
    let client_loaded = Client::try_default().await.is_ok();
    let mode = if client_loaded {
        "demo-ready"
    } else {
        "demo-fallback"
    };
    HealthResponse {
        status: "ok",
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: chrono::Utc::now().to_rfc3339(),
        kube_client_loaded: client_loaded,
        mode,
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlcListResponse {
    pub items: Vec<serde_json::Value>,
    pub count: usize,
    pub source: &'static str,
}

pub async fn list_plcs() -> Result<Json<PlcListResponse>, ApiError> {
    let client = Client::try_default().await.map_err(ApiError::internal)?;
    let api: kube::Api<IndustrialPLC> = kube::Api::all(client);
    let plc_list = api
        .list(&Default::default())
        .await
        .map_err(ApiError::from)?;

    let items: Vec<serde_json::Value> = plc_list
        .items
        .into_iter()
        .map(serde_json::to_value)
        .collect::<Result<_, _>>()
        .map_err(ApiError::internal)?;
    let count = items.len();

    Ok(Json(PlcListResponse {
        items,
        count,
        source: "kubernetes",
    }))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponse {
    pub status: &'static str,
    pub message: String,
    pub plc: String,
    pub namespace: String,
    pub requested_at: String,
}

pub async fn trigger_sync(namespace: String, name: String) -> Result<Json<SyncResponse>, ApiError> {
    let client = Client::try_default().await.map_err(ApiError::internal)?;
    let api: kube::Api<IndustrialPLC> = kube::Api::namespaced(client, &namespace);

    let mut annotations = std::collections::BTreeMap::new();
    annotations.insert(
        "setpoint.io/last-sync-request".to_string(),
        chrono::Utc::now().to_rfc3339(),
    );

    let patch = kube::api::Patch::Merge(serde_json::json!({
        "metadata": {
            "annotations": annotations
        }
    }));

    api.patch(&name, &kube::api::PatchParams::default(), &patch)
        .await
        .map_err(ApiError::from)?;

    Ok(Json(SyncResponse {
        status: "success",
        message:
            "Manual reconcile annotation patched; operator will pick it up on next watch tick."
                .to_string(),
        plc: name,
        namespace,
        requested_at: chrono::Utc::now().to_rfc3339(),
    }))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventListResponse {
    pub items: Vec<serde_json::Value>,
    pub count: usize,
    pub source: &'static str,
}

pub async fn list_events() -> Result<Json<EventListResponse>, ApiError> {
    let client = Client::try_default().await.map_err(ApiError::internal)?;
    let api: kube::Api<k8s_openapi::api::core::v1::Event> = kube::Api::all(client);
    let events = api
        .list(&kube::api::ListParams::default().limit(50))
        .await
        .map_err(ApiError::from)?;

    let items: Vec<serde_json::Value> = events
        .items
        .into_iter()
        .filter(|e| e.involved_object.kind.as_deref() == Some("IndustrialPLC"))
        .map(|e| {
            serde_json::json!({
                "timestamp": e.last_timestamp.as_ref().map(|t| t.0.to_rfc3339()).unwrap_or_default(),
                "name": e.involved_object.name.as_deref().unwrap_or_default(),
                "reason": e.reason.as_deref().unwrap_or_default(),
                "message": e.message.as_deref().unwrap_or_default(),
                "type": e.type_.as_deref().unwrap_or_default(),
            })
        })
        .collect();
    let count = items.len();

    Ok(Json(EventListResponse {
        items,
        count,
        source: "kubernetes",
    }))
}

// Default StatusCode import retained for trait impls below
#[allow(dead_code)]
fn _status_marker() -> StatusCode {
    StatusCode::OK
}
