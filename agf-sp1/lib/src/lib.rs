//! AGF Shared Library — Types and logic shared between guest (zkVM) and host (orchestrator).
//!
//! This crate defines the core compliance rule types that are used by both the SP1 guest program
//! (which runs inside the zkVM) and the host script (which orchestrates proving).
//!
//! Reference: AGF OpenSpec v2.0 — Phase 1 (Weeks 1–3)

use serde::{Deserialize, Serialize};

// ARSL parser — only available on host side (not inside zkVM)
#[cfg(not(target_os = "zkvm"))]
pub mod arsl;

// ---------------------------------------------------------------------------
// Core Types — Compliance Rule Evaluation
// ---------------------------------------------------------------------------

/// The type of compliance check to perform.
///
/// This is the core extensibility point: new condition types are added here
/// and handled in `evaluate_rule`. All types must be deterministic.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConditionKind {
    /// Value must be >= minimum_threshold (e.g., capital ratio >= 8%)
    Minimum,
    /// Value must be <= maximum_threshold (e.g., exposure <= 25%)
    Maximum,
    /// Value must be within [minimum_threshold, maximum_threshold]
    Range,
    /// Value must exactly equal minimum_threshold
    Equals,
    /// Value must not equal minimum_threshold
    NotEquals,
    /// Value (as an index) must appear in the allowed_set (PASS if member)
    MemberOf,
    /// Value (as an index) must NOT appear in the blocked_set (PASS if not member)
    NotMemberOf,
    /// Boolean gate: value == 1 means PASS, value == 0 means BLOCK
    BooleanTrue,
}

/// A compliance rule input containing the data to be evaluated.
///
/// The `condition_kind` field determines which thresholds are used:
///   - Minimum/Maximum/Range/Equals/NotEquals: use `minimum_threshold` / `maximum_threshold`
///   - MemberOf/NotMemberOf: `actual_value` is treated as a set hash index;
///     `allowed_set` / `blocked_set` contain the hashed members.
///   - BooleanTrue: `actual_value` == 1 → PASS, 0 → BLOCK.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceInput {
    /// Unique identifier for this compliance check (e.g., rule index)
    pub rule_id: u32,
    /// The actual value being checked
    pub actual_value: u64,
    /// The regulatory minimum threshold (used by Minimum, Range, Equals)
    pub minimum_threshold: u64,
    /// The regulatory maximum threshold (used by Maximum, Range; 0 = no maximum)
    pub maximum_threshold: u64,
    /// Timestamp of the check (unix epoch seconds)
    pub timestamp: u64,
    /// Entity identifier (e.g., bank ID)
    pub entity_id: u32,
    /// The condition kind — determines evaluation logic
    pub condition_kind: ConditionKind,
    /// For MemberOf: hashed values that are ALLOWED (match = PASS)
    /// For NotMemberOf: hashed values that are BLOCKED (match = BLOCK)
    /// Empty for all other condition kinds.
    pub set_members: Vec<u64>,
}

/// The result of a compliance rule evaluation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComplianceResult {
    /// The rule that was evaluated
    pub rule_id: u32,
    /// Whether the entity is compliant (PASS = true, BLOCK = false)
    pub compliant: bool,
    /// The actual value that was checked
    pub actual_value: u64,
    /// The threshold it was checked against (0 for set/boolean checks)
    pub threshold_used: u64,
    /// Margin: how far above/below the threshold (signed, in basis points)
    /// Positive = above minimum, Negative = below minimum.
    /// 0 for set-membership and boolean checks.
    pub margin_bps: i64,
    /// Timestamp of the evaluation
    pub timestamp: u64,
    /// Entity that was evaluated
    pub entity_id: u32,
}

/// A batch of compliance rules to evaluate in a single proof.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceBatch {
    /// The rules to evaluate
    pub rules: Vec<ComplianceInput>,
}

/// The batch result containing all evaluations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceBatchResult {
    /// Individual rule results
    pub results: Vec<ComplianceResult>,
    /// Total rules evaluated
    pub total_rules: u32,
    /// Number of compliant rules (PASS)
    pub pass_count: u32,
    /// Number of non-compliant rules (BLOCK)
    pub block_count: u32,
    /// Whether the entire batch is compliant (all rules pass)
    pub all_compliant: bool,
}

