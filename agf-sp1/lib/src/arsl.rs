//! ARSL Parser — Compiles .arsl.toml rule files into ComplianceBatch types.
//!
//! The parser runs on the HOST side (not inside the zkVM). It converts
//! human-readable ARSL rule definitions into the binary ComplianceBatch
//! format that the SP1 guest program accepts.
//!
//! Reference: AGF ARSL Spec v0.1.0 (docs/ARSL_SPEC.md)
//! Updated: AGF OpenSpec v2.0 — Phase 1 (new condition types)

use serde::Deserialize;
use std::collections::HashMap;

use crate::{ComplianceBatch, ComplianceInput, ConditionKind};

// ---------------------------------------------------------------------------
// ARSL Schema Types — Deserialized from .arsl.toml
// ---------------------------------------------------------------------------

/// Root of an ARSL rule file.
#[derive(Debug, Deserialize)]
pub struct ArslFile {
    pub metadata: ArslMetadata,
    #[serde(default)]
    pub entity: Vec<ArslEntity>,
    pub rule: Vec<ArslRule>,
}

/// File-level metadata.
#[derive(Debug, Deserialize)]
pub struct ArslMetadata {
    pub schema_version: String,
    pub jurisdiction: String,
    pub regulator: String,
    pub regulation: String,
    #[serde(default)]
    pub regulation_ref: String,
    #[serde(default)]
    pub effective_date: String,
    #[serde(default)]
    pub last_updated: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub review_status: String,
    #[serde(default)]
    pub source: Option<ArslSource>,
}

/// Source reference for a regulation.
#[derive(Debug, Deserialize)]
pub struct ArslSource {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub section: String,
    #[serde(default)]
    pub regulation: String,
    #[serde(default)]
    pub article: String,
    #[serde(default)]
    pub text: String,
}

/// Entity type definition.
#[derive(Debug, Deserialize)]
pub struct ArslEntity {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub required_fields: Vec<String>,
}

/// A single ARSL rule.
#[derive(Debug, Deserialize)]
pub struct ArslRule {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub severity: String,
    #[serde(default)]
    pub entity_type: String,
    #[serde(default)]
    pub source: Option<ArslSource>,
    pub condition: ArslCondition,
    #[serde(default)]
    pub enforcement: Option<ArslEnforcement>,
}

/// Rule condition — the actual check.
///
/// Supported condition types:
///   - `minimum`      : value >= threshold
///   - `maximum`      : value <= threshold
///   - `range`        : min_threshold <= value <= max_threshold
///   - `equals`       : value == threshold
///   - `not_equals`   : value != threshold
///   - `member_of`    : value is in `allowed_values` set (PASS if found)
///   - `not_member_of`: value is NOT in `blocked_values` set (PASS if not found)
///   - `boolean_true` : value == 1 (PASS), value == 0 (BLOCK)
#[derive(Debug, Deserialize)]
pub struct ArslCondition {
    #[serde(rename = "type")]
    pub condition_type: String,
    #[serde(default)]
    pub field: String,
    #[serde(default)]
    pub threshold: u64,
    #[serde(default)]
    pub min_threshold: u64,
    #[serde(default)]
    pub max_threshold: u64,
    #[serde(default)]
    pub unit: String,
    /// For `member_of`: hashed values that are ALLOWED (PASS if actual_value is in this list).
    /// For `not_member_of`: hashed values that are BLOCKED (BLOCK if actual_value is in this list).
    #[serde(default)]
    pub allowed_values: Vec<u64>,
    #[serde(default)]
    pub blocked_values: Vec<u64>,
    #[serde(default)]
    pub checks: Vec<ArslCondition>,
}

/// Enforcement action.
#[derive(Debug, Deserialize)]
pub struct ArslEnforcement {
    #[serde(default)]
    pub on_pass: String,
    #[serde(default)]
    pub on_fail: String,
    #[serde(default)]
    pub notification: bool,
    #[serde(default)]
    pub escalation_target: String,
}

// ---------------------------------------------------------------------------
// Parser — ArslFile → ComplianceBatch
// ---------------------------------------------------------------------------

