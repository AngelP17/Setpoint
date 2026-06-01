use crate::k8s_client::K8sClient;
use crate::output::{print_plc_table, print_status_summary, StatusStyle};
use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::*;

#[derive(Parser)]
#[command(name = "setpointctl")]
#[command(about = "Setpoint CLI - reconcile industrial PLCs via GitOps")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    /// Kubernetes namespace
    #[arg(short, long, global = true, default_value = "default")]
    pub namespace: String,

    /// Output format
    #[arg(short, long, global = true, value_enum, default_value = "table")]
    pub output: OutputFormat,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Get status of all managed PLCs
    GetStatus {
        /// Filter by PLC name
        #[arg(short, long)]
        name: Option<String>,
    },

    /// Get detailed information about a specific PLC
    Describe {
        /// Name of the PLC resource
        name: String,
    },

    /// Manually trigger a sync (reconciliation)
    Sync {
        /// Name of the PLC resource
        name: String,

        /// Force sync even if in sync
        #[arg(long)]
        force: bool,
    },

    /// Preview reconciliation dry-run plan
    Plan {
        /// Path to the local YAML manifest file
        #[arg(short, long)]
        file: String,
    },

    /// Watch PLC status in real-time
    Watch {
        /// Refresh interval in seconds
        #[arg(short, long, default_value = "2")]
        interval: u64,
    },

    /// List all managed PLCs
    List,

    /// Show version information
    Version,
}

#[derive(Clone, Copy, Debug, clap::ValueEnum)]
pub enum OutputFormat {
    Table,
    Json,
    Yaml,
}

/// Execute the get-status command
pub async fn cmd_get_status(
    client: &K8sClient,
    namespace: &str,
    name_filter: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    let plcs: Vec<operator::crd::IndustrialPLC> = client.list_plcs(namespace).await?;

    let filtered: Vec<_> = if let Some(name) = name_filter {
        plcs.into_iter()
            .filter(|p: &operator::crd::IndustrialPLC| {
                p.metadata
                    .name
                    .as_ref()
                    .map(|n| n.contains(name))
                    .unwrap_or(false)
            })
            .collect()
    } else {
        plcs
    };

    match format {
        OutputFormat::Table => print_plc_table(&filtered),
        OutputFormat::Json => println!("{}", serde_json::to_string_pretty(&filtered)?),
        OutputFormat::Yaml => println!("{}", serde_yaml::to_string(&filtered)?),
    }

    Ok(())
}

/// Execute the describe command
pub async fn cmd_describe(client: &K8sClient, namespace: &str, name: &str) -> Result<()> {
    let plc = client.get_plc(namespace, name).await?;

    println!(
        "{}",
        "╔════════════════════════════════════════════════════════════╗".bright_blue()
    );
    println!(
        "{}",
        "║              Industrial PLC Resource Details               ║".bright_blue()
    );
    println!(
        "{}",
        "╚════════════════════════════════════════════════════════════╝".bright_blue()
    );
    println!();

    // Metadata
    println!("{}", "📋 Metadata:".bold().underline());
    println!(
        "  Name:        {}",
        plc.metadata.name.as_deref().unwrap_or("N/A").cyan()
    );
    println!(
        "  Namespace:   {}",
        plc.metadata.namespace.as_deref().unwrap_or("N/A")
    );
    println!(
        "  Created:     {}",
        plc.metadata
            .creation_timestamp
            .as_ref()
            .map(|t| t.0.to_string())
            .unwrap_or_default()
    );
    println!();

    // Spec
    println!("{}", "⚙  Specification:".bold().underline());
    println!("  Device Address:  {}", plc.spec.device_address.cyan());
    println!("  Port:            {}", plc.spec.port);
    println!("  Registers:       {}", plc.spec.registers.len());
    for r in &plc.spec.registers {
        println!(
            "    - {} @{} desired={} strategy={:?} poll={}s cooldown={}s max/h={}",
            r.name.cyan(),
            r.address,
            r.desired_value.to_string().green(),
            r.remediation.strategy,
            r.remediation.poll_interval_secs,
            r.remediation.cooldown_secs,
            r.remediation.max_corrections_per_hour,
        );
    }
    if !plc.spec.tags.is_empty() {
        println!("  Tags:            {}", plc.spec.tags.join(", "));
    }
    println!();

    // Status
    if let Some(status) = plc.status {
        let any_drift = status.registers.iter().any(|r| !r.in_sync);
        let style = if !any_drift {
            StatusStyle::Success
        } else if matches!(status.phase, operator::crd::PLCPhase::DriftDetected) {
            StatusStyle::Warning
        } else {
            StatusStyle::Error
        };

        print_status_summary(&status, style);
    } else {
        println!("{}", "⚠  No status available".yellow());
    }

    Ok(())
}

