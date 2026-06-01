use axum::Json;
use chrono::Utc;
use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditBlockView {
    pub index: u32,
    pub timestamp: String,
    pub plc: String,
    pub action_taken: String,
    pub registers: Vec<AuditRegisterState>,
    pub previous_hash: String,
    pub hash: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditRegisterState {
    pub name: String,
    pub address: u16,
    pub desired_value: u16,
    pub current_value: Option<u16>,
    pub strategy: String,
}

impl From<operator::crypto::AuditBlock> for AuditBlockView {
    fn from(value: operator::crypto::AuditBlock) -> Self {
        AuditBlockView {
            index: 0,
            timestamp: value.timestamp,
            plc: value.plc_name,
            action_taken: value.action_taken,
            registers: value
                .registers
                .into_iter()
                .map(|r| AuditRegisterState {
                    name: r.name,
                    address: r.address,
                    desired_value: r.desired_value,
                    current_value: r.current_value,
                    strategy: r.strategy,
                })
                .collect(),
            previous_hash: value.prev_hash,
            hash: value.hash,
            signature: value.signature,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditResponse {
    pub verifying_key: String,
    pub blocks: Vec<AuditBlockView>,
    pub is_mock: bool,
    pub source: &'static str,
    pub note: String,
}

const NOTE: &str =
    "Demo audit chain: the operator exposes the cryptographic ledger under /audit; this gateway \
     serves a bundled mock when the operator service is unreachable so the console can render \
     the verification surface end-to-end. The block contents are illustrative and not the live \
     operator chain.";

pub fn mock_audit() -> Json<AuditResponse> {
    let verifying_key = operator::crypto::get_verifying_key();
    let vk_hex = hex::encode(verifying_key.to_bytes());
    let ledger = operator::crypto::get_ledger("line-1-printer-plc");

    let blocks: Vec<AuditBlockView> = ledger
        .into_iter()
        .enumerate()
        .map(|(idx, b)| {
            let mut view: AuditBlockView = b.into();
            view.index = idx as u32;
            view
        })
        .collect();

    Json(AuditResponse {
        verifying_key: vk_hex,
        blocks,
        is_mock: true,
        source: "mock",
        note: NOTE.to_string(),
    })
}

pub async fn audit_response() -> Json<AuditResponse> {
    let url = "http://localhost:8080/audit";
    let client = reqwest::Client::new();
    if let Ok(res) = client
        .get(url)
        .timeout(Duration::from_millis(500))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Ok(blocks) =
                    serde_json::from_value::<Vec<operator::crypto::AuditBlock>>(json.clone())
                {
                    let blocks: Vec<AuditBlockView> = blocks
                        .into_iter()
                        .enumerate()
                        .map(|(idx, b)| {
                            let mut view: AuditBlockView = b.into();
                            view.index = idx as u32;
                            view
                        })
                        .collect();
                    return Json(AuditResponse {
                        verifying_key: String::new(),
                        blocks,
                        is_mock: false,
                        source: "operator",
                        note: "Live audit chain returned by the operator.".to_string(),
                    });
                }
            }
        }
    }
    mock_audit()
}

#[derive(Debug, Serialize)]
pub struct StreamEvent {
    pub timestamp: String,
    pub event: String,
    pub plc: String,
    pub message: String,
    pub demo: bool,
}

pub fn demo_event(state: u32) -> StreamEvent {
    let (event, message) = match state % 4 {
        0 => (
            "ReconciliationActive",
            "Full register scan active. All connections healthy.",
        ),
        1 => (
            "TelemetryHeartbeat",
            "Modbus TCP poll complete. Registers in sync.",
        ),
        2 => (
            "AuditChained",
            "SHA-256 state chain block authenticated and signed using Ed25519 key pair.",
        ),
        _ => (
            "LiveTelemetryTick",
            "Poll completed. Conveyor-speed in sync.",
        ),
    };
    StreamEvent {
        timestamp: Utc::now().to_rfc3339(),
        event: event.to_string(),
        plc: "line-1-printer-plc".to_string(),
        message: message.to_string(),
        demo: true,
    }
}
