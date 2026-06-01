mod chaos;
mod server;

use crate::chaos::{ChaosConfig, ChaosEngine};
use crate::server::{start_server, PLCState};
use clap::Parser;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, Level};

#[derive(Parser, Debug)]
#[command(name = "setpoint-mock-plc")]
#[command(about = "Mock Modbus TCP server with chaos mode for Setpoint testing")]
#[command(version)]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0")]
    bind: String,

    #[arg(short, long, default_value = "5502")]
    port: u16,

    /// Comma-separated list of `address:value` register pairs to expose.
    /// Example: `--registers 4001:2500,4002:1200`
    #[arg(short, long, default_value = "4001:2500,4002:1200", value_parser = parse_register_pair, value_delimiter = ',')]
    registers: Vec<(u16, u16)>,

    /// Enable chaos mode (random drift on a random register)
    #[arg(long)]
    chaos: bool,

    /// Chaos drift interval in seconds
    #[arg(long, default_value = "10")]
    chaos_interval: u64,

    /// Maximum drift amount (positive or negative)
    #[arg(long, default_value = "500")]
    max_drift: u16,
}

fn parse_register_pair(s: &str) -> anyhow::Result<(u16, u16)> {
    let (addr, value) = s
        .split_once(':')
        .ok_or_else(|| anyhow::anyhow!("expected `addr:value`, got `{}`", s))?;
    Ok((addr.parse()?, value.parse()?))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();

    let args = Args::parse();

    info!("╔══════════════════════════════════════╗");
    info!("║      Setpoint Mock PLC Server        ║");
    info!("╚══════════════════════════════════════╝");
    info!("");
    info!("Configuration:");
    info!("  Bind Address: {}:{}", args.bind, args.port);
    info!("  Registers:");
    for (addr, value) in &args.registers {
        info!("    @{} = {}", addr, value);
    }
    info!(
        "  Chaos Mode: {}",
        if args.chaos { "ENABLED" } else { "disabled" }
    );

    if args.chaos {
        info!("  Chaos Interval: {}s", args.chaos_interval);
        info!("  Max Drift: {}", args.max_drift);
    }

    info!("");

    let mut initial_values = HashMap::new();
    for (addr, value) in &args.registers {
        initial_values.insert(*addr, *value);
    }

    let state = Arc::new(Mutex::new(PLCState::new(initial_values)));

    // Start chaos engine if enabled
    let _chaos = if args.chaos {
        let chaos = ChaosEngine::new(ChaosConfig {
            enabled: true,
            interval_secs: args.chaos_interval,
            max_drift: args.max_drift,
        });
        chaos.spawn(state.clone());
        Some(chaos)
    } else {
        None
    };

    start_server(&args.bind, args.port, state).await
}
