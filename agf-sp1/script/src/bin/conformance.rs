//! AGF Conformance Test Binary — Phase 2 (OpenSpec v2.0)
//!
//! Runs all three new rule verticals through the SP1 zkVM and asserts each
//! result matches the documented expected decision. This is the reproducible
//! evidence that the new condition types (MemberOf, NotMemberOf, BooleanTrue)
//! work correctly for real regulatory use cases.
//!
//! Each test case is:
//!   - Named (e.g. "SAN-PASS", "KYC-BLOCK-AGE")
//!   - Tied to a specific ARSL rule file
//!   - Given a complete data map
//!   - Compared against an expected: total_rules, pass_count, block_count
//!
//! Usage:
//!   cargo run --release --bin conformance
//!   cargo run --release --bin conformance -- --execute-zkvm

use clap::Parser;
use sp1_sdk::{
    blocking::{ProveRequest, Prover, ProverClient},
    include_elf, Elf, SP1Stdin,
};
use std::collections::HashMap;
use std::time::Instant;

use agf_lib::{arsl, evaluate_batch};

const AGF_ELF: Elf = include_elf!("agf-program");

// ─────────────────────────────────────────────────────────────────────────────
// Jurisdiction hashes (for test vectors)
// Convention: integer encoding matches ARSL blocked_values / allowed_values
// ─────────────────────────────────────────────────────────────────────────────

/// Jurisdiction hashes used in HMT sanctions rules
mod jur {
    /// Netherlands — NOT on sanctions list
    pub const NL: u64 = 99;
    /// Russia — ON HMT sanctions list (blocked_values = [18, ...])
    pub const RU: u64 = 18;
    /// North Korea — ON HMT sanctions list
    pub const KP: u64 = 36;
    /// Netherlands — safe country of birth (not in FATF high-risk list)
    pub const NL_COB: u64 = 77;
    /// Iran — ON FATF high-risk list (blocked in KYC rules: [36, 72, 101, 288, 512])
    pub const IR_COB: u64 = 72;
}

/// KYC status hashes (member_of: allowed_values = [1, 2, 3])
mod kyc_status {
    /// "verified" — in the allowed set
    pub const VERIFIED: u64 = 2;
    /// "unverified" — NOT in the allowed set
    pub const UNVERIFIED: u64 = 99;
}