// ---------------------------------------------------------------------------
// Core Logic — Deterministic Rule Evaluation
// ---------------------------------------------------------------------------

/// Evaluate a single compliance rule deterministically.
///
/// This is the core logic that runs INSIDE the SP1 zkVM. It must be:
/// - Deterministic (same input → same output, always)
/// - Side-effect free (no I/O, no randomness)
/// - Formally verifiable (simple enough to reason about)
pub fn evaluate_rule(input: &ComplianceInput) -> ComplianceResult {
    let (compliant, threshold_used, margin_bps) = match input.condition_kind {
        // ------------------------------------------------------------------
        // Numeric threshold checks
        // ------------------------------------------------------------------
        ConditionKind::Minimum => {
            let pass = input.actual_value >= input.minimum_threshold;
            let margin = numeric_margin(input.actual_value, input.minimum_threshold);
            (pass, input.minimum_threshold, margin)
        }
        ConditionKind::Maximum => {
            let pass = input.actual_value <= input.maximum_threshold;
            let margin = if input.actual_value <= input.maximum_threshold {
                ((input.maximum_threshold - input.actual_value) * 10000
                    / input.maximum_threshold.max(1)) as i64
            } else {
                -(((input.actual_value - input.maximum_threshold) * 10000
                    / input.maximum_threshold.max(1)) as i64)
            };
            (pass, input.maximum_threshold, margin)
        }
        ConditionKind::Range => {
            let pass = input.actual_value >= input.minimum_threshold
                && input.actual_value <= input.maximum_threshold;
            let margin = numeric_margin(input.actual_value, input.minimum_threshold);
            (pass, input.minimum_threshold, margin)
        }
        ConditionKind::Equals => {
            let pass = input.actual_value == input.minimum_threshold;
            (pass, input.minimum_threshold, 0)
        }
        ConditionKind::NotEquals => {
            let pass = input.actual_value != input.minimum_threshold;
            (pass, input.minimum_threshold, 0)
        }
        // ------------------------------------------------------------------
        // Set membership checks
        // MemberOf:    actual_value must be IN the set → PASS
        // NotMemberOf: actual_value must NOT be IN the set → PASS (blocked if found)
        // ------------------------------------------------------------------
        ConditionKind::MemberOf => {
            let is_member = input.set_members.contains(&input.actual_value);
            (is_member, 0, 0)
        }
        ConditionKind::NotMemberOf => {
            let is_member = input.set_members.contains(&input.actual_value);
            // PASS when NOT a member of the blocked set
            (!is_member, 0, 0)
        }
        // ------------------------------------------------------------------
        // Boolean gate
        // actual_value == 1 → PASS, actual_value == 0 → BLOCK
        // ------------------------------------------------------------------
        ConditionKind::BooleanTrue => {
            (input.actual_value == 1, 0, 0)
        }
    };

    ComplianceResult {
        rule_id: input.rule_id,
        compliant,
        actual_value: input.actual_value,
        threshold_used,
        margin_bps,
        timestamp: input.timestamp,
        entity_id: input.entity_id,
    }
}

/// Evaluate a batch of compliance rules.
pub fn evaluate_batch(batch: &ComplianceBatch) -> ComplianceBatchResult {
    let results: Vec<ComplianceResult> = batch.rules.iter().map(|r| evaluate_rule(r)).collect();
    let pass_count = results.iter().filter(|r| r.compliant).count() as u32;
    let block_count = results.iter().filter(|r| !r.compliant).count() as u32;
    let all_compliant = block_count == 0;

    ComplianceBatchResult {
        total_rules: results.len() as u32,
        pass_count,
        block_count,
        all_compliant,
        results,
    }
}

/// Calculate signed margin in basis points relative to the minimum threshold.
fn numeric_margin(actual: u64, minimum: u64) -> i64 {
    if actual >= minimum {
        ((actual - minimum) * 10000 / minimum.max(1)) as i64
    } else {
        -(((minimum - actual) * 10000 / minimum.max(1)) as i64)
    }
}

// ---------------------------------------------------------------------------
// Test Fixtures — Sample Regulatory Rules
// ---------------------------------------------------------------------------

