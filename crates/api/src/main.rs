use axum::{
    routing::{get, post},
    Router, Json,
    http::{Method, HeaderValue, StatusCode},
    response::sse::{Event, KeepAlive, Sse},
};
use tower_http::cors::CorsLayer;
use serde::{Serialize, Deserialize};
use kube::{Api, Client};
use operator::crd::{IndustrialPLC, RemediationStrategy};
use operator::policy::{PolicyEngine, PolicyContext, PolicyDecision};
use std::net::SocketAddr;
use std::time::Duration;
use tokio_stream::Stream;
use futures::stream;
use tracing::{info, error, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting Setpoint API Gateway on port 8081...");

    // Create Cors layer to allow frontend communication
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3000".parse::<HeaderValue>().unwrap())
        .allow_origin("http://127.0.0.1:3000".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    // Build routes
    let app = Router::new()
        .route("/api/health", get(health_handler))
        .route("/api/plcs", get(get_plcs_handler))
        .route("/api/plcs/:namespace/:name", get(get_plc_handler))
        .route("/api/plcs/:namespace/:name/sync", post(trigger_sync_handler))
        .route("/api/events", get(get_events_handler))
        .route("/api/audit", get(get_audit_handler))
        .route("/api/simulate-policy", post(simulate_policy_handler))
        .route("/api/stream/events", get(stream_events_handler))
        .layer(cors);

    let addr: SocketAddr = "0.0.0.0:8081".parse()?;
    info!("API Gateway server listening on {}", addr);

    axum::serve(
        tokio::net::TcpListener::bind(addr).await.unwrap(),
        app,
    )
    .await
    .unwrap();

    Ok(())
}

async fn health_handler() -> &'static str {
    "OK"
}

// Handler to query K8s for all PLCs
async fn get_plcs_handler() -> Result<Json<Vec<IndustrialPLC>>, (StatusCode, String)> {
    let client = Client::try_default().await.map_err(|e| {
        error!("K8s Client error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create K8s client: {}", e))
    })?;

    let api: Api<IndustrialPLC> = Api::all(client);
    let plc_list = api.list(&Default::default()).await.map_err(|e| {
        error!("Failed to list IndustrialPLCs: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to list PLCs: {}", e))
    })?;

    Ok(Json(plc_list.items))
}

// Handler to get a single PLC
async fn get_plc_handler(
    axum::extract::Path((namespace, name)): axum::extract::Path<(String, String)>,
) -> Result<Json<IndustrialPLC>, (StatusCode, String)> {
    let client = Client::try_default().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let api: Api<IndustrialPLC> = Api::namespaced(client, &namespace);
    let plc = api.get(&name).await.map_err(|e| {
        (StatusCode::NOT_FOUND, format!("PLC not found: {}", e))
    })?;

    Ok(Json(plc))
}

// Handler to trigger manual reconciliation
async fn trigger_sync_handler(
    axum::extract::Path((namespace, name)): axum::extract::Path<(String, String)>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let client = Client::try_default().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let api: Api<IndustrialPLC> = Api::namespaced(client, &namespace);
    
    // Patch annotation
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
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to patch PLC: {}", e)))?;

    Ok(Json(serde_json::json!({ "status": "success", "message": "Manual sync triggered" })))
}

// Handler to get K8s events
async fn get_events_handler() -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let client = Client::try_default().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let api: Api<k8s_openapi::api::core::v1::Event> = Api::all(client);
    let events = api.list(&kube::api::ListParams::default().limit(50)).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    let filtered: Vec<_> = events.items
        .into_iter()
        .filter(|e| {
            e.involved_object.kind.as_deref() == Some("IndustrialPLC")
        })
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

    Ok(Json(filtered))
}

