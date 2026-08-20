//! AGF Server — End-to-End Integration Tests
//!
//! These tests exercise the full server stack in-process (no separate server needed).
//! Each test builds the Axum router directly and dispatches requests via tower::ServiceExt.
//!
//! Tests:
//!   1. Health endpoint returns correct version
//!   2. Single-vertical evaluation (FCA Capital)
//!   3. Multi-vertical evaluation (all 4 verticals, 26 rules)
//!   4. Audit log chain integrity across multiple evaluations
//!   5. Ed25519 signature verification roundtrip
//!   6. Sanctions hit produces BLOCK decision
//!   7. Invalid rule file returns 400 error

use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::{get, post},
    Router,
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tower::ServiceExt;

// Pull in the server's public types
use agf_server::{AgfSigner, AppState, AuditLog};

// Re-declare the route handlers (they use the public api module)
mod helpers {
    use super::*;
    use std::sync::Once;

    /// Ensure we only change CWD once (to the workspace root where `rules/` lives).
    static SET_CWD: Once = Once::new();

    fn ensure_cwd() {
        SET_CWD.call_once(|| {
            // CARGO_MANIFEST_DIR points to server/ — rules are at ../rules/
            let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
                .expect("CARGO_MANIFEST_DIR not set");
            let workspace_root = std::path::Path::new(&manifest_dir)
                .parent()
                .expect("server/ should have a parent directory");
            std::env::set_current_dir(workspace_root)
                .expect("Failed to set CWD to workspace root");
        });
    }

    /// Build a fresh app router with independent state (clean audit log, ephemeral key).
    pub fn build_app() -> Router {
        ensure_cwd();

        let signer = AgfSigner::from_env_or_generate();
        let state = AppState {
            audit: Arc::new(Mutex::new(AuditLog::new())),
            signer: Arc::new(signer),
        };

        Router::new()
            .route("/health", get(agf_server::api::health))
            .route("/evaluate", post(agf_server::api::evaluate))
            .route("/evaluate-entity", post(agf_server::api::evaluate_entity))
            .route("/audit-log", get(agf_server::api::get_audit_log))
            .route("/public-key", get(agf_server::api::get_public_key))
            .with_state(state)
    }

