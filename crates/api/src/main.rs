use axum::{
    extract::Path,
    http::{header, Method},
    response::sse::{Event, KeepAlive, Sse},
    routing::{get, post},
    Json, Router,
};
use futures::stream;
use std::net::SocketAddr;
use std::time::Duration;
use tokio_stream::Stream;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod audit;
mod error;
mod handlers;
mod policy_sim;

use audit::audit_response;
use error::ApiError;
use handlers::{health_response, list_events, list_plcs, trigger_sync};
use policy_sim::{evaluate, SimulationRequest};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting Setpoint API Gateway on port 8081...");

    let allowed_origins: Vec<axum::http::HeaderValue> = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    .iter()
    .map(|o| o.parse::<axum::http::HeaderValue>().unwrap())
    .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/api/health", get(health_route))
        .route("/api/plcs", get(list_plcs_route))
        .route("/api/plcs/:namespace/:name", get(get_plc_route))
        .route("/api/plcs/:namespace/:name/sync", post(trigger_sync_route))
        .route("/api/events", get(list_events_route))
        .route("/api/audit", get(audit_route))
        .route("/api/simulate-policy", post(simulate_policy_route))
        .route("/api/stream/events", get(stream_events_route))
        .layer(cors);

    let addr: SocketAddr = "0.0.0.0:8081".parse()?;
    info!("API Gateway server listening on {}", addr);

    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();

    Ok(())
}

async fn health_route() -> Json<handlers::HealthResponse> {
    Json(health_response().await)
}

async fn list_plcs_route() -> Result<Json<handlers::PlcListResponse>, ApiError> {
    list_plcs().await
}

async fn get_plc_route(
    Path((namespace, name)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let client = kube::Client::try_default()
        .await
        .map_err(ApiError::internal)?;
    let api: kube::Api<operator::crd::IndustrialPLC> = kube::Api::namespaced(client, &namespace);
    let plc = api.get(&name).await.map_err(|e| match &e {
        kube::Error::Api(api_err) if api_err.code == 404 => {
            ApiError::not_found(format!("PLC {namespace}/{name} not found"))
        }
        _ => ApiError::internal(format!("Failed to fetch PLC: {e}")),
    })?;
    serde_json::to_value(plc)
        .map(Json)
        .map_err(|e| ApiError::internal(format!("Failed to serialise PLC: {e}")))
}

async fn trigger_sync_route(
    Path((namespace, name)): Path<(String, String)>,
) -> Result<Json<handlers::SyncResponse>, ApiError> {
    trigger_sync(namespace, name).await
}

async fn list_events_route() -> Result<Json<handlers::EventListResponse>, ApiError> {
    list_events().await
}

async fn audit_route() -> Json<audit::AuditResponse> {
    audit_response().await
}

async fn simulate_policy_route(
    Json(body): Json<SimulationRequest>,
) -> Result<Json<policy_sim::SimulationResponse>, ApiError> {
    if body.cooldown_secs > 86_400 {
        return Err(ApiError::bad_request(
            "cooldownSecs cannot exceed 86400 (24h)",
        ));
    }
    Ok(Json(evaluate(&body)))
}

async fn stream_events_route() -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let stream = stream::unfold(0u32, |state| async move {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let event_json =
            serde_json::to_string(&audit::demo_event(state)).unwrap_or_else(|_| "{}".to_string());
        let ev = Event::default()
            .event("scada-tick")
            .id(state.to_string())
            .data(event_json);
        Some((Ok(ev), state.wrapping_add(1)))
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}
