use operator::crd::RemediationStrategy;
use operator::policy::{PolicyContext, PolicyDecision, PolicyEngine};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationRequest {
    pub strategy: String,
    pub desired_value: u16,
    pub current_value: u16,
    pub cooldown_secs: u64,
    pub max_corrections_per_hour: u32,
    pub corrections_last_hour: u32,
    pub last_correction_elapsed_secs: Option<u64>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResponse {
    pub verdict: String,
    pub action: String,
    pub reason: String,
    pub risk: String,
    pub strategy: String,
    pub decision: String,
}

pub fn parse_strategy(input: &str) -> RemediationStrategy {
    match input {
        "Halt" => RemediationStrategy::Halt,
        "Alert" => RemediationStrategy::Alert,
        _ => RemediationStrategy::Auto,
    }
}

pub fn build_context(req: &SimulationRequest) -> PolicyContext {
    let last_correction_at = req
        .last_correction_elapsed_secs
        .map(|s| chrono::Utc::now() - chrono::Duration::seconds(s as i64));

    PolicyContext {
        plc_name: "simulated-plc".to_string(),
        register_name: "simulated-register".to_string(),
        desired_value: req.desired_value,
        current_value: req.current_value,
        strategy: parse_strategy(&req.strategy),
        last_correction_at,
        corrections_last_hour: req.corrections_last_hour,
        max_corrections_per_hour: req.max_corrections_per_hour,
        cooldown_secs: req.cooldown_secs,
    }
}

pub fn map_decision(req: &SimulationRequest, decision: PolicyDecision) -> SimulationResponse {
    let strategy = req.strategy.clone();
    let (verdict, action, reason, risk, decision_label) = match decision {
        PolicyDecision::NoOp { reason } => (
            "In Sync".to_string(),
            "None".to_string(),
            reason,
            "Low".to_string(),
            "noop",
        ),
        PolicyDecision::DetectOnly { reason } => (
            "Drift Detected".to_string(),
            "Emit Warning event, increment drift metrics, do not write".to_string(),
            reason,
            "Medium".to_string(),
            "detectOnly",
        ),
        PolicyDecision::Halt { reason } => (
            "System Halt".to_string(),
            "Mark IndustrialPLC Failed, halt operational line".to_string(),
            reason,
            "High / Critical".to_string(),
            "halt",
        ),
        PolicyDecision::Skip { reason } => (
            "Reconciliation Skipped".to_string(),
            "Hold write back, drift remains; rate-limit or cooldown active".to_string(),
            reason,
            "High".to_string(),
            "skip",
        ),
        PolicyDecision::Correct {
            desired_value,
            reason,
        } => (
            "Reconciliation Triggered".to_string(),
            format!("Write desired value {desired_value} back to register"),
            reason,
            "Low (Safe Auto-correction)".to_string(),
            "correct",
        ),
    };

    SimulationResponse {
        verdict,
        action,
        reason,
        risk,
        strategy,
        decision: decision_label.to_string(),
    }
}

pub fn evaluate(req: &SimulationRequest) -> SimulationResponse {
    let ctx = build_context(req);
    let decision = PolicyEngine::evaluate(&ctx);
    map_decision(req, decision)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(strategy: &str, desired: u16, current: u16) -> SimulationRequest {
        SimulationRequest {
            strategy: strategy.to_string(),
            desired_value: desired,
            current_value: current,
            cooldown_secs: 30,
            max_corrections_per_hour: 5,
            corrections_last_hour: 0,
            last_correction_elapsed_secs: None,
        }
    }

    #[test]
    fn parse_strategy_defaults_unknown_to_auto() {
        assert_eq!(parse_strategy("Halt"), RemediationStrategy::Halt);
        assert_eq!(parse_strategy("Alert"), RemediationStrategy::Alert);
        assert_eq!(parse_strategy("Auto"), RemediationStrategy::Auto);
        assert_eq!(parse_strategy(""), RemediationStrategy::Auto);
        assert_eq!(parse_strategy("something"), RemediationStrategy::Auto);
    }

    #[test]
    fn evaluates_in_sync_to_noop() {
        let r = req("Auto", 1200, 1200);
        let out = evaluate(&r);
        assert_eq!(out.decision, "noop");
        assert_eq!(out.verdict, "In Sync");
        assert_eq!(out.strategy, "Auto");
    }

    #[test]
    fn halt_strategy_maps_to_halt_decision() {
        let r = req("Halt", 100, 200);
        let out = evaluate(&r);
        assert_eq!(out.decision, "halt");
        assert!(out.risk.contains("Critical"));
    }

    #[test]
    fn alert_strategy_maps_to_detect_only_even_with_drift() {
        let r = req("Alert", 100, 9999);
        let out = evaluate(&r);
        assert_eq!(out.decision, "detectOnly");
        assert_eq!(out.verdict, "Drift Detected");
    }

    #[test]
    fn auto_strategy_emits_correct() {
        let r = req("Auto", 100, 250);
        let out = evaluate(&r);
        assert_eq!(out.decision, "correct");
        assert!(out.action.contains("100"));
    }

    #[test]
    fn auto_strategy_respects_cooldown() {
        let mut r = req("Auto", 100, 250);
        r.last_correction_elapsed_secs = Some(5);
        r.cooldown_secs = 30;
        let out = evaluate(&r);
        assert_eq!(out.decision, "skip");
        assert!(out.reason.to_lowercase().contains("cooldown"));
    }

    #[test]
    fn auto_strategy_respects_hourly_rate_limit() {
        let mut r = req("Auto", 100, 250);
        r.last_correction_elapsed_secs = Some(120);
        r.cooldown_secs = 30;
        r.corrections_last_hour = 5;
        r.max_corrections_per_hour = 5;
        let out = evaluate(&r);
        assert_eq!(out.decision, "skip");
        assert!(out.reason.to_lowercase().contains("max"));
    }
}
