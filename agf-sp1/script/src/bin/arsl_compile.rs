//! ARSL CLI — Compile and test ARSL rule files.
//!
//! Usage:
//!   # Parse and evaluate an ARSL rule file
//!   cargo run --release --bin arsl-compile -- --file rules/fca/consumer_duty.arsl.toml
//!
//!   # Execute inside SP1 zkVM
//!   cargo run --release --bin arsl-compile -- --file rules/fca/consumer_duty.arsl.toml --execute

use clap::Parser;
use sp1_sdk::{
    blocking::{ProveRequest, Prover, ProverClient},
    include_elf, Elf, SP1Stdin,
};
use std::collections::HashMap;
use std::time::Instant;

use agf_lib::arsl;

/// The ELF binary for the AGF compliance rule evaluator.
const AGF_ELF: Elf = include_elf!("agf-program");

#[derive(Parser, Debug)]
#[command(
    author = "AGF / NeuroCluster",
    version,
    about = "ARSL Compiler — Compile and evaluate .arsl.toml rule files"
)]
struct Args {
    /// Path to the .arsl.toml rule file
    #[arg(long, short)]
    file: String,

    /// Execute inside SP1 zkVM after compilation
    #[arg(long)]
    execute: bool,

    /// Entity ID for the evaluation
    #[arg(long, default_value = "1001")]
    entity_id: u32,
}

fn main() {
    sp1_sdk::utils::setup_logger();
    dotenv::dotenv().ok();

    let args = Args::parse();

    println!("╔═══════════════════════════════════════════════════════════════╗");
    println!("║              ARSL Compiler — AGF Rule Engine                 ║");
    println!("║   Reference: ARSL Spec v0.1.0 / OpenSpec §7.2               ║");
    println!("╚═══════════════════════════════════════════════════════════════╝");
    println!();

    // -----------------------------------------------------------------------
    // Step 1: Read and parse the ARSL file
    // -----------------------------------------------------------------------
    println!("─── Step 1: Parsing ARSL file ─────────────────────────────────");
    let parse_start = Instant::now();

    let toml_str = std::fs::read_to_string(&args.file)
        .unwrap_or_else(|e| {
            eprintln!("  ❌ Failed to read file '{}': {}", args.file, e);
            std::process::exit(1);
        });

    let arsl_file = arsl::parse_arsl(&toml_str)
        .unwrap_or_else(|e| {
            eprintln!("  ❌ Parse error: {}", e);
            std::process::exit(1);
        });

    let parse_time = parse_start.elapsed();
    println!("  ✅ Parsed in {:?}", parse_time);
    println!("  Jurisdiction: {}", arsl_file.metadata.jurisdiction);
    println!("  Regulator:    {}", arsl_file.metadata.regulator);
    println!("  Regulation:   {}", arsl_file.metadata.regulation);
    println!("  Rules found:  {}", arsl_file.rule.len());
    println!();

    // -----------------------------------------------------------------------
    // Step 2: Validate
    // -----------------------------------------------------------------------
    println!("─── Step 2: Validating rules ──────────────────────────────────");
    match arsl::validate(&arsl_file) {
        Ok(()) => println!("  ✅ All {} rules valid", arsl_file.rule.len()),
        Err(errors) => {
            for e in &errors {
                eprintln!("  ❌ {}", e);
            }
            std::process::exit(1);
        }
    }

    // Print rule summary
    println!();
    println!("  ┌────────────────┬──────────────────────────────┬──────────┐");
    println!("  │ ID             │ Name                         │ Severity │");
    println!("  ├────────────────┼──────────────────────────────┼──────────┤");
    for rule in &arsl_file.rule {
        println!(
            "  │ {:<14} │ {:<28} │ {:<8} │",
            rule.id,
            if rule.name.len() > 28 {
                format!("{}…", &rule.name[..27])
            } else {
                rule.name.clone()
            },
            rule.severity,
        );
    }
    println!("  └────────────────┴──────────────────────────────┴──────────┘");
    println!();

    // -----------------------------------------------------------------------
    // Step 3: Compile with rule-file-appropriate sample data
    // -----------------------------------------------------------------------
    println!("─── Step 3: Compiling to ComplianceBatch ──────────────────────");

    let data = data_fixture_for(&args.file);
    let timestamp = 1742636400; // 2026-03-22 UTC

    let compile_start = Instant::now();
    let batch = arsl::compile_batch(&arsl_file, &data, args.entity_id, timestamp)
        .unwrap_or_else(|e| {
            eprintln!("  ❌ Compilation error: {}", e);
            std::process::exit(1);
        });
    let compile_time = compile_start.elapsed();

    println!("  ✅ Compiled {} rules in {:?}", batch.rules.len(), compile_time);
    println!();

    // -----------------------------------------------------------------------
    // Step 4: Evaluate locally (without zkVM)
    // -----------------------------------------------------------------------
    println!("─── Step 4: Local evaluation (no zkVM) ────────────────────────");
    let eval_start = Instant::now();
    let result = agf_lib::evaluate_batch(&batch);
    let eval_time = eval_start.elapsed();

    println!("  ✅ Evaluated in {:?}", eval_time);
    println!();
    println!("  Decision: {}", if result.all_compliant { "✅ PASS" } else { "🚫 BLOCK" });
    println!("  Total: {} | Pass: {} | Block: {}", result.total_rules, result.pass_count, result.block_count);
    println!();

    for r in &result.results {
        println!(
            "  Rule {:>2}: {} | Value: {:>6} | Threshold: {:>6} | Margin: {:>+8} bp",
            r.rule_id,
            if r.compliant { "✅ PASS " } else { "🚫 BLOCK" },
            r.actual_value,
            r.threshold_used,
            r.margin_bps,
        );
    }

    // -----------------------------------------------------------------------
    // Step 5: Execute inside SP1 zkVM (optional)
    // -----------------------------------------------------------------------
    if args.execute {
        println!();
        println!("─── Step 5: Executing inside SP1 zkVM ─────────────────────────");

        let client = ProverClient::from_env();
        let mut stdin = SP1Stdin::new();
        stdin.write(&batch);

        let exec_start = Instant::now();
        let (output, report) = client.execute(AGF_ELF, stdin).run().unwrap();
        let exec_time = exec_start.elapsed();

        // Read results
        let mut reader = output.as_slice();
        let total: u32 = read_value(&mut reader);
        let pass: u32 = read_value(&mut reader);
        let block: u32 = read_value(&mut reader);
        let all_pass: bool = read_value(&mut reader);

        println!("  ✅ zkVM execution in {:?}", exec_time);
        println!("  Cycles: {} ({} per rule)", report.total_instruction_count(), report.total_instruction_count() / total as u64);
        println!("  Decision: {} | Pass: {} | Block: {}", if all_pass { "✅ PASS" } else { "🚫 BLOCK" }, pass, block);
    }

    println!();
    println!("─── Pipeline Summary ────────────────────────────────────────");
    println!("  ARSL file:   {}", args.file);
    println!("  Parse:       {:?}", parse_time);
    println!("  Compile:     {:?}", compile_time);
    println!("  Evaluate:    {:?}", eval_time);
    println!("  Total:       {:?}", parse_start.elapsed());
}

