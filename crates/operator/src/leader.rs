use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;
use k8s_openapi::api::coordination::v1::{Lease, LeaseSpec};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::{MicroTime, ObjectMeta};
use kube::{Api, Client};
use kube::api::PostParams;
use tracing::{info, error, warn};

static IS_LEADER: OnceLock<std::sync::Arc<AtomicBool>> = OnceLock::new();

pub fn get_leader_handle() -> std::sync::Arc<AtomicBool> {
    IS_LEADER.get_or_init(|| std::sync::Arc::new(AtomicBool::new(false))).clone()
}

pub fn is_leader() -> bool {
    get_leader_handle().load(Ordering::Relaxed)
}

pub fn set_leader(val: bool) {
    get_leader_handle().store(val, Ordering::Relaxed);
}

pub fn get_holder_id() -> String {
    std::env::var("POD_NAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| {
            format!("setpoint-operator-{}", std::process::id())
        })
}

pub async fn start_leader_election(client: Client, namespace: String) {
    let holder_id = get_holder_id();
    info!("Starting lease leader election with holder ID: {}", holder_id);

    let lease_api: Api<Lease> = Api::namespaced(client, &namespace);
    let lease_name = "setpoint-operator-lease";

    tokio::spawn(async move {
        loop {
            match try_acquire_or_renew_lease(&lease_api, lease_name, &holder_id).await {
                Ok(acquired) => {
                    let old_leader = is_leader();
                    set_leader(acquired);
                    if acquired && !old_leader {
                        info!("Acquired leadership lock!");
                    } else if !acquired && old_leader {
                        warn!("Lost leadership lock!");
                    }
                }
                Err(e) => {
                    error!("Leader election error: {:?}", e);
                    // On error, step down to be safe
                    set_leader(false);
                }
            }

            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}

async fn try_acquire_or_renew_lease(
    api: &Api<Lease>,
    name: &str,
    holder_id: &str,
) -> Result<bool, kube::Error> {
    let now = chrono::Utc::now();
    let now_micro = MicroTime(now);

    match api.get(name).await {
        Ok(lease) => {
            let spec = lease.spec.clone().unwrap_or_default();
            let holder = spec.holder_identity.as_deref().unwrap_or("");
            let duration = spec.lease_duration_seconds.unwrap_or(15) as i64;
            let last_renew = spec.renew_time.as_ref().map(|mt| mt.0).unwrap_or(now);

            let is_expired = (now - last_renew).num_seconds() > duration;
            let is_us = holder == holder_id;

            if is_us || is_expired {
                let new_spec = LeaseSpec {
                    holder_identity: Some(holder_id.to_string()),
                    lease_duration_seconds: Some(15),
                    acquire_time: Some(if is_us { spec.acquire_time.unwrap_or(now_micro.clone()) } else { now_micro.clone() }),
                    renew_time: Some(now_micro),
                    lease_transitions: Some(if is_us { spec.lease_transitions.unwrap_or(0) } else { spec.lease_transitions.unwrap_or(0) + 1 }),
                };

                let mut new_lease = lease.clone();
                new_lease.spec = Some(new_spec);

                match api.replace(name, &PostParams::default(), &new_lease).await {
                    Ok(_) => Ok(true),
                    Err(e) => {
                        warn!("Failed to renew lease (possibly conflict): {}", e);
                        Ok(false)
                    }
                }
            } else {
                Ok(false)
            }
        }
        Err(kube::Error::Api(ref err_val)) if err_val.code == 404 => {
            info!("Lease not found, creating a new one: {}", name);
            let new_lease = Lease {
                metadata: ObjectMeta {
                    name: Some(name.to_string()),
                    ..Default::default()
                },
                spec: Some(LeaseSpec {
                    holder_identity: Some(holder_id.to_string()),
                    lease_duration_seconds: Some(15),
                    acquire_time: Some(now_micro.clone()),
                    renew_time: Some(now_micro),
                    lease_transitions: Some(1),
                }),
            };

            match api.create(&PostParams::default(), &new_lease).await {
                Ok(_) => Ok(true),
                Err(e) => {
                    warn!("Failed to create lease: {}", e);
                    Ok(false)
                }
            }
        }
        Err(e) => Err(e),
    }
}
