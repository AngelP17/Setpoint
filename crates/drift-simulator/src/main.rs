use clap::Parser;
use std::net::SocketAddr;
use std::time::Duration;
use tokio::time::{interval, Instant};
use tokio_modbus::prelude::*;
use tracing::{error, info, warn, Level};

#[derive(Parser, Debug)]
#[command(name = "setpoint-drift-simulator")]
#[command(
    about = "Injects deterministic register drift into a Modbus TCP device. Used by the Setpoint flagship proof run to exercise the operator's remediation policies."
)]
#[command(version)]
struct Args {
    /// Target host:port (e.g. setpoint-mock-plc:5502)
    #[arg(short, long, default_value = "127.0.0.1:5502")]
    target: String,

    /// Modbus register address to overwrite
    #[arg(short, long, default_value_t = 4002)]
    register: u16,

    /// Value to write on each tick
    #[arg(short, long, default_value_t = 9999)]
    value: u16,

    /// Seconds between writes
    #[arg(short, long, default_value_t = 5)]
    interval: u64,

    /// Stop after N writes (0 = forever)
    #[arg(long, default_value_t = 0)]
    max_writes: u64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .with_target(false)
        .compact()
        .init();

    let args = Args::parse();

    info!("╔══════════════════════════════════════╗");
    info!("║   Setpoint Drift Simulator           ║");
    info!("╚══════════════════════════════════════╝");
    info!("");
    info!("Target:    {}", args.target);
    info!("Register:  @{}", args.register);
    info!("Value:     {}", args.value);
    info!("Interval:  {}s", args.interval);
    if args.max_writes > 0 {
        info!("Max writes: {}", args.max_writes);
    } else {
        info!("Max writes: unlimited (Ctrl+C to stop)");
    }
    info!("");

    let mut ticker = interval(Duration::from_secs(args.interval));
    let started = Instant::now();
    let mut count: u64 = 0;

    loop {
        ticker.tick().await;

        match write_register(&args.target, args.register, args.value).await {
            Ok(()) => {
                count += 1;
                let elapsed = started.elapsed().as_secs();
                warn!(
                    "[t={}s, n={}] DRIFT INJECTED: wrote {} to @{} on {}",
                    elapsed, count, args.value, args.register, args.target
                );
            }
            Err(e) => {
                error!("Drift write failed: {}", e);
            }
        }

        if args.max_writes > 0 && count >= args.max_writes {
            info!("Reached max_writes={}, stopping", args.max_writes);
            break;
        }
    }

    Ok(())
}

async fn write_register(target: &str, register: u16, value: u16) -> anyhow::Result<()> {
    let addr: SocketAddr = target
        .parse()
        .map_err(|e| anyhow::anyhow!("invalid target `{}`: {}", target, e))?;
    let mut ctx = tcp::connect(addr).await?;
    ctx.write_single_register(register, value).await?;
    ctx.disconnect().await.ok();
    Ok(())
}