fn read_value<T: serde::de::DeserializeOwned>(reader: &mut &[u8]) -> T {
    let size = std::mem::size_of::<T>();
    let (bytes, rest) = reader.split_at(size);
    *reader = rest;
    unsafe { std::ptr::read_unaligned(bytes.as_ptr() as *const T) }
}

/// Return a representative data map for a given ARSL rule file path.
///
/// The PASS values are the primary fixture. Where a field intentionally produces
/// a BLOCK (like stress_test_capital for the FCA file), it is noted in comments.
/// The arsl-compile CLI uses these fixtures so every rule file produces
/// meaningful output rather than zeros.
fn data_fixture_for(file_path: &str) -> HashMap<String, u64> {
    let mut d = HashMap::new();

    if file_path.contains("sanctions") {
        // rules/finance/sanctions/hmt.arsl.toml
        // PASS scenario: clean Dutch counterparty, safe name, GBP 5,000
        d.insert("counterparty_jurisdiction_hash".into(), 99u64); // NL — not blocked
        d.insert("ubo_jurisdiction_hash".into(), 99);              // NL
        d.insert("currency_code_hash".into(), 42);                 // EUR — not blocked
        d.insert("counterparty_name_hash".into(), 12345);          // safe name
        d.insert("transaction_amount_gbp".into(), 500_000);        // GBP 5,000 (pence)
    } else if file_path.contains("gdpr") || file_path.contains("consent") {
        // rules/cross_industry/gdpr/consent.arsl.toml
        // PASS scenario: consent given, no erasure, 180 days, not prohibited AI
        d.insert("gdpr_explicit_consent".into(), 1u64);
        d.insert("special_category_consent".into(), 1);
        d.insert("erasure_request_active".into(), 0);   // must be 0 (no active request)
        d.insert("days_since_collection".into(), 180);  // well within 730-day limit
        d.insert("ai_prohibited_category".into(), 0);   // must be 0 (not prohibited)
    } else if file_path.contains("kyc") {
        // rules/finance/kyc/standard_onboarding.arsl.toml
        // PASS scenario: 25-year-old NL applicant, AML 12, verified, no PEP, clean name
        d.insert("customer_age_years".into(), 25u64);   // >= 18
        d.insert("aml_risk_score".into(), 12);           // <= 24
        d.insert("id_verification_passed".into(), 1);
        d.insert("country_of_birth_hash".into(), 77);    // NL — not in restricted list
        d.insert("pep_status".into(), 0);                // must be 0 (not a PEP)
        d.insert("applicant_name_hash".into(), 12345);   // safe name
    } else {
        // Default: rules/fca/consumer_duty.arsl.toml
        // NOTE: stress_test_capital = 480 intentionally blocks (FCA-CD-009)
        d.insert("capital_ratio".into(), 1250u64);       // 12.50% >= 8% PASS
        d.insert("liquidity_coverage".into(), 11500);    // 115% >= 100% PASS
        d.insert("leverage_ratio".into(), 450);          // 4.50% >= 3% PASS
        d.insert("net_stable_funding".into(), 10800);    // 108% >= 100% PASS
        d.insert("large_exposure".into(), 1800);         // 18% in [0,25%] PASS
        d.insert("ict_report_time".into(), 3600);        // 1h in [0,4h] PASS
        d.insert("solvency_ratio".into(), 17500);        // 175% >= 150% PASS
        d.insert("tier1_capital".into(), 950);           // 9.5% >= 6% PASS
        d.insert("countercyclical_buffer".into(), 250);  // 2.5% >= 0% PASS
        d.insert("stress_test_capital".into(), 480);     // 4.80% < 5.50% BLOCK (intentional)
    }

    d
}