/// Create test fixtures representing real-world FCA/DORA compliance checks.
/// Values use basis points (1/100th of a percent) to avoid floating point.
pub fn sample_fca_rules() -> ComplianceBatch {
    ComplianceBatch {
        rules: vec![
            // FCA-CD-001: Capital Adequacy Ratio >= 8.00% (800 bps)
            ComplianceInput {
                rule_id: 1,
                actual_value: 1250, // 12.50%
                minimum_threshold: 800,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-002: Liquidity Coverage Ratio >= 100.00% (10000 bps)
            ComplianceInput {
                rule_id: 2,
                actual_value: 11500, // 115.00%
                minimum_threshold: 10000,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-003: Leverage Ratio >= 3.00% (300 bps)
            ComplianceInput {
                rule_id: 3,
                actual_value: 450, // 4.50%
                minimum_threshold: 300,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-004: Net Stable Funding Ratio >= 100.00%
            ComplianceInput {
                rule_id: 4,
                actual_value: 10800, // 108.00%
                minimum_threshold: 10000,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-005: Large Exposure Limit <= 25.00% of own funds (range check)
            ComplianceInput {
                rule_id: 5,
                actual_value: 1800, // 18.00%
                minimum_threshold: 0,
                maximum_threshold: 2500,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Range,
                set_members: vec![],
            },
            // DORA-001: ICT Incident Reporting <= 4 hours (14400 seconds)
            ComplianceInput {
                rule_id: 6,
                actual_value: 3600,
                minimum_threshold: 0,
                maximum_threshold: 14400,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Range,
                set_members: vec![],
            },
            // FCA-CD-006: Solvency ratio >= 150%
            ComplianceInput {
                rule_id: 7,
                actual_value: 17500, // 175.00%
                minimum_threshold: 15000,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-007: Tier 1 Capital ratio >= 6%
            ComplianceInput {
                rule_id: 8,
                actual_value: 950, // 9.50%
                minimum_threshold: 600,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-008: Counter-cyclical buffer >= 0%
            ComplianceInput {
                rule_id: 9,
                actual_value: 250, // 2.50%
                minimum_threshold: 0,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
            // FCA-CD-009: FAILING RULE — Stress test capital < 5.5% minimum
            ComplianceInput {
                rule_id: 10,
                actual_value: 480, // 4.80% — BELOW 5.50%
                minimum_threshold: 550,
                maximum_threshold: 0,
                timestamp: 1709769600,
                entity_id: 1001,
                condition_kind: ConditionKind::Minimum,
                set_members: vec![],
            },
        ],
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // ---- Helper: build a minimum-check input -------------------------------

    fn min_input(id: u32, actual: u64, threshold: u64) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: actual,
            minimum_threshold: threshold,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::Minimum,
            set_members: vec![],
        }
    }

    fn max_input(id: u32, actual: u64, threshold: u64) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: actual,
            minimum_threshold: 0,
            maximum_threshold: threshold,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::Maximum,
            set_members: vec![],
        }
    }

    fn range_input(id: u32, actual: u64, min: u64, max: u64) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: actual,
            minimum_threshold: min,
            maximum_threshold: max,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::Range,
            set_members: vec![],
        }
    }

    fn bool_input(id: u32, value: u64) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: value,
            minimum_threshold: 0,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::BooleanTrue,
            set_members: vec![],
        }
    }

    fn member_of_input(id: u32, value: u64, allowed: Vec<u64>) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: value,
            minimum_threshold: 0,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::MemberOf,
            set_members: allowed,
        }
    }

    fn not_member_of_input(id: u32, value: u64, blocked: Vec<u64>) -> ComplianceInput {
        ComplianceInput {
            rule_id: id,
            actual_value: value,
            minimum_threshold: 0,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::NotMemberOf,
            set_members: blocked,
        }
    }

    // ---- Minimum checks ----------------------------------------------------

    #[test]
    fn test_compliant_minimum_check() {
        let result = evaluate_rule(&min_input(1, 1250, 800));
        assert!(result.compliant);
        assert!(result.margin_bps > 0);
        assert_eq!(result.threshold_used, 800);
    }

    #[test]
    fn test_non_compliant_minimum_check() {
        let result = evaluate_rule(&min_input(10, 480, 550));
        assert!(!result.compliant);
        assert!(result.margin_bps < 0);
    }

    #[test]
    fn test_minimum_at_exact_threshold_is_compliant() {
        let result = evaluate_rule(&min_input(1, 800, 800));
        assert!(result.compliant);
        assert_eq!(result.margin_bps, 0);
    }

    #[test]
    fn test_minimum_one_below_threshold_is_blocked() {
        let result = evaluate_rule(&min_input(1, 799, 800));
        assert!(!result.compliant);
    }

    // ---- Maximum checks ----------------------------------------------------

    #[test]
    fn test_compliant_maximum_check() {
        // Large exposure: 1800 <= 2500 → PASS
        let result = evaluate_rule(&max_input(5, 1800, 2500));
        assert!(result.compliant);
        assert!(result.margin_bps > 0);
    }

    #[test]
    fn test_non_compliant_maximum_check() {
        // Large exposure: 3000 > 2500 → BLOCK
        let result = evaluate_rule(&max_input(5, 3000, 2500));
        assert!(!result.compliant);
        assert!(result.margin_bps < 0);
    }

    #[test]
    fn test_maximum_at_exact_threshold_is_compliant() {
        let result = evaluate_rule(&max_input(5, 2500, 2500));
        assert!(result.compliant);
    }

    // ---- Range checks ------------------------------------------------------

    #[test]
    fn test_range_check_pass() {
        let result = evaluate_rule(&range_input(5, 1800, 0, 2500));
        assert!(result.compliant);
    }

    #[test]
    fn test_range_check_fail_above() {
        let result = evaluate_rule(&range_input(5, 3000, 0, 2500));
        assert!(!result.compliant);
    }

    #[test]
    fn test_range_check_fail_below() {
        // ICT report time: -1 is not valid (below min of 0)
        // Using 0 as min, value must be >= 0
        let result = evaluate_rule(&range_input(6, 0, 1, 14400));
        assert!(!result.compliant);
    }

    #[test]
    fn test_range_check_at_boundaries() {
        // Exact min boundary
        let r1 = evaluate_rule(&range_input(6, 0, 0, 14400));
        assert!(r1.compliant);
        // Exact max boundary
        let r2 = evaluate_rule(&range_input(6, 14400, 0, 14400));
        assert!(r2.compliant);
        // One above max
        let r3 = evaluate_rule(&range_input(6, 14401, 0, 14400));
        assert!(!r3.compliant);
    }

    // ---- Equals / NotEquals ------------------------------------------------

    #[test]
    fn test_equals_pass() {
        let input = ComplianceInput {
            rule_id: 99,
            actual_value: 42,
            minimum_threshold: 42,
            maximum_threshold: 42,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::Equals,
            set_members: vec![],
        };
        let result = evaluate_rule(&input);
        assert!(result.compliant);
    }

    #[test]
    fn test_equals_fail() {
        let input = ComplianceInput {
            rule_id: 99,
            actual_value: 41,
            minimum_threshold: 42,
            maximum_threshold: 42,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::Equals,
            set_members: vec![],
        };
        assert!(!evaluate_rule(&input).compliant);
    }

    #[test]
    fn test_not_equals_pass() {
        let input = ComplianceInput {
            rule_id: 99,
            actual_value: 41,
            minimum_threshold: 42,
            maximum_threshold: 0,
            timestamp: 1709769600,
            entity_id: 1001,
            condition_kind: ConditionKind::NotEquals,
            set_members: vec![],
        };
        assert!(evaluate_rule(&input).compliant);
    }

    // ---- Boolean gate checks ------------------------------------------------

    #[test]
    fn test_boolean_true_pass() {
        // Consent flag = 1 → PASS
        let result = evaluate_rule(&bool_input(20, 1));
        assert!(result.compliant);
    }

    #[test]
    fn test_boolean_true_block() {
        // Consent flag = 0 → BLOCK
        let result = evaluate_rule(&bool_input(20, 0));
        assert!(!result.compliant);
    }

    #[test]
    fn test_boolean_true_nonstandard_value_blocks() {
        // Only 1 is PASS; 2, 42, etc. are BLOCK
        let result = evaluate_rule(&bool_input(20, 2));
        assert!(!result.compliant);
    }

    // ---- Set membership checks (sanctions / jurisdiction lists) ------------

    #[test]
    fn test_member_of_pass_when_in_set() {
        // KYC status hash 0xABCD is in the "verified" set → PASS
        let result = evaluate_rule(&member_of_input(30, 0xABCD, vec![0x1111, 0xABCD, 0x9999]));
        assert!(result.compliant);
    }

    #[test]
    fn test_member_of_block_when_not_in_set() {
        // Status hash 0xDEAD is not in the "verified" set → BLOCK
        let result = evaluate_rule(&member_of_input(30, 0xDEAD, vec![0x1111, 0xABCD, 0x9999]));
        assert!(!result.compliant);
    }

    #[test]
    fn test_member_of_empty_set_always_blocks() {
        let result = evaluate_rule(&member_of_input(30, 42, vec![]));
        assert!(!result.compliant);
    }

    #[test]
    fn test_not_member_of_pass_when_not_in_blocked_set() {
        // Jurisdiction hash for NL (Netherlands=99) is NOT on the HMT sanctions list → PASS
        // Blocked hashes: RU=18, KP=36, IR=72, BY=144
        let hmt_blocked: Vec<u64> = vec![18, 36, 72, 144];
        let result = evaluate_rule(&not_member_of_input(31, 99, hmt_blocked));
        assert!(result.compliant);
    }

    #[test]
    fn test_not_member_of_block_when_in_blocked_set() {
        // Jurisdiction hash for RU (Russia=18) IS on the HMT sanctions list → BLOCK
        let hmt_blocked: Vec<u64> = vec![18, 36, 72, 144];
        let result = evaluate_rule(&not_member_of_input(31, 18, hmt_blocked));
        assert!(!result.compliant);
    }

    #[test]
    fn test_not_member_of_empty_blocked_set_always_passes() {
        // Empty blocked list = no jurisdictions are sanctioned → always PASS
        let result = evaluate_rule(&not_member_of_input(31, 42, vec![]));
        assert!(result.compliant);
    }

    // ---- Batch evaluation --------------------------------------------------

    #[test]
    fn test_batch_evaluation() {
        let batch = sample_fca_rules();
        let result = evaluate_batch(&batch);
        assert_eq!(result.total_rules, 10);
        assert_eq!(result.block_count, 1); // Only rule 10 fails
        assert_eq!(result.pass_count, 9);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_batch_all_pass() {
        let batch = ComplianceBatch {
            rules: vec![
                min_input(1, 1250, 800),
                min_input(2, 11500, 10000),
                max_input(3, 1800, 2500),
                bool_input(4, 1),
            ],
        };
        let result = evaluate_batch(&batch);
        assert!(result.all_compliant);
        assert_eq!(result.pass_count, 4);
        assert_eq!(result.block_count, 0);
    }

    #[test]
    fn test_batch_mixed_condition_types() {
        // A realistic KYC + capital + sanctions batch
        let batch = ComplianceBatch {
            rules: vec![
                min_input(1, 1250, 800),                                       // Capital >= 8%: PASS
                bool_input(2, 1),                                              // ID verified: PASS
                not_member_of_input(3, 99, vec![18, 36, 72]),                  // NL(99) not in [RU=18,KP=36,IR=72]: PASS
                bool_input(4, 0),                                              // Consent missing: BLOCK
                range_input(5, 3600, 0, 14400),                               // ICT report in time: PASS
            ],
        };
        let result = evaluate_batch(&batch);
        assert_eq!(result.total_rules, 5);
        assert_eq!(result.pass_count, 4);
        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_batch_empty() {
        let batch = ComplianceBatch { rules: vec![] };
        let result = evaluate_batch(&batch);
        assert_eq!(result.total_rules, 0);
        assert!(result.all_compliant); // vacuous truth: no rules, no failures
    }

    // ---- Edge cases --------------------------------------------------------

    #[test]
    fn test_zero_minimum_threshold() {
        // Rule: value must be >= 0 (CCyB is always PASS for any non-negative value)
        let result = evaluate_rule(&min_input(9, 250, 0));
        assert!(result.compliant);
    }

    #[test]
    fn test_margin_bps_calculation() {
        // capital = 1250 (12.50%), threshold = 800 (8.00%)
        // margin = (1250 - 800) * 10000 / 800 = 450 * 10000 / 800 = 5625 bps
        let result = evaluate_rule(&min_input(1, 1250, 800));
        assert_eq!(result.margin_bps, 5625);
    }

    #[test]
    fn test_negative_margin_bps_calculation() {
        // stress capital = 480 (4.80%), threshold = 550 (5.50%)
        // margin = -((550 - 480) * 10000 / 550) = -(70 * 10000 / 550) = -1272 bps
        let result = evaluate_rule(&min_input(10, 480, 550));
        assert_eq!(result.margin_bps, -1272);
    }
}