/// Parse error type.
#[derive(Debug)]
pub enum ArslError {
    /// TOML parsing failed
    ParseError(String),
    /// Rule validation failed
    ValidationError(String),
    /// Unknown condition type
    UnknownConditionType(String),
}

impl std::fmt::Display for ArslError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ArslError::ParseError(msg) => write!(f, "ARSL parse error: {}", msg),
            ArslError::ValidationError(msg) => write!(f, "ARSL validation error: {}", msg),
            ArslError::UnknownConditionType(t) => {
                write!(f, "Unknown ARSL condition type: '{}'", t)
            }
        }
    }
}

/// Parse an ARSL TOML string into an ArslFile.
pub fn parse_arsl(toml_str: &str) -> Result<ArslFile, ArslError> {
    toml::from_str(toml_str).map_err(|e| ArslError::ParseError(e.to_string()))
}

/// Compile an ArslFile into a ComplianceBatch with test data.
///
/// The `data` parameter maps field names to actual values.
/// For example: `{"capital_ratio": 1250, "liquidity_coverage": 11500}`
///
/// The `entity_id` and `timestamp` parameters are applied to all rules.
pub fn compile_batch(
    arsl: &ArslFile,
    data: &HashMap<String, u64>,
    entity_id: u32,
    timestamp: u64,
) -> Result<ComplianceBatch, ArslError> {
    let mut rules = Vec::new();

    for (idx, rule) in arsl.rule.iter().enumerate() {
        let input = compile_rule(rule, idx as u32 + 1, data, entity_id, timestamp)?;
        rules.push(input);
    }

    Ok(ComplianceBatch { rules })
}

/// Compile a single ARSL rule into a ComplianceInput.
fn compile_rule(
    rule: &ArslRule,
    rule_id: u32,
    data: &HashMap<String, u64>,
    entity_id: u32,
    timestamp: u64,
) -> Result<ComplianceInput, ArslError> {
    let actual_value = data.get(&rule.condition.field).copied().unwrap_or(0);

    let (kind, min_threshold, max_threshold, set_members) =
        match rule.condition.condition_type.as_str() {
            "minimum" => (ConditionKind::Minimum, rule.condition.threshold, 0, vec![]),
            "maximum" => (ConditionKind::Maximum, 0, rule.condition.threshold, vec![]),
            "range" => (
                ConditionKind::Range,
                rule.condition.min_threshold,
                rule.condition.max_threshold,
                vec![],
            ),
            "equals" => (
                ConditionKind::Equals,
                rule.condition.threshold,
                rule.condition.threshold,
                vec![],
            ),
            "not_equals" => (
                ConditionKind::NotEquals,
                rule.condition.threshold,
                0,
                vec![],
            ),
            "member_of" => (
                ConditionKind::MemberOf,
                0,
                0,
                rule.condition.allowed_values.clone(),
            ),
            "not_member_of" => (
                ConditionKind::NotMemberOf,
                0,
                0,
                rule.condition.blocked_values.clone(),
            ),
            "boolean_true" => (ConditionKind::BooleanTrue, 0, 0, vec![]),
            other => return Err(ArslError::UnknownConditionType(other.to_string())),
        };

    Ok(ComplianceInput {
        rule_id,
        actual_value,
        minimum_threshold: min_threshold,
        maximum_threshold: max_threshold,
        timestamp,
        entity_id,
        condition_kind: kind,
        set_members,
    })
}