    /// Send a GET request and return (status, body as Value).
    pub async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
        let req = Request::builder()
            .uri(uri)
            .body(Body::empty())
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        let status = resp.status();
        let body = resp.into_body().collect().await.unwrap().to_bytes();
        let value: Value = serde_json::from_slice(&body).unwrap();
        (status, value)
    }

    /// Send a POST request with JSON body and return (status, body as Value).
    pub async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
        let req = Request::builder()
            .method("POST")
            .uri(uri)
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&body).unwrap()))
            .unwrap();

        let resp = app.clone().oneshot(req).await.unwrap();
        let status = resp.status();
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        // Try to parse as JSON; if it fails, wrap the raw text
        match serde_json::from_slice(&bytes) {
            Ok(v) => (status, v),
            Err(_) => (status, Value::String(String::from_utf8_lossy(&bytes).to_string())),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Health endpoint
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_health_endpoint() {
    let app = helpers::build_app();
    let (status, body) = helpers::get_json(&app, "/health").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["version"], "0.1.0");
    assert!(body["description"].as_str().unwrap().contains("AGF"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Single-vertical evaluation (FCA Capital)
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_evaluate_single_vertical_fca() {
    let app = helpers::build_app();

    let body = json!({
        "rule_file": "rules/finance/fca/consumer_duty.arsl.toml",
        "entity_id": 9001,
        "data": {
            "capital_ratio": 1250,
            "liquidity_coverage": 11500,
            "leverage_ratio": 450,
            "net_stable_funding": 10800,
            "large_exposure": 1800,
            "ict_report_time": 3600,
            "solvency_ratio": 17500,
            "tier1_capital": 950,
            "countercyclical_buffer": 250,
            "stress_test_capital": 600
        }
    });

    let (status, resp) = helpers::post_json(&app, "/evaluate", body).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(resp["decision"], "PASS");
    assert_eq!(resp["total_rules"], 10);
    assert_eq!(resp["pass_count"], 10);
    assert_eq!(resp["block_count"], 0);
    assert!(resp["evaluation_ms"].as_f64().unwrap() >= 0.0);

    // Verify audit fields are present
    assert!(resp["audit"]["log_id"].as_u64().is_some());
    assert!(resp["audit"]["proof_hash"].as_str().unwrap().starts_with("blake3:"));
    assert!(resp["audit"]["chain_hash"].as_str().unwrap().starts_with("blake3:"));
    assert!(!resp["audit"]["timestamp_utc"].as_str().unwrap().is_empty());

    // Verify signature is present
    assert!(resp["signature"].as_str().unwrap().starts_with("ed25519:"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Multi-vertical evaluation (all 4 verticals, 26 rules)
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_evaluate_entity_multi_vertical() {
    let app = helpers::build_app();

    let body = json!({
        "entity_id": 9001,
        "entity_name": "Test Corp",
        "rule_files": [
            "rules/finance/kyc/standard_onboarding.arsl.toml",
            "rules/finance/sanctions/hmt.arsl.toml",
            "rules/finance/fca/consumer_duty.arsl.toml",
            "rules/cross_industry/gdpr/consent.arsl.toml"
        ],
        "data": {
            "customer_age_years": 30,
            "aml_risk_score": 10,
            "id_verification_passed": 1,
            "country_of_birth_hash": 77,
            "pep_status": 0,
            "applicant_name_hash": 12345,
            "counterparty_jurisdiction_hash": 99,
            "ubo_jurisdiction_hash": 99,
            "currency_code_hash": 42,
            "counterparty_name_hash": 12345,
            "transaction_amount_gbp": 500000,
            "capital_ratio": 1250,
            "liquidity_coverage": 11500,
            "leverage_ratio": 450,
            "net_stable_funding": 10800,
            "large_exposure": 1800,
            "ict_report_time": 3600,
            "solvency_ratio": 17500,
            "tier1_capital": 950,
            "countercyclical_buffer": 250,
            "stress_test_capital": 600,
            "gdpr_explicit_consent": 1,
            "special_category_consent": 1,
            "erasure_request_active": 0,
            "days_since_collection": 180,
            "ai_prohibited_category": 0
        }
    });

    let (status, resp) = helpers::post_json(&app, "/evaluate-entity", body).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(resp["overall_decision"], "PASS");
    assert_eq!(resp["entity_name"], "Test Corp");
    assert_eq!(resp["entity_id"], 9001);

    // All 4 verticals should be present: 6 + 5 + 10 + 5 = 26 rules
    assert_eq!(resp["total_rules"], 26);
    assert_eq!(resp["total_pass"], 26);
    assert_eq!(resp["total_block"], 0);

    let verticals = resp["verticals"].as_array().unwrap();
    assert_eq!(verticals.len(), 4);

    // Each vertical should have PASS decision
    for v in verticals {
        assert_eq!(v["decision"], "PASS");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Audit log chain integrity
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_audit_log_chain_integrity() {
    let app = helpers::build_app();

    // Send 3 evaluations with different inputs to populate the audit log
    let all_pass = json!({
        "rule_file": "rules/finance/fca/consumer_duty.arsl.toml",
        "entity_id": 1001,
        "data": {
            "capital_ratio": 1250, "liquidity_coverage": 11500,
            "leverage_ratio": 450, "net_stable_funding": 10800,
            "large_exposure": 1800, "ict_report_time": 3600,
            "solvency_ratio": 17500, "tier1_capital": 950,
            "countercyclical_buffer": 250, "stress_test_capital": 600
        }
    });

    let with_block = json!({
        "rule_file": "rules/finance/fca/consumer_duty.arsl.toml",
        "entity_id": 1002,
        "data": {
            "capital_ratio": 1250, "liquidity_coverage": 11500,
            "leverage_ratio": 450, "net_stable_funding": 10800,
            "large_exposure": 1800, "ict_report_time": 3600,
            "solvency_ratio": 17500, "tier1_capital": 950,
            "countercyclical_buffer": 250, "stress_test_capital": 480
        }
    });

    // Eval 1: PASS
    let (s1, _) = helpers::post_json(&app, "/evaluate", all_pass.clone()).await;
    assert_eq!(s1, StatusCode::OK);

    // Eval 2: BLOCK (stress_test_capital = 480 < 550)
    let (s2, r2) = helpers::post_json(&app, "/evaluate", with_block).await;
    assert_eq!(s2, StatusCode::OK);
    assert_eq!(r2["decision"], "BLOCK");

    // Eval 3: PASS again
    let (s3, _) = helpers::post_json(&app, "/evaluate", all_pass).await;
    assert_eq!(s3, StatusCode::OK);

    // Fetch the audit log
    let (status, log) = helpers::get_json(&app, "/audit-log").await;
    assert_eq!(status, StatusCode::OK);

    let entries = log.as_array().unwrap();
    assert_eq!(entries.len(), 3);

    // Verify sequential log IDs
    assert_eq!(entries[0]["log_id"], 1);
    assert_eq!(entries[1]["log_id"], 2);
    assert_eq!(entries[2]["log_id"], 3);

    // Verify chain integrity: recompute blake3 chain hashes
    let genesis = blake3::hash(b"AGF-IAL-GENESIS-v1");
    let mut prev_chain = format!("blake3:{}", genesis.to_hex());

    for entry in entries {
        let chain_input = format!(
            "{}||{}||{}||{}||{}||{}",
            prev_chain,
            entry["log_id"].as_u64().unwrap(),
            entry["entity_id"].as_u64().unwrap(),
            entry["decision"].as_str().unwrap(),
            entry["proof_hash"].as_str().unwrap(),
            entry["timestamp_utc"].as_str().unwrap(),
        );
        let expected = format!("blake3:{}", blake3::hash(chain_input.as_bytes()).to_hex());
        assert_eq!(
            entry["chain_hash"].as_str().unwrap(),
            expected,
            "Chain hash mismatch at log_id {}",
            entry["log_id"]
        );
        prev_chain = expected;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Ed25519 signature verification roundtrip
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_signature_verification_roundtrip() {
    let app = helpers::build_app();

    // Evaluate a rule set
    let body = json!({
        "rule_file": "rules/cross_industry/gdpr/consent.arsl.toml",
        "entity_id": 5001,
        "data": {
            "gdpr_explicit_consent": 1,
            "special_category_consent": 1,
            "erasure_request_active": 0,
            "days_since_collection": 180,
            "ai_prohibited_category": 0
        }
    });

    let (status, resp) = helpers::post_json(&app, "/evaluate", body).await;
    assert_eq!(status, StatusCode::OK);

    // Fetch the server's public key
    let (pk_status, pk_resp) = helpers::get_json(&app, "/public-key").await;
    assert_eq!(pk_status, StatusCode::OK);
    assert_eq!(pk_resp["algorithm"], "Ed25519");

    // Independently verify the Ed25519 signature
    let proof_hash = resp["audit"]["proof_hash"].as_str().unwrap();
    let chain_hash = resp["audit"]["chain_hash"].as_str().unwrap();
    let timestamp = resp["audit"]["timestamp_utc"].as_str().unwrap();
    let msg = format!("AGF-EVAL-V1:{}:{}:{}", proof_hash, chain_hash, timestamp);

    let sig_hex = resp["signature"].as_str().unwrap();
    let sig_hex_clean = sig_hex.strip_prefix("ed25519:").unwrap();
    let pk_hex = pk_resp["public_key"].as_str().unwrap();
    let pk_hex_clean = pk_hex.strip_prefix("ed25519:").unwrap();

    let sig_bytes: [u8; 64] = hex::decode(sig_hex_clean)
        .unwrap()
        .try_into()
        .unwrap();
    let pk_bytes: [u8; 32] = hex::decode(pk_hex_clean)
        .unwrap()
        .try_into()
        .unwrap();

    use ed25519_dalek::{Signature, Verifier, VerifyingKey};
    let vk = VerifyingKey::from_bytes(&pk_bytes).unwrap();
    let sig = Signature::from_bytes(&sig_bytes);

    vk.verify(msg.as_bytes(), &sig)
        .expect("Ed25519 signature verification should pass");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: Sanctions hit produces BLOCK decision
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_block_decision_on_sanctions_hit() {
    let app = helpers::build_app();

    let body = json!({
        "rule_file": "rules/finance/sanctions/hmt.arsl.toml",
        "entity_id": 7001,
        "data": {
            "counterparty_jurisdiction_hash": 18,
            "ubo_jurisdiction_hash": 99,
            "currency_code_hash": 42,
            "counterparty_name_hash": 12345,
            "transaction_amount_gbp": 500000
        }
    });

    let (status, resp) = helpers::post_json(&app, "/evaluate", body).await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(resp["decision"], "BLOCK");
    assert_eq!(resp["total_rules"], 5);
    assert_eq!(resp["pass_count"], 4);
    assert_eq!(resp["block_count"], 1);

    // Find the blocked rule — it should be the jurisdiction check
    let rules = resp["rules"].as_array().unwrap();
    let blocked: Vec<&Value> = rules.iter().filter(|r| !r["compliant"].as_bool().unwrap()).collect();
    assert_eq!(blocked.len(), 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 7: Invalid rule file returns error
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_invalid_rule_file_returns_error() {
    let app = helpers::build_app();

    let body = json!({
        "rule_file": "rules/nonexistent/fake.arsl.toml",
        "entity_id": 1,
        "data": {}
    });

    let (status, _) = helpers::post_json(&app, "/evaluate", body).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
