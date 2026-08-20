//! agf-demo — End-to-end demo of the AGF Compliance Engine
//!
//! Evaluates "Acme Financial Ltd" across all 4 verticals (26 rules) in one call,
//! pretty-prints the results, saves the signed audit bundle, and verifies it.
//!
//! Usage:
//!   cargo run --release --bin agf-demo -- --server http://localhost:3000

use clap::Parser;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Parser)]
#[command(name = "agf-demo")]
#[command(about = "AGF Compliance Engine — End-to-end demo scenario")]
struct Cli {
    /// Server URL
    #[arg(long, default_value = "http://localhost:3000")]
    server: String,

    /// Save result to file
    #[arg(long, default_value = "demo_result.json")]
    output: String,
}

#[derive(Debug, Serialize)]
struct DemoRequest {
    entity_id: u32,
    entity_name: String,
    rule_files: Vec<String>,
    data: HashMap<String, u64>,
}

fn main() {
    let cli = Cli::parse();

    println!();
    println!("╔══════════════════════════════════════════════════════════════════╗");
    println!("║  AGF Compliance Engine — Phase 4 Demo                          ║");
    println!("║  Entity: Acme Financial Ltd (ID: 9001)                         ║");
    println!("║  Verticals: KYC · Sanctions · FCA Capital · GDPR               ║");
    println!("╚══════════════════════════════════════════════════════════════════╝");
    println!();

    // ── Build the demo entity ────────────────────────────────────────────────
    let mut data: HashMap<String, u64> = HashMap::new();

    // KYC fields
    data.insert("customer_age_years".into(), 34);
    data.insert("aml_risk_score".into(), 12);
    data.insert("id_verification_passed".into(), 1);
    data.insert("country_of_birth_hash".into(), 826);    // UK
    data.insert("pep_status".into(), 0);                  // Not a PEP
    data.insert("applicant_name_hash".into(), 98765);     // Not on sanctions list

    // Sanctions fields
    data.insert("counterparty_jurisdiction_hash".into(), 99);  // Clean jurisdiction
    data.insert("ubo_jurisdiction_hash".into(), 99);           // Clean UBO jurisdiction
    data.insert("currency_code_hash".into(), 42);              // GBP
    data.insert("counterparty_name_hash".into(), 12345);       // Not on OFAC SDN
    data.insert("transaction_amount_gbp".into(), 500_000);     // GBP 5,000 (in pence)

    // FCA Capital fields
    data.insert("capital_ratio".into(), 1200);             // 12.0% (> 8.0%)
    data.insert("liquidity_coverage".into(), 13500);       // 135% (> 100%)
    data.insert("leverage_ratio".into(), 450);             // 4.5% (> 3.0%)
    data.insert("net_stable_funding".into(), 11200);       // 112% (> 100%)
    data.insert("large_exposure".into(), 1800);            // 18.0% (< 25.0%)
    data.insert("ict_report_time".into(), 7200);           // 2 hours (< 4 hours)
    data.insert("solvency_ratio".into(), 22000);           // 220% (> 150%)
    data.insert("tier1_capital".into(), 950);              // 9.5% (> 6.0%)
    data.insert("countercyclical_buffer".into(), 100);     // 1.0% (> 0%)
    data.insert("stress_test_capital".into(), 680);        // 6.8% (> 5.5%)

    // GDPR fields
    data.insert("gdpr_explicit_consent".into(), 1);
    data.insert("special_category_consent".into(), 1);
    data.insert("erasure_request_active".into(), 0);       // No active erasure request
    data.insert("days_since_collection".into(), 180);      // 6 months (< 730 days)
    data.insert("ai_prohibited_category".into(), 0);       // Not a prohibited AI system

    let request = DemoRequest {
        entity_id: 9001,
        entity_name: "Acme Financial Ltd".into(),
        rule_files: vec![
            "rules/finance/kyc/standard_onboarding.arsl.toml".into(),
            "rules/finance/sanctions/hmt.arsl.toml".into(),
            "rules/finance/fca/consumer_duty.arsl.toml".into(),
            "rules/cross_industry/gdpr/consent.arsl.toml".into(),
        ],
        data,
    };

    // ── Call /evaluate-entity ─────────────────────────────────────────────────
    let url = format!("{}/evaluate-entity", cli.server);
    println!("  ▸ Calling POST {}", url);
    println!();

    let body = serde_json::to_string(&request).expect("serialize request");
    let resp = ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_string(&body);

    let response: Value = match resp {
        Ok(r) => r.into_json().expect("parse response JSON"),
        Err(ureq::Error::Status(code, r)) => {
            let body = r.into_string().unwrap_or_default();
            eprintln!("  ❌ Server returned HTTP {}: {}", code, body);
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("  ❌ Connection error: {}", e);
            eprintln!("     Is the server running at {}?", cli.server);
            std::process::exit(1);
        }
    };

    // ── Pretty-print results ─────────────────────────────────────────────────
    let overall = response["overall_decision"].as_str().unwrap_or("?");
    let total_rules = response["total_rules"].as_u64().unwrap_or(0);
    let total_pass = response["total_pass"].as_u64().unwrap_or(0);
    let _total_block = response["total_block"].as_u64().unwrap_or(0);
    let eval_ms = response["evaluation_ms"].as_f64().unwrap_or(0.0);

    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("  Entity:   {} (ID: {})", response["entity_name"].as_str().unwrap_or("?"), response["entity_id"]);
    println!("  Overall:  {} ({}/{} rules in {:.3}ms)", 
        if overall == "PASS" { "✅ PASS" } else { "❌ BLOCK" },
        total_pass, total_rules, eval_ms);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!();

    if let Some(verticals) = response["verticals"].as_array() {
        for v in verticals {
            let icon = if v["decision"].as_str() == Some("PASS") { "✅" } else { "❌" };
            let vname = v["vertical"].as_str().unwrap_or("?");
            let vpass = v["pass_count"].as_u64().unwrap_or(0);
            let vtotal = v["total_rules"].as_u64().unwrap_or(0);
            let vms = v["evaluation_ms"].as_f64().unwrap_or(0.0);

            println!("  {} {} — {}/{} rules ({:.3}ms)", icon, vname, vpass, vtotal, vms);

            if let Some(rules) = v["rules"].as_array() {
                for r in rules {
                    let compliant = r["compliant"].as_bool().unwrap_or(false);
                    let rule_icon = if compliant { "  ✓" } else { "  ✗" };
                    let margin = r["margin_bps"].as_i64().unwrap_or(0);
                    println!("    {} Rule {} — margin: {:+} bps", rule_icon, r["rule_id"], margin);
                }
            }
            println!();
        }
    }

    // ── Audit summary ────────────────────────────────────────────────────────
    println!("━━ Audit Bundle ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("  Log ID:      {}", response["audit"]["log_id"]);
    println!("  Proof hash:  {}", response["audit"]["proof_hash"].as_str().unwrap_or("?"));
    println!("  Chain hash:  {}", response["audit"]["chain_hash"].as_str().unwrap_or("?"));
    println!("  Timestamp:   {}", response["audit"]["timestamp_utc"].as_str().unwrap_or("?"));
    println!("  Signature:   {}...", &response["signature"].as_str().unwrap_or("?")[..40]);
    println!();

    // ── Save result ──────────────────────────────────────────────────────────
    let pretty = serde_json::to_string_pretty(&response).expect("serialize");
    std::fs::write(&cli.output, &pretty).expect("write output file");
    println!("  📄 Result saved to {}", cli.output);
    println!();

    // ── Verify signature ─────────────────────────────────────────────────────
    println!("━━ Signature Verification ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    let pk_url = format!("{}/public-key", cli.server);
    let pk_resp: Value = ureq::get(&pk_url)
        .call()
        .expect("GET /public-key")
        .into_json()
        .expect("parse public key");

    let pk_hex = pk_resp["public_key"].as_str().unwrap_or("");
    println!("  Server key:  {}", pk_hex);

    // Reconstruct the signing message and verify
    let proof_hash = response["audit"]["proof_hash"].as_str().unwrap_or("");
    let chain_hash = response["audit"]["chain_hash"].as_str().unwrap_or("");
    let timestamp = response["audit"]["timestamp_utc"].as_str().unwrap_or("");
    let msg = format!("AGF-EVAL-V1:{}:{}:{}", proof_hash, chain_hash, timestamp);

    let sig_hex = response["signature"].as_str().unwrap_or("");
    let sig_hex_clean = sig_hex.strip_prefix("ed25519:").unwrap_or(sig_hex);
    let pk_hex_clean = pk_hex.strip_prefix("ed25519:").unwrap_or(pk_hex);

    let sig_bytes = hex::decode(sig_hex_clean).expect("decode sig hex");
    let pk_bytes = hex::decode(pk_hex_clean).expect("decode pk hex");

    use ed25519_dalek::{Signature, Verifier, VerifyingKey};
    let verifying_key = VerifyingKey::from_bytes(&pk_bytes.try_into().expect("32 bytes")).expect("valid pk");
    let signature = Signature::from_bytes(&sig_bytes.try_into().expect("64 bytes"));

    match verifying_key.verify(msg.as_bytes(), &signature) {
        Ok(_) => println!("  ✅ Ed25519 signature VALID"),
        Err(_) => {
            println!("  ❌ Ed25519 signature INVALID");
            std::process::exit(1);
        }
    }

    println!();
    println!("══════════════════════════════════════════════════════════════════");
    println!("  ✅ DEMO COMPLETE — {} rules evaluated, signed, verified", total_rules);
    println!("══════════════════════════════════════════════════════════════════");
    println!();
}