// Handler to fetch zero-trust audit ledger
async fn get_audit_handler() -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Try to query the operator service on port 8080
    let url = "http://localhost:8080/audit";
    let client = reqwest::Client::new();
    if let Ok(res) = client.get(url).timeout(Duration::from_millis(500)).send().await {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            return Ok(Json(json));
        }
    }

    // Fallback: Generate mock, signed cryptographic audit chain for local preview!
    // This allows the front-end to showcase full operational logs even in offline previews
    let verifying_key = operator::crypto::get_verifying_key();
    let vk_hex = hex::encode(verifying_key.to_bytes());
    let mock_ledger = operator::crypto::get_ledger("line-1-printer-plc");
    
    Ok(Json(serde_json::json!({
        "verifyingKey": vk_hex,
        "blocks": mock_ledger
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulationRequest {
    strategy: String,
    desired_value: u16,
    current_value: u16,
    cooldown_secs: u64,
    max_corrections_per_hour: u32,
    corrections_last_hour: u32,
    last_correction_elapsed_secs: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SimulationResponse {
    verdict: String,
    action: String,
    reason: String,
    risk: String,
}

// Handler to run a mock policy simulation
async fn simulate_policy_handler(
    Json(body): Json<SimulationRequest>,
) -> Json<SimulationResponse> {
    let strategy = match body.strategy.as_str() {
        "Halt" => RemediationStrategy::Halt,
        "Alert" => RemediationStrategy::Alert,
        _ => RemediationStrategy::Auto,
    };

    let last_correction_at = body.last_correction_elapsed_secs.map(|s| {
        chrono::Utc::now() - chrono::Duration::seconds(s as i64)
    });

    let ctx = PolicyContext {
        plc_name: "simulated-plc".to_string(),
        register_name: "simulated-register".to_string(),
        desired_value: body.desired_value,
        current_value: body.current_value,
        strategy,
        last_correction_at,
        corrections_last_hour: body.corrections_last_hour,
        max_corrections_per_hour: body.max_corrections_per_hour,
        cooldown_secs: body.cooldown_secs,
    };

    let decision = PolicyEngine::evaluate(&ctx);

    let (verdict, action, reason, risk) = match decision {
        PolicyDecision::NoOp { reason } => (
            "In Sync".to_string(),
            "None".to_string(),
            reason,
            "Low".to_string(),
        ),
        PolicyDecision::DetectOnly { reason } => (
            "Drift Detected".to_string(),
            "Emit Alert Event, increment drift metric, do not write".to_string(),
            reason,
            "Medium".to_string(),
        ),
        PolicyDecision::Halt { reason } => (
            "System Halt".to_string(),
            "Mark IndustrialPLC Failed, alert operator".to_string(),
            reason,
            "High / Critical".to_string(),
        ),
        PolicyDecision::Skip { reason } => (
            "Drift Ignored (Guardrail active)".to_string(),
            "Skip correction, record rate-limit status".to_string(),
            reason,
            "High".to_string(),
        ),
        PolicyDecision::Correct { desired_value, reason } => (
            "Reconciliation Triggered".to_string(),
            format!("Write desired value {} back to register", desired_value),
            reason,
            "Low (Safe Auto-correction)".to_string(),
        ),
    };

    Json(SimulationResponse {
        verdict,
        action,
        reason,
        risk,
    })
}

// Handler for SSE events stream
async fn stream_events_handler() -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let mock_stream = stream::unfold(0, |state| async move {
        // Send a telemetry event update every 5 seconds
        tokio::time::sleep(Duration::from_secs(5)).await;
        
        let event_json = match state % 4 {
            0 => serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "event": "ReconciliationActive",
                "plc": "line-1-printer-plc",
                "message": "Full register scan active. All connections healthy."
            }),
            1 => serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "event": "TelemetryHeartbeat",
                "plc": "line-1-printer-plc",
                "message": "OPC UA secure subscription healthy. Modbus TCP in-sync."
            }),
            2 => serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "event": "AuditChained",
                "plc": "line-1-printer-plc",
                "message": "SHA-256 state chain block authenticated and signed using Ed25519 key pair."
            }),
            _ => serde_json::json!({
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "event": "LiveTelemetryTick",
                "plc": "line-1-printer-plc",
                "message": "Poll completed in 0.04s. Conveyor-speed in sync."
            }),
        };

        let ev = Event::default()
            .event("scada-tick")
            .data(event_json.to_string());

        Some((Ok(ev), state + 1))
    });

    Sse::new(mock_stream).keep_alive(KeepAlive::default())
}
