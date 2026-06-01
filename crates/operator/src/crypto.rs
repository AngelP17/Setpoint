use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::sync::{Mutex, OnceLock};

static SIGNING_KEY: OnceLock<SigningKey> = OnceLock::new();
static AUDIT_LEDGERS: OnceLock<Mutex<BTreeMap<String, Vec<AuditBlock>>>> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AuditBlock {
    pub timestamp: String,
    pub plc_name: String,
    pub registers: Vec<RegisterAuditState>,
    pub action_taken: String,
    pub prev_hash: String,
    pub hash: String,
    pub signature: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegisterAuditState {
    pub name: String,
    pub address: u16,
    pub desired_value: u16,
    pub current_value: Option<u16>,
    pub strategy: String,
}

pub fn get_signing_key() -> &'static SigningKey {
    SIGNING_KEY.get_or_init(|| SigningKey::generate(&mut OsRng))
}

pub fn get_verifying_key() -> VerifyingKey {
    get_signing_key().verifying_key()
}

pub fn get_ledger(plc_name: &str) -> Vec<AuditBlock> {
    let ledgers = AUDIT_LEDGERS
        .get_or_init(|| Mutex::new(BTreeMap::new()))
        .lock()
        .unwrap();
    ledgers.get(plc_name).cloned().unwrap_or_default()
}

pub fn generate_audit_block(
    plc_name: String,
    registers: Vec<RegisterAuditState>,
    action_taken: String,
) -> AuditBlock {
    let mut ledgers = AUDIT_LEDGERS
        .get_or_init(|| Mutex::new(BTreeMap::new()))
        .lock()
        .unwrap();

    let history = ledgers.entry(plc_name.clone()).or_default();

    let prev_hash = if let Some(last) = history.last() {
        last.hash.clone()
    } else {
        "0000000000000000000000000000000000000000000000000000000000000000".to_string()
    };

    let timestamp = chrono::Utc::now().to_rfc3339();

    #[derive(Serialize)]
    struct SignTarget<'a> {
        timestamp: &'a str,
        plc_name: &'a str,
        registers: &'a [RegisterAuditState],
        action_taken: &'a str,
        prev_hash: &'a str,
    }

    let target = SignTarget {
        timestamp: &timestamp,
        plc_name: &plc_name,
        registers: &registers,
        action_taken: &action_taken,
        prev_hash: &prev_hash,
    };

    let serialized = serde_json::to_vec(&target).unwrap();

    let mut hasher = Sha256::new();
    hasher.update(&serialized);
    let hash_bytes = hasher.finalize();
    let hash = hex::encode(hash_bytes);

    let signing_key = get_signing_key();
    let signature_bytes = signing_key.sign(&hash_bytes);
    let signature = hex::encode(signature_bytes.to_bytes());

    let block = AuditBlock {
        timestamp,
        plc_name,
        registers,
        action_taken,
        prev_hash,
        hash,
        signature,
    };

    history.push(block.clone());

    block
}
