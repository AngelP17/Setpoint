use crate::crd::RemediationStrategy;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PolicyDecision {
    NoOp { reason: String },
    DetectOnly { reason: String },
    Correct { desired_value: u16, reason: String },
    Halt { reason: String },
    Skip { reason: String },
}

#[derive(Clone, Debug)]
pub struct PolicyContext {
    #[allow(dead_code)]
    pub plc_name: String,
    pub register_name: String,
    pub desired_value: u16,
    pub current_value: u16,
    pub strategy: RemediationStrategy,
    pub last_correction_at: Option<DateTime<Utc>>,
    pub corrections_last_hour: u32,
    pub max_corrections_per_hour: u32,
    pub cooldown_secs: u64,
}

pub struct PolicyEngine;

impl PolicyEngine {
    pub fn evaluate(ctx: &PolicyContext) -> PolicyDecision {
        if ctx.current_value == ctx.desired_value {
            return PolicyDecision::NoOp {
                reason: format!(
                    "Register '{}' is in sync at {}",
                    ctx.register_name, ctx.desired_value
                ),
            };
        }

        match ctx.strategy {
            RemediationStrategy::Halt => PolicyDecision::Halt {
                reason: format!(
                    "Halt: register '{}' drifted to {} (desired {})",
                    ctx.register_name, ctx.current_value, ctx.desired_value
                ),
            },
            RemediationStrategy::Alert => PolicyDecision::DetectOnly {
                reason: format!(
                    "Alert: drift detected on register '{}' (desired {}, actual {})",
                    ctx.register_name, ctx.desired_value, ctx.current_value
                ),
            },
            RemediationStrategy::Auto => {
                // 1. Cooldown check
                if let Some(last_ts) = ctx.last_correction_at {
                    let elapsed = (Utc::now() - last_ts).num_seconds();
                    if elapsed < ctx.cooldown_secs as i64 {
                        return PolicyDecision::Skip {
                            reason: format!(
                                "Cooldown active ({}s < {}s), skipping correction",
                                elapsed, ctx.cooldown_secs
                            ),
                        };
                    }
                }

                // 2. Max corrections per hour check
                if ctx.max_corrections_per_hour > 0
                    && ctx.corrections_last_hour >= ctx.max_corrections_per_hour
                {
                    return PolicyDecision::Skip {
                        reason: format!(
                            "Max corrections per hour ({}) reached, skipping",
                            ctx.max_corrections_per_hour
                        ),
                    };
                }

                PolicyDecision::Correct {
                    desired_value: ctx.desired_value,
                    reason: format!(
                        "Auto: drift detected on register '{}' (actual {}, desired {}). Correcting.",
                        ctx.register_name, ctx.current_value, ctx.desired_value
                    ),
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_noop_when_in_sync() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 100,
            strategy: RemediationStrategy::Auto,
            last_correction_at: None,
            corrections_last_hour: 0,
            max_corrections_per_hour: 5,
            cooldown_secs: 10,
        };

        assert!(matches!(
            PolicyEngine::evaluate(&ctx),
            PolicyDecision::NoOp { .. }
        ));
    }

    #[test]
    fn test_halt_on_drift() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 120,
            strategy: RemediationStrategy::Halt,
            last_correction_at: None,
            corrections_last_hour: 0,
            max_corrections_per_hour: 5,
            cooldown_secs: 10,
        };

        assert!(matches!(
            PolicyEngine::evaluate(&ctx),
            PolicyDecision::Halt { .. }
        ));
    }

    #[test]
    fn test_detect_only_on_alert_strategy() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 120,
            strategy: RemediationStrategy::Alert,
            last_correction_at: None,
            corrections_last_hour: 0,
            max_corrections_per_hour: 5,
            cooldown_secs: 10,
        };

        assert!(matches!(
            PolicyEngine::evaluate(&ctx),
            PolicyDecision::DetectOnly { .. }
        ));
    }

    #[test]
    fn test_corrects_on_auto_strategy() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 120,
            strategy: RemediationStrategy::Auto,
            last_correction_at: None,
            corrections_last_hour: 0,
            max_corrections_per_hour: 5,
            cooldown_secs: 10,
        };

        let dec = PolicyEngine::evaluate(&ctx);
        if let PolicyDecision::Correct { desired_value, .. } = dec {
            assert_eq!(desired_value, 100);
        } else {
            panic!("Expected Correct decision");
        }
    }

    #[test]
    fn test_skips_during_cooldown() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 120,
            strategy: RemediationStrategy::Auto,
            last_correction_at: Some(Utc::now() - Duration::seconds(5)),
            corrections_last_hour: 0,
            max_corrections_per_hour: 5,
            cooldown_secs: 30,
        };

        assert!(matches!(
            PolicyEngine::evaluate(&ctx),
            PolicyDecision::Skip { .. }
        ));
    }

    #[test]
    fn test_skips_when_rate_limit_exceeded() {
        let ctx = PolicyContext {
            plc_name: "test-plc".into(),
            register_name: "reg1".into(),
            desired_value: 100,
            current_value: 120,
            strategy: RemediationStrategy::Auto,
            last_correction_at: Some(Utc::now() - Duration::seconds(60)),
            corrections_last_hour: 5,
            max_corrections_per_hour: 5,
            cooldown_secs: 30,
        };

        assert!(matches!(
            PolicyEngine::evaluate(&ctx),
            PolicyDecision::Skip { .. }
        ));
    }
}