/// Validate an ARSL file for correctness.
pub fn validate(arsl: &ArslFile) -> Result<(), Vec<ArslError>> {
    let mut errors = Vec::new();

    // Check schema version
    if arsl.metadata.schema_version != "0.1.0" {
        errors.push(ArslError::ValidationError(format!(
            "Unsupported schema version: '{}' (expected '0.1.0')",
            arsl.metadata.schema_version
        )));
    }

    // Check each rule
    for rule in &arsl.rule {
        // Validate rule ID is non-empty
        if rule.id.is_empty() {
            errors.push(ArslError::ValidationError("Rule has empty ID".to_string()));
        }

        // Validate condition type
        let valid_types = [
            "minimum",
            "maximum",
            "range",
            "equals",
            "not_equals",
            "member_of",
            "not_member_of",
            "boolean_true",
        ];
        if !valid_types.contains(&rule.condition.condition_type.as_str()) {
            errors.push(ArslError::UnknownConditionType(
                rule.condition.condition_type.clone(),
            ));
        }

        // member_of requires allowed_values
        if rule.condition.condition_type == "member_of"
            && rule.condition.allowed_values.is_empty()
        {
            errors.push(ArslError::ValidationError(format!(
                "Rule '{}': member_of condition requires at least one allowed_value",
                rule.id
            )));
        }

        // not_member_of requires blocked_values
        if rule.condition.condition_type == "not_member_of"
            && rule.condition.blocked_values.is_empty()
        {
            // Empty blocked list is technically valid (nothing blocked = all pass)
            // but warn via a ValidationError with a distinct message so operators notice
            // This is intentionally NOT an error — an empty list means "no jurisdictions blocked"
        }

        // Validate severity
        let valid_severities = ["critical", "high", "medium", "low", "informational", ""];
        if !valid_severities.contains(&rule.severity.as_str()) {
            errors.push(ArslError::ValidationError(format!(
                "Rule '{}': invalid severity '{}'",
                rule.id, rule.severity
            )));
        }

        // Validate range has both thresholds
        if rule.condition.condition_type == "range" {
            if rule.condition.min_threshold == 0 && rule.condition.max_threshold == 0 {
                errors.push(ArslError::ValidationError(format!(
                    "Rule '{}': range condition requires min_threshold and/or max_threshold",
                    rule.id
                )));
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

/// Parse, validate, and compile an ARSL file from a TOML string.
///
/// This is the main entry point for the ARSL pipeline.
pub fn compile_arsl(
    toml_str: &str,
    data: &HashMap<String, u64>,
    entity_id: u32,
    timestamp: u64,
) -> Result<ComplianceBatch, ArslError> {
    let arsl = parse_arsl(toml_str)?;

    validate(&arsl).map_err(|errs| {
        ArslError::ValidationError(
            errs.iter()
                .map(|e| e.to_string())
                .collect::<Vec<_>>()
                .join("; "),
        )
    })?;

    compile_batch(&arsl, data, entity_id, timestamp)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evaluate_batch;

    // -----------------------------------------------------------------------
    // Fixture: minimal FCA prudential rule set (numeric conditions)
    // -----------------------------------------------------------------------
    const SAMPLE_ARSL: &str = r#"
[metadata]
schema_version = "0.1.0"
jurisdiction = "UK"
regulator = "FCA"
regulation = "Consumer Duty"

[[rule]]
id = "FCA-CD-001"
name = "Capital Adequacy"
category = "capital"
severity = "critical"

[rule.condition]
type = "minimum"
field = "capital_ratio"
threshold = 800
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

[[rule]]
id = "FCA-CD-002"
name = "Leverage Ratio"
severity = "high"

[rule.condition]
type = "minimum"
field = "leverage_ratio"
threshold = 300
unit = "bps"

[[rule]]
id = "FCA-CD-003"
name = "Large Exposure"
severity = "high"

[rule.condition]
type = "range"
field = "large_exposure"
min_threshold = 0
max_threshold = 2500
unit = "bps"
"#;

    // -----------------------------------------------------------------------
    // Fixture: sanctions + consent + KYC (boolean/set conditions)
    // -----------------------------------------------------------------------
    const EXTENDED_ARSL: &str = r#"
[metadata]
schema_version = "0.1.0"
jurisdiction = "UK"
regulator = "HMT"
regulation = "Financial Sanctions"

[[rule]]
id = "HMT-SAN-001"
name = "Counterparty Jurisdiction Sanctions Check"
category = "sanctions"
severity = "critical"

[rule.condition]
type = "not_member_of"
field = "jurisdiction_hash"
blocked_values = [18, 36, 72, 144]

[[rule]]
id = "GDPR-CON-001"
name = "Explicit Consent Verification"
category = "consent"
severity = "critical"

[rule.condition]
type = "boolean_true"
field = "gdpr_consent_given"

[[rule]]
id = "KYC-ELI-001"
name = "KYC Status Eligibility"
category = "kyc"
severity = "high"

[rule.condition]
type = "member_of"
field = "kyc_status_hash"
allowed_values = [1, 2, 3]

[[rule]]
id = "KYC-AGE-001"
name = "Minimum Age Gate"
category = "kyc"
severity = "high"

[rule.condition]
type = "minimum"
field = "customer_age_years"
threshold = 18
"#;

    // -----------------------------------------------------------------------
    // Basic parse / validate tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_parse_arsl() {
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse ARSL");
        assert_eq!(arsl.metadata.jurisdiction, "UK");
        assert_eq!(arsl.metadata.regulator, "FCA");
        assert_eq!(arsl.rule.len(), 3);
        assert_eq!(arsl.rule[0].id, "FCA-CD-001");
        assert_eq!(arsl.rule[0].condition.condition_type, "minimum");
        assert_eq!(arsl.rule[0].condition.threshold, 800);
    }

    #[test]
    fn test_validate_arsl() {
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse");
        validate(&arsl).expect("Validation should pass");
    }

    #[test]
    fn test_validate_extended_arsl() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse extended ARSL");
        validate(&arsl).expect("Extended ARSL should be valid");
        assert_eq!(arsl.rule.len(), 4);
        assert_eq!(arsl.rule[0].condition.condition_type, "not_member_of");
        assert_eq!(arsl.rule[1].condition.condition_type, "boolean_true");
        assert_eq!(arsl.rule[2].condition.condition_type, "member_of");
        assert_eq!(arsl.rule[3].condition.condition_type, "minimum");
    }

    #[test]
    fn test_validate_rejects_unknown_condition() {
        let bad_arsl = r#"
[metadata]
schema_version = "0.1.0"
jurisdiction = "UK"
regulator = "FCA"
regulation = "Test"

[[rule]]
id = "BAD-001"
name = "Bad Rule"
severity = "high"
[rule.condition]
type = "fuzzy_match"
field = "foo"
threshold = 1
"#;
        let arsl = parse_arsl(bad_arsl).expect("Should parse (validation is a separate step)");
        let result = validate(&arsl);
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // Compile tests — numeric conditions
    // -----------------------------------------------------------------------

    #[test]
    fn test_compile_batch() {
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("capital_ratio".to_string(), 1250_u64);
        data.insert("leverage_ratio".to_string(), 450);
        data.insert("large_exposure".to_string(), 1800);

        let batch = compile_batch(&arsl, &data, 1001, 1709769600).expect("Compilation failed");
        assert_eq!(batch.rules.len(), 3);
        assert_eq!(batch.rules[0].minimum_threshold, 800);
        assert_eq!(batch.rules[0].actual_value, 1250);
        assert_eq!(batch.rules[2].maximum_threshold, 2500);
    }

    #[test]
    fn test_compile_extended_arsl_set_conditions() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        // NL jurisdiction hash (not sanctioned) → 99 is not in [18, 36, 72, 144]
        data.insert("jurisdiction_hash".to_string(), 99_u64);
        // Consent given
        data.insert("gdpr_consent_given".to_string(), 1);
        // KYC status hash 2 → in [1, 2, 3]
        data.insert("kyc_status_hash".to_string(), 2);
        // Age 25 >= 18
        data.insert("customer_age_years".to_string(), 25);

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compilation failed");
        assert_eq!(batch.rules.len(), 4);

        // Rule 1: not_member_of — blocked_values should be in set_members
        assert_eq!(batch.rules[0].set_members, vec![18, 36, 72, 144]);
        // Rule 2: boolean_true — empty set_members
        assert_eq!(batch.rules[1].set_members, vec![]);
        assert_eq!(batch.rules[1].actual_value, 1);
        // Rule 3: member_of — allowed_values
        assert_eq!(batch.rules[2].set_members, vec![1, 2, 3]);
    }

    // -----------------------------------------------------------------------
    // End-to-end evaluation tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_arsl_end_to_end() {
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("capital_ratio".to_string(), 1250_u64);
        data.insert("leverage_ratio".to_string(), 450);
        data.insert("large_exposure".to_string(), 1800);

        let batch = compile_batch(&arsl, &data, 1001, 1709769600).expect("Compilation failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.total_rules, 3);
        assert_eq!(result.pass_count, 3);
        assert_eq!(result.block_count, 0);
        assert!(result.all_compliant);
    }

    #[test]
    fn test_arsl_with_failing_rule() {
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("capital_ratio".to_string(), 500_u64); // 5.00% — FAIL
        data.insert("leverage_ratio".to_string(), 450);
        data.insert("large_exposure".to_string(), 1800);

        let batch = compile_batch(&arsl, &data, 1001, 1709769600).expect("Compilation failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.total_rules, 3);
        assert_eq!(result.pass_count, 2);
        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_extended_arsl_all_pass() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("jurisdiction_hash".to_string(), 99_u64); // NOT in blocked list
        data.insert("gdpr_consent_given".to_string(), 1);      // consent = true
        data.insert("kyc_status_hash".to_string(), 2);         // in allowed list
        data.insert("customer_age_years".to_string(), 25);      // >= 18

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.total_rules, 4);
        assert!(result.all_compliant, "All rules should pass");
    }

    #[test]
    fn test_extended_arsl_sanctions_block() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("jurisdiction_hash".to_string(), 18_u64); // RU hash — in blocked list → BLOCK
        data.insert("gdpr_consent_given".to_string(), 1);
        data.insert("kyc_status_hash".to_string(), 2);
        data.insert("customer_age_years".to_string(), 25);

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_extended_arsl_no_consent_block() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("jurisdiction_hash".to_string(), 99_u64);
        data.insert("gdpr_consent_given".to_string(), 0); // consent missing → BLOCK
        data.insert("kyc_status_hash".to_string(), 2);
        data.insert("customer_age_years".to_string(), 25);

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_extended_arsl_underage_block() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("jurisdiction_hash".to_string(), 99_u64);
        data.insert("gdpr_consent_given".to_string(), 1);
        data.insert("kyc_status_hash".to_string(), 2);
        data.insert("customer_age_years".to_string(), 16); // underage → BLOCK

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_extended_arsl_invalid_kyc_status_block() {
        let arsl = parse_arsl(EXTENDED_ARSL).expect("Failed to parse");

        let mut data = HashMap::new();
        data.insert("jurisdiction_hash".to_string(), 99_u64);
        data.insert("gdpr_consent_given".to_string(), 1);
        data.insert("kyc_status_hash".to_string(), 99); // 99 not in [1, 2, 3] → BLOCK
        data.insert("customer_age_years".to_string(), 25);

        let batch = compile_batch(&arsl, &data, 9001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);

        assert_eq!(result.block_count, 1);
        assert!(!result.all_compliant);
    }

    #[test]
    fn test_compile_arsl_shorthand() {
        let mut data = HashMap::new();
        data.insert("capital_ratio".to_string(), 1250_u64);
        data.insert("leverage_ratio".to_string(), 450);
        data.insert("large_exposure".to_string(), 1800);

        let batch = compile_arsl(SAMPLE_ARSL, &data, 1001, 1709769600).expect("Should compile");
        assert_eq!(batch.rules.len(), 3);
    }

    // -----------------------------------------------------------------------
    // Missing data / edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_missing_field_defaults_to_zero() {
        // If a field isn't in the data map, it defaults to 0
        // Capital ratio = 0 < 800 → BLOCK
        let arsl = parse_arsl(SAMPLE_ARSL).expect("Failed to parse");
        let data = HashMap::new(); // no data provided
        let batch = compile_batch(&arsl, &data, 1001, 1709769600).expect("Compile failed");
        let result = evaluate_batch(&batch);
        // All three rules get 0 as actual_value:
        // minimum 800 → BLOCK, minimum 300 → BLOCK, range [0,2500] → PASS
        assert_eq!(result.block_count, 2);
        assert_eq!(result.pass_count, 1);
    }
}