/// Execute the sync command
pub async fn cmd_sync(client: &K8sClient, namespace: &str, name: &str, force: bool) -> Result<()> {
    use indicatif::{ProgressBar, ProgressStyle};

    println!("{}", "🔄 Triggering manual sync...".cyan());

    let spinner = ProgressBar::new_spinner();
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap(),
    );
    spinner.set_message("Annotating resource...");

    client.trigger_reconcile(namespace, name, force).await?;

    spinner.finish_with_message(format!("{}", "✓ Sync triggered successfully!".green()));

    // Show updated status
    println!();
    println!("{}", "Fetching updated status...".dimmed());
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    cmd_describe(client, namespace, name).await?;

    Ok(())
}

/// Execute the watch command
pub async fn cmd_watch(client: &K8sClient, namespace: &str, interval_secs: u64) -> Result<()> {
    use std::io::stdout;

    println!("{}", "👁️  Watching PLC status (Ctrl+C to exit)...".cyan());
    println!();

    let mut stdout = stdout();

    loop {
        // Clear screen using ANSI escape codes
        print!("\x1B[2J\x1B[1;1H");

        // Print header
        println!(
            "{}",
            "╔════════════════════════════════════════════════════════════╗".bright_blue()
        );
        println!(
            "{}",
            "║            Setpoint Live Dashboard (setpointctl watch)     ║".bright_blue()
        );
        println!(
            "{}",
            "╚════════════════════════════════════════════════════════════╝".bright_blue()
        );
        println!(
            "  Namespace: {} | Refresh: {}s | Press Ctrl+C to exit",
            namespace.cyan(),
            interval_secs
        );
        println!();

        // Fetch and display
        match client.list_plcs(namespace).await {
            Ok(plcs) => print_plc_table(&plcs),
            Err(e) => println!("{} {}", "Error:".red().bold(), e),
        }

        println!();
        println!(
            "{}",
            format!(
                "Last updated: {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
            )
            .dimmed()
        );

        // Flush stdout
        use std::io::Write;
        stdout.flush()?;

        tokio::time::sleep(tokio::time::Duration::from_secs(interval_secs)).await;
    }
}

/// Execute the list command
pub async fn cmd_list(client: &K8sClient, namespace: &str) -> Result<()> {
    let plcs = client.list_plcs(namespace).await?;

    println!("{}", "Managed Industrial PLCs".bold().underline());
    println!();

    for plc in plcs {
        let name = plc.metadata.name.as_deref().unwrap_or("unknown");
        let all_synced = plc
            .status
            .as_ref()
            .map(|s| !s.registers.is_empty() && s.registers.iter().all(|r| r.in_sync))
            .unwrap_or(false);
        let status_icon = if all_synced {
            "✓".green()
        } else {
            "✗".red()
        };

        println!(
            "{} {} @ {}:{} ({} registers)",
            status_icon,
            name.cyan(),
            plc.spec.device_address,
            plc.spec.port,
            plc.spec.registers.len()
        );
    }

    Ok(())
}

