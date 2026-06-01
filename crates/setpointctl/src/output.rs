use colored::*;
use comfy_table::{modifiers::UTF8_ROUND_CORNERS, presets::UTF8_FULL, Cell, Color, Table};
use operator::crd::{IndustrialPLC, PLCPhase, RemediationStrategy};

#[allow(dead_code)]
pub enum StatusStyle {
    Success,
    Warning,
    Error,
    Neutral,
}

/// Print a table of all IndustrialPLC resources, one row per register.
pub fn print_plc_table(plcs: &[IndustrialPLC]) {
    if plcs.is_empty() {
        println!("{}", "⚠  No IndustrialPLC resources found".yellow());
        return;
    }

    let mut table = Table::new();
    table
        .load_preset(UTF8_FULL)
        .apply_modifier(UTF8_ROUND_CORNERS)
        .set_header(vec![
            Cell::new("PLC").fg(Color::Cyan),
            Cell::new("Device").fg(Color::Cyan),
            Cell::new("Register").fg(Color::Cyan),
            Cell::new("Addr").fg(Color::Cyan),
            Cell::new("Desired").fg(Color::Cyan),
            Cell::new("Actual").fg(Color::Cyan),
            Cell::new("Status").fg(Color::Cyan),
            Cell::new("Strategy").fg(Color::Cyan),
            Cell::new("Drifts").fg(Color::Cyan),
            Cell::new("Fixes").fg(Color::Cyan),
        ]);

    for plc in plcs {
        let name = plc.metadata.name.as_deref().unwrap_or("unknown");
        let device = format!("{}:{}", plc.spec.device_address, plc.spec.port);

        for reg in &plc.spec.registers {
            let desired = reg.desired_value.to_string();
            let (actual, status, drifts, fixes) = plc
                .status
                .as_ref()
                .and_then(|s| s.register(&reg.name))
                .map(|rs| {
                    let actual_str = rs
                        .current_value
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "-".to_string());
                    let status_str = if rs.in_sync {
                        "SYNCED".to_string()
                    } else {
                        "DRIFT".to_string()
                    };
                    (
                        actual_str,
                        status_str,
                        rs.drift_events.to_string(),
                        rs.corrections_applied.to_string(),
                    )
                })
                .unwrap_or_else(|| {
                    (
                        "-".to_string(),
                        "PENDING".to_string(),
                        "0".to_string(),
                        "0".to_string(),
                    )
                });

            let status_cell = match status.as_str() {
                "SYNCED" => Cell::new(status).fg(Color::Green),
                "DRIFT" => Cell::new(status).fg(Color::Yellow),
                _ => Cell::new(status).fg(Color::Grey),
            };

            let strategy_str = format!("{:?}", reg.remediation.strategy);
            let strategy_cell = match reg.remediation.strategy {
                RemediationStrategy::Auto => Cell::new(strategy_str).fg(Color::Green),
                RemediationStrategy::Alert => Cell::new(strategy_str).fg(Color::Yellow),
                RemediationStrategy::Halt => Cell::new(strategy_str).fg(Color::Red),
            };

            table.add_row(vec![
                Cell::new(name),
                Cell::new(device.clone()),
                Cell::new(&reg.name),
                Cell::new(reg.address.to_string()),
                Cell::new(desired).fg(Color::Green),
                Cell::new(actual),
                status_cell,
                strategy_cell,
                Cell::new(drifts),
                Cell::new(fixes),
            ]);
        }
    }

    println!("{}", table);
}

/// Print a status summary box for a single PLC.
pub fn print_status_summary(status: &operator::crd::IndustrialPLCStatus, style: StatusStyle) {
    let border_color = match style {
        StatusStyle::Success => Color::Green,
        StatusStyle::Warning => Color::Yellow,
        StatusStyle::Error => Color::Red,
        StatusStyle::Neutral => Color::Grey,
    };

    let status_icon = match style {
        StatusStyle::Success => "✓",
        StatusStyle::Warning => "⚠",
        StatusStyle::Error => "✗",
        StatusStyle::Neutral => "○",
    };

    let mut table = Table::new();
    table
        .load_preset(UTF8_FULL)
        .apply_modifier(UTF8_ROUND_CORNERS);

    table.set_header(vec![
        Cell::new(format!("{} Status Summary", status_icon)).fg(border_color)
    ]);

    table.add_row(vec![
        Cell::new("Phase:"),
        Cell::new(format!("{:?}", status.phase)).fg(border_color),
    ]);

    let any_drift = status.registers.iter().any(|r| !r.in_sync);
    let all_synced = !status.registers.is_empty() && status.registers.iter().all(|r| r.in_sync);

    table.add_row(vec![
        Cell::new("In Sync:"),
        Cell::new(if all_synced { "Yes ✓" } else { "No ✗" }).fg(if all_synced {
            Color::Green
        } else {
            Color::Red
        }),
    ]);

    let total_drifts: u32 = status.registers.iter().map(|r| r.drift_events).sum();
    let total_corrections: u32 = status.registers.iter().map(|r| r.corrections_applied).sum();

    table.add_row(vec![
        Cell::new("Drift Events (total):"),
        Cell::new(total_drifts.to_string()).fg(if any_drift {
            Color::Yellow
        } else {
            Color::Green
        }),
    ]);

    table.add_row(vec![
        Cell::new("Corrections (total):"),
        Cell::new(total_corrections.to_string()).fg(Color::Green),
    ]);

    if let Some(ref error) = status.last_error {
        table.add_row(vec![
            Cell::new("Last Error:"),
            Cell::new(error).fg(Color::Red),
        ]);
    }

    table.add_row(vec![Cell::new("Message:"), Cell::new(&status.message)]);

    if let Some(ref updated) = status.last_update {
        table.add_row(vec![
            Cell::new("Last Update:"),
            Cell::new(updated).fg(Color::Grey),
        ]);
    }

    // Per-register breakdown
    if !status.registers.is_empty() {
        table.add_row(vec![Cell::new("")]);
        table.add_row(vec![Cell::new("Registers:").fg(Color::Cyan)]);
        for r in &status.registers {
            let emoji = if r.in_sync { "✓" } else { "✗" };
            let strategy = format!("{:?}", r.strategy);
            table.add_row(vec![
                Cell::new(format!("  {} {}", emoji, r.name)),
                Cell::new(format!(
                    "addr={} current={:?} drifts={} fixes={} strategy={}",
                    r.address,
                    r.current_value
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "-".into()),
                    r.drift_events,
                    r.corrections_applied,
                    strategy,
                )),
            ]);
        }
    }

    println!("{}", table);
}

/// Print a simple status line per PLC.
#[allow(dead_code)]
pub fn print_status_line(plc: &IndustrialPLC) {
    let name = plc.metadata.name.as_deref().unwrap_or("unknown");

    if let Some(ref status) = plc.status {
        let all_synced = !status.registers.is_empty() && status.registers.iter().all(|r| r.in_sync);
        let emoji = if all_synced { "✓" } else { "✗" };
        let label = if all_synced { "SYNCED" } else { "DRIFT" };
        let color = if all_synced { "green" } else { "red" };
        println!(
            "{} {}: {} (phase: {:?}, registers: {})",
            emoji,
            name,
            label.color(color),
            status.phase,
            status.registers.len()
        );
    } else {
        println!("○ {}: {}", name, "PENDING".dimmed());
    }
}

/// Re-export the unused PLCPhase enum usage (suppresses dead-code on the import)
#[allow(dead_code)]
fn _ensure_plcphase_used(_p: PLCPhase) {}