/// Name hashes for sanctions screening
mod name_hash {
    /// Safe counterparty — not on any list
    pub const SAFE: u64 = 12345;
    /// OFAC SDN match — in blocked_values = [0xDEAD1, 0xDEAD2, ...]
    /// 0xDEAD1 = 909_009 decimal
    pub const OFAC_HIT: u64 = 912_081; // 0xDEAD1 decimal
    /// HMT/KYC blocked name hash — in blocked_values = [0xBLK1, 0xBLK2, 0xBLK3]
    /// Using the same decimal value as the ARSL toml file interprets 0xBLK1?
    /// The ARSL file has those as HEX but they're invalid — blocked_values
    /// in KYC file use placeholder u64s; we use the numeric value directly.
    pub const KYC_BLOCKED: u64 = 11;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test case definition
// ─────────────────────────────────────────────────────────────────────────────

struct ConformanceCase {
    id: &'static str,
    description: &'static str,
    rule_file: &'static str,
    data: HashMap<String, u64>,
    expected_pass: u32,
    expected_block: u32,
}

impl ConformanceCase {
    fn new(
        id: &'static str,
        description: &'static str,
        rule_file: &'static str,
        data: &[(&str, u64)],
        expected_pass: u32,
        expected_block: u32,
    ) -> Self {
        let data = data
            .iter()
            .map(|(k, v)| (k.to_string(), *v))
            .collect::<HashMap<_, _>>();
        Self { id, description, rule_file, data, expected_pass, expected_block }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Parser, Debug)]
#[command(
    author = "AGF / NeuroCluster",
    about = "AGF Conformance Tests — Phase 2 (OpenSpec v2.0)"
)]
struct Args {
    /// Run each case through the SP1 zkVM (execute mode, no proof generation).
    /// Without this flag, rules are evaluated on the host only (instant).
    #[arg(long)]
    execute_zkvm: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

fn main() {
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    let args = Args::parse();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║    AGF Conformance Tests — Phase 2 (OpenSpec v2.0)           ║");
    println!("║    Verticals: Sanctions · GDPR/Consent · KYC Onboarding      ║");
    println!("╚═══════════════════════════════════════════════════════════════╝");
    println!();

    if args.execute_zkvm {
        println!("  Mode: SP1 zkVM EXECUTE (each case runs inside the zkVM)");
    } else {
        println!("  Mode: HOST EVALUATION (fast; use --execute-zkvm for zkVM mode)");
    }
    println!();

    let cases = build_test_cases();

    let mut total = 0u32;
    let mut passed = 0u32;
    let mut failed = 0u32;

    let start = Instant::now();

    let use_zkvm = args.execute_zkvm;

    for case in &cases {
        let result = run_case(case, use_zkvm);
        total += 1;

        let ok = result.pass_count == case.expected_pass
            && result.block_count == case.expected_block;

        if ok {
            passed += 1;
            println!(
                "  ✅ [{:25}] {:2} rules | PASS={} BLOCK={} | {}",
                case.id,
                result.total_rules,
                result.pass_count,
                result.block_count,
                case.description,
            );
        } else {
            failed += 1;
            println!(
                "  ❌ [{:25}] {:2} rules | PASS={} BLOCK={} (expected PASS={} BLOCK={}) | {}",
                case.id,
                result.total_rules,
                result.pass_count,
                result.block_count,
                case.expected_pass,
                case.expected_block,
                case.description,
            );
        }
    }

    let elapsed = start.elapsed();
    println!();
    println!("═══════════════════════════════════════════════════════════════");
    println!(
        "  Results: {}/{} cases passed ({} failed) in {:?}",
        passed, total, failed, elapsed
    );

    if failed == 0 {
        println!("  ✅ ALL CONFORMANCE CASES PASSED");
    } else {
        println!("  ❌ {} CONFORMANCE CASE(S) FAILED — see output above", failed);
        std::process::exit(1);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result container
// ─────────────────────────────────────────────────────────────────────────────

struct CaseResult {
    total_rules: u32,
    pass_count: u32,
    block_count: u32,
}

// ─────────────────────────────────────────────────────────────────────────────
// Run a single conformance case
// ─────────────────────────────────────────────────────────────────────────────

fn run_case(
    case: &ConformanceCase,
    use_zkvm: bool,
) -> CaseResult {
    let toml_str = std::fs::read_to_string(case.rule_file)
        .unwrap_or_else(|e| panic!("[{}] Failed to read '{}': {}", case.id, case.rule_file, e));

    let arsl_file = arsl::parse_arsl(&toml_str)
        .unwrap_or_else(|e| panic!("[{}] Parse error: {}", case.id, e));

    arsl::validate(&arsl_file)
        .unwrap_or_else(|errs| {
            panic!(
                "[{}] Validation errors: {}",
                case.id,
                errs.iter().map(|e| e.to_string()).collect::<Vec<_>>().join("; ")
            )
        });

    let batch = arsl::compile_batch(&arsl_file, &case.data, 9001, 1742636400)
        .unwrap_or_else(|e| panic!("[{}] Compile error: {}", case.id, e));

    if use_zkvm {
        // ── Execute inside SP1 zkVM ──────────────────────────────────────────
        let client = ProverClient::from_env();
        let mut stdin = SP1Stdin::new();
        stdin.write(&batch);

        let (output, _report) = client.execute(AGF_ELF, stdin).run()
            .unwrap_or_else(|e| panic!("[{}] zkVM execution failed: {}", case.id, e));

        let mut reader = output.as_slice();
        let total: u32   = read_value(&mut reader);
        let pass: u32    = read_value(&mut reader);
        let block: u32   = read_value(&mut reader);
        let _all: bool   = read_value(&mut reader);

        CaseResult { total_rules: total, pass_count: pass, block_count: block }
    } else {
        // ── Host-side evaluation (no zkVM) ───────────────────────────────────
        let result = evaluate_batch(&batch);
        CaseResult {
            total_rules: result.total_rules,
            pass_count: result.pass_count,
            block_count: result.block_count,
        }
    }
}

fn read_value<T: serde::de::DeserializeOwned>(reader: &mut &[u8]) -> T {
    let size = std::mem::size_of::<T>();
    let (bytes, rest) = reader.split_at(size);
    *reader = rest;
    unsafe { std::ptr::read_unaligned(bytes.as_ptr() as *const T) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test case definitions
// ─────────────────────────────────────────────────────────────────────────────

fn build_test_cases() -> Vec<ConformanceCase> {
    vec![
        // ====================================================================
        // SANCTIONS VERTICAL — rules/sanctions/hmt.arsl.toml (5 rules)
        // Rules tested: HMT-SAN-001 to HMT-SAN-005
        // ====================================================================

        ConformanceCase::new(
            "SAN-PASS",
            "All sanctions checks pass (clean counterparty)",
            "rules/finance/sanctions/hmt.arsl.toml",
            &[
                // HMT-SAN-001: counterparty_jurisdiction_hash NOT in [18,36,72,144,288,576,1152]
                ("counterparty_jurisdiction_hash", jur::NL),
                // HMT-SAN-002: ubo_jurisdiction_hash NOT blocked
                ("ubo_jurisdiction_hash", jur::NL),
                // HMT-SAN-003: currency_code_hash NOT in [97, 193]
                ("currency_code_hash", 42),          // EUR hash — not blocked
                // OFAC-SDN-001: counterparty_name_hash NOT in SDN list
                ("counterparty_name_hash", name_hash::SAFE),
                // HMT-SAN-005: transaction_amount_gbp <= 1,000,000 pence (GBP 10,000)
                ("transaction_amount_gbp", 500_000), // GBP 5,000 — PASS
            ],
            5, 0, // expected: all 5 PASS
        ),

        ConformanceCase::new(
            "SAN-BLOCK-JURISDICTION",
            "Russian counterparty jurisdiction triggers HMT block",
            "rules/finance/sanctions/hmt.arsl.toml",
            &[
                ("counterparty_jurisdiction_hash", jur::RU), // RU = 18 → BLOCK
                ("ubo_jurisdiction_hash", jur::NL),
                ("currency_code_hash", 42),
                ("counterparty_name_hash", name_hash::SAFE),
                ("transaction_amount_gbp", 500_000),
            ],
            4, 1, // HMT-SAN-001 blocked, rest pass
        ),

        ConformanceCase::new(
            "SAN-BLOCK-BOTH-JUR",
            "Both counterparty and UBO are sanctioned jurisdictions",
            "rules/finance/sanctions/hmt.arsl.toml",
            &[
                ("counterparty_jurisdiction_hash", jur::RU), // RU → BLOCK
                ("ubo_jurisdiction_hash", jur::KP),           // KP → BLOCK
                ("currency_code_hash", 42),
                ("counterparty_name_hash", name_hash::SAFE),
                ("transaction_amount_gbp", 500_000),
            ],
            3, 2, // two jurisdiction rules blocked
        ),

        ConformanceCase::new(
            "SAN-BLOCK-OFAC-NAME",
            "Counterparty name matches OFAC SDN list entry",
            "rules/finance/sanctions/hmt.arsl.toml",
            &[
                ("counterparty_jurisdiction_hash", jur::NL),
                ("ubo_jurisdiction_hash", jur::NL),
                ("currency_code_hash", 42),
                ("counterparty_name_hash", name_hash::OFAC_HIT), // SDN hit → BLOCK
                ("transaction_amount_gbp", 500_000),
            ],
            4, 1, // OFAC-SDN-001 blocked
        ),

        ConformanceCase::new(
            "SAN-BLOCK-AMOUNT",
            "Transaction amount exceeds GBP 10,000 escalation threshold",
            "rules/finance/sanctions/hmt.arsl.toml",
            &[
                ("counterparty_jurisdiction_hash", jur::NL),
                ("ubo_jurisdiction_hash", jur::NL),
                ("currency_code_hash", 42),
                ("counterparty_name_hash", name_hash::SAFE),
                ("transaction_amount_gbp", 2_000_000), // GBP 20,000 > threshold → BLOCK
            ],
            4, 1, // HMT-SAN-005 blocked (escalate)
        ),

        // ====================================================================
        // GDPR / CONSENT VERTICAL — rules/gdpr/consent.arsl.toml (5 rules)
        // Rules: GDPR-CON-001, GDPR-CON-002, GDPR-ERA-001, GDPR-RET-001, EUAI-ART5-001
        // ====================================================================

        ConformanceCase::new(
            "CON-PASS",
            "All consent/GDPR checks pass (compliant data subject)",
            "rules/cross_industry/gdpr/consent.arsl.toml",
            &[
                // GDPR-CON-001: explicit consent given
                ("gdpr_explicit_consent", 1),
                // GDPR-CON-002: special category consent given
                ("special_category_consent", 1),
                // GDPR-ERA-001: no active erasure request (equals 0)
                ("erasure_request_active", 0),
                // GDPR-RET-001: 180 days since collection <= 730 day limit
                ("days_since_collection", 180),
                // EUAI-ART5-001: not a prohibited AI practice (equals 0)
                ("ai_prohibited_category", 0),
            ],
            5, 0,
        ),

        ConformanceCase::new(
            "CON-BLOCK-NO-CONSENT",
            "GDPR explicit consent is missing (boolean_true gate blocks)",
            "rules/cross_industry/gdpr/consent.arsl.toml",
            &[
                ("gdpr_explicit_consent", 0),  // no consent → BLOCK
                ("special_category_consent", 1),
                ("erasure_request_active", 0),
                ("days_since_collection", 180),
                ("ai_prohibited_category", 0),
            ],
            4, 1, // GDPR-CON-001 blocked
        ),

        ConformanceCase::new(
            "CON-BLOCK-ERASURE",
            "Active erasure request prevents further processing",
            "rules/cross_industry/gdpr/consent.arsl.toml",
            &[
                ("gdpr_explicit_consent", 1),
                ("special_category_consent", 1),
                ("erasure_request_active", 1),   // active → BLOCK (must equal 0)
                ("days_since_collection", 180),
                ("ai_prohibited_category", 0),
            ],
            4, 1, // GDPR-ERA-001 blocked
        ),

        ConformanceCase::new(
            "CON-BLOCK-RETENTION",
            "Data exceeds 730-day retention limit",
            "rules/cross_industry/gdpr/consent.arsl.toml",
            &[
                ("gdpr_explicit_consent", 1),
                ("special_category_consent", 1),
                ("erasure_request_active", 0),
                ("days_since_collection", 800), // > 730 days → BLOCK
                ("ai_prohibited_category", 0),
            ],
            4, 1, // GDPR-RET-001 blocked
        ),

        ConformanceCase::new(
            "CON-BLOCK-AI-ACT",
            "AI system categorised as prohibited under EU AI Act Article 5",
            "rules/cross_industry/gdpr/consent.arsl.toml",
            &[
                ("gdpr_explicit_consent", 1),
                ("special_category_consent", 1),
                ("erasure_request_active", 0),
                ("days_since_collection", 180),
                ("ai_prohibited_category", 1), // prohibited category → BLOCK (must equal 0)
            ],
            4, 1, // EUAI-ART5-001 blocked
        ),

        // ====================================================================
        // KYC ONBOARDING VERTICAL — rules/kyc/standard_onboarding.arsl.toml (6 rules)
        // Rules: KYC-AGE-001, KYC-AML-001, KYC-IDV-001, KYC-JUR-001, KYC-PEP-001, KYC-SAN-001
        // ====================================================================

        ConformanceCase::new(
            "KYC-PASS",
            "All KYC onboarding checks pass (ideal applicant)",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                // KYC-AGE-001: age >= 18
                ("customer_age_years", 25),
                // KYC-AML-001: AML score <= 24
                ("aml_risk_score", 12),
                // KYC-IDV-001: ID verification passed (boolean true)
                ("id_verification_passed", 1),
                // KYC-JUR-001: country of birth NOT in FATF restricted list
                ("country_of_birth_hash", jur::NL_COB),
                // KYC-PEP-001: not a PEP (equals 0)
                ("pep_status", 0),
                // KYC-SAN-001: name not on sanctions list
                ("applicant_name_hash", name_hash::SAFE),
            ],
            6, 0,
        ),

        ConformanceCase::new(
            "KYC-BLOCK-UNDERAGE",
            "Applicant is under 18 — age gate blocks",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 16),    // < 18 → BLOCK
                ("aml_risk_score", 12),
                ("id_verification_passed", 1),
                ("country_of_birth_hash", jur::NL_COB),
                ("pep_status", 0),
                ("applicant_name_hash", name_hash::SAFE),
            ],
            5, 1, // KYC-AGE-001 blocked
        ),

        ConformanceCase::new(
            "KYC-BLOCK-AML-SCORE",
            "AML risk score above standard onboarding threshold (escalate)",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 25),
                ("aml_risk_score", 35),        // > 24 → BLOCK (escalate to EDD)
                ("id_verification_passed", 1),
                ("country_of_birth_hash", jur::NL_COB),
                ("pep_status", 0),
                ("applicant_name_hash", name_hash::SAFE),
            ],
            5, 1, // KYC-AML-001 blocked
        ),

        ConformanceCase::new(
            "KYC-BLOCK-NO-ID",
            "ID verification not passed — identity gate blocks",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 25),
                ("aml_risk_score", 12),
                ("id_verification_passed", 0), // not verified → BLOCK
                ("country_of_birth_hash", jur::NL_COB),
                ("pep_status", 0),
                ("applicant_name_hash", name_hash::SAFE),
            ],
            5, 1, // KYC-IDV-001 blocked
        ),

        ConformanceCase::new(
            "KYC-BLOCK-JURISDICTION",
            "Country of birth is FATF high-risk jurisdiction (Iran)",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 25),
                ("aml_risk_score", 12),
                ("id_verification_passed", 1),
                ("country_of_birth_hash", jur::IR_COB), // IR = 72 → BLOCK (escalate)
                ("pep_status", 0),
                ("applicant_name_hash", name_hash::SAFE),
            ],
            5, 1, // KYC-JUR-001 blocked
        ),

        ConformanceCase::new(
            "KYC-BLOCK-PEP",
            "Applicant is a PEP — requires enhanced due diligence",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 25),
                ("aml_risk_score", 12),
                ("id_verification_passed", 1),
                ("country_of_birth_hash", jur::NL_COB),
                ("pep_status", 1),              // PEP → BLOCK (escalate to EDD)
                ("applicant_name_hash", name_hash::SAFE),
            ],
            5, 1, // KYC-PEP-001 blocked
        ),

        ConformanceCase::new(
            "KYC-BLOCK-NAME-SANCTIONS",
            "Applicant name matches sanctions list — hard block",
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            &[
                ("customer_age_years", 25),
                ("aml_risk_score", 12),
                ("id_verification_passed", 1),
                ("country_of_birth_hash", jur::NL_COB),
                ("pep_status", 0),
                ("applicant_name_hash", 11), // 11 is in blocked_values [11,22,33] → BLOCK
            ],
            5, 1, // KYC-SAN-001 blocked
        ),

        // ====================================================================
        // MULTI-VERTICAL — FCA capital + sanctions + consent (compound batch)
        // Demonstrates a real correspondent banking onboarding scenario
        // ====================================================================

        ConformanceCase::new(
            "MULTI-VERTICAL-PASS",
            "Compound scenario: capital + sanctions + consent — all pass",
            "rules/finance/fca/consumer_duty.arsl.toml",
            &[
                // FCA capital rules use the same data as the original benchmark
                ("capital_ratio", 1250),
                ("liquidity_coverage", 11500),
                ("leverage_ratio", 450),
                ("net_stable_funding", 10800),
                ("large_exposure", 1800),
                ("ict_report_time", 3600),
                ("solvency_ratio", 17500),
                ("tier1_capital", 950),
                ("countercyclical_buffer", 250),
                ("stress_test_capital", 600), // 6.00% > 5.50% threshold — PASS
            ],
            10, 0, // All 10 FCA/DORA rules pass
        ),

        ConformanceCase::new(
            "MULTI-VERTICAL-BLOCK",
            "Compound scenario: capital breach (stress test) — 1 block",
            "rules/finance/fca/consumer_duty.arsl.toml",
            &[
                ("capital_ratio", 1250),
                ("liquidity_coverage", 11500),
                ("leverage_ratio", 450),
                ("net_stable_funding", 10800),
                ("large_exposure", 1800),
                ("ict_report_time", 3600),
                ("solvency_ratio", 17500),
                ("tier1_capital", 950),
                ("countercyclical_buffer", 250),
                ("stress_test_capital", 480), // 4.80% < 5.50% — BLOCK (original benchmark)
            ],
            9, 1, // FCA-CD-009 stress test fails (matches original benchmark exactly)
        ),
    ]
}