/// Execute the version command
pub async fn cmd_version() -> Result<()> {
    println!(
        "{}",
        r#"
    ███████╗███████ ████████ ██████  ██████  ██ ███    ██ ████████
    ██      ██         ██    ██   ██ ██   ██ ██ ████   ██    ██
    ███████ █████      ██    ██████  ██████  ██ ██ ██  ██    ██
         ██ ██         ██    ██      ██   ██ ██ ██  ██ ██    ██
    ███████ ███████    ██    ██      ██   ██ ██ ██   ████    ██
    "#
        .bright_cyan()
    );

    println!("Version: {}", env!("CARGO_PKG_VERSION").green());
    println!("Description: Setpoint CLI - reconcile industrial PLCs via GitOps");
    println!("Repository: https://github.com/apinzon/setpoint-operator");
    println!();
    println!("Stack:");
    println!("  - Rust 2021 Edition");
    println!("  - kube-rs (Kubernetes client)");
    println!("  - clap (CLI framework)");
    println!("  - tokio (Async runtime)");

    Ok(())
}

/// Execute the plan command (pre-flight dry-run reconciliation)
pub async fn cmd_plan(file_path: &str) -> Result<i32> {
    use std::fs::File;
    use operator::plc_client::build_adapter;
    use operator::crd::{IndustrialPLC, RemediationStrategy};
    use anyhow::Context;

    println!("{} Loading local manifest from {}...", "🔍".cyan(), file_path.bold());
    let f = File::open(file_path).with_context(|| format!("Failed to open manifest file: {}", file_path))?;
    let plc: IndustrialPLC = serde_yaml::from_reader(f).with_context(|| "Failed to parse YAML manifest as IndustrialPLC")?;

    println!(
        "{} Target PLC: {} @ {}:{}",
        "🔌".cyan(),
        plc.metadata.name.as_deref().unwrap_or("unnamed").bold(),
        plc.spec.device_address,
        plc.spec.port
    );

    let plc_client = build_adapter(&plc.spec.protocol, plc.spec.device_address.clone(), plc.spec.port);
    
    println!("{}", "Checking connectivity...".dimmed());
    match plc_client.health_check().await {
        Ok(true) => {
            println!("{} PLC is reachable. Reading registers...", "✓".green());
        }
        Ok(false) | Err(_) => {
            println!("{} PLC is unreachable. Cannot perform plan dry-run.", "✗".red());
            anyhow::bail!("PLC at {}:{} is unreachable", plc.spec.device_address, plc.spec.port);
        }
    }

    println!();
    println!("{}", "📋 Pre-Flight SCADA Reconciliation Plan:".bold().underline());
    println!();

    let mut has_drift = false;

    for r in &plc.spec.registers {
        match plc_client.read_register(r.address).await {
            Ok(live_val) => {
                if live_val == r.desired_value {
                    println!(
                        "  {} {} @{}: live={}, desired={} (In Sync)",
                        "✓".green(),
                        r.name.cyan(),
                        r.address,
                        live_val,
                        r.desired_value
                    );
                } else {
                    has_drift = true;
                    match r.remediation.strategy {
                        RemediationStrategy::Auto => {
                            println!(
                                "  {} {} @{}: live={}, desired={} [Auto-correct]",
                                "+".green().bold(),
                                r.name.cyan(),
                                r.address,
                                live_val.to_string().yellow(),
                                r.desired_value.to_string().green()
                            );
                        }
                        RemediationStrategy::Alert => {
                            println!(
                                "  {} {} @{}: live={}, desired={} [Alert-only]",
                                "~".yellow().bold(),
                                r.name.cyan(),
                                r.address,
                                live_val.to_string().yellow(),
                                r.desired_value.to_string().green()
                            );
                        }
                        RemediationStrategy::Halt => {
                            println!(
                                "  {} {} @{}: live={}, desired={} [HALT]",
                                "!".red().bold(),
                                r.name.cyan(),
                                r.address,
                                live_val.to_string().yellow(),
                                r.desired_value.to_string().green()
                            );
                        }
                    }
                }
            }
            Err(e) => {
                println!(
                    "  {} {} @{}: failed to read register: {}",
                    "✗".red(),
                    r.name.cyan(),
                    r.address,
                    e
                );
                anyhow::bail!("Failed to read register {} @ {}", r.name, r.address);
            }
        }
    }

    println!();
    if has_drift {
        println!("{}", "⚠️  Drift detected! Reconciliation is required.".yellow().bold());
        Ok(2)
    } else {
        println!("{}", "✓ All registers in sync. No actions required.".green().bold());
        Ok(0)
    }
}

