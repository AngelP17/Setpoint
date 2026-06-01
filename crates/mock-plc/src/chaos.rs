use crate::server::PLCState;
use rand::Rng;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::time::{interval, Duration};
use tracing::{info, warn};

/// Chaos mode configuration
#[derive(Clone)]
pub struct ChaosConfig {
    pub enabled: bool,
    pub interval_secs: u64,
    pub max_drift: u16,
}

impl Default for ChaosConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_secs: 10,
            max_drift: 500,
        }
    }
}

/// Manages chaos mode for simulated PLC drift
pub struct ChaosEngine {
    config: ChaosConfig,
    running: Arc<AtomicBool>,
}

impl ChaosEngine {
    pub fn new(config: ChaosConfig) -> Self {
        Self {
            config,
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start the chaos engine in background. Drifts a random register every tick.
    pub fn spawn(&self, state: Arc<Mutex<PLCState>>) {
        if !self.config.enabled {
            info!("Chaos mode disabled");
            return;
        }

        let running = self.running.clone();
        let interval_secs = self.config.interval_secs;
        let max_drift = self.config.max_drift;

        running.store(true, Ordering::SeqCst);

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async move {
                let mut ticker = interval(Duration::from_secs(interval_secs));
                let mut rng = rand::thread_rng();

                info!(
                    "🌀 CHAOS MODE ACTIVATED! Drifting a random register every {}s (max drift: {})",
                    interval_secs, max_drift
                );

                while running.load(Ordering::SeqCst) {
                    ticker.tick().await;

                    if let Ok(mut state) = state.lock() {
                        if state.registers.is_empty() {
                            continue;
                        }
                        // Pick a random register
                        let addrs: Vec<u16> = state.registers.keys().copied().collect();
                        let addr = addrs[rng.gen_range(0..addrs.len())];
                        let old_value = state.registers[&addr];
                        let drift: i16 = rng.gen_range(-(max_drift as i16)..=max_drift as i16);
                        let new_value = (old_value as i32 + drift as i32).clamp(0, i32::from(u16::MAX)) as u16;
                        state.registers.insert(addr, new_value);

                        warn!(
                            "🌀 CHAOS DRIFT! Register @{} changed: {} → {} (drift: {})",
                            addr, old_value, new_value, drift
                        );
                    }
                }
            });
        });
    }

    #[allow(dead_code)]
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        info!("Chaos mode stopped");
    }
}
