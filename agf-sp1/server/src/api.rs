//! AGF Server — API Handlers (with Ed25519 signing)

use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;

use agf_lib::{arsl, evaluate_batch};

use crate::audit::AuditEntry;
use crate::signing;
use crate::tee;
use crate::AppState;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EvaluateRequest {
    pub rule_file: String,
    pub entity_id: u32,
    pub data: HashMap<String, u64>,
}

#[derive(Debug, Serialize)]
pub struct RuleResult {
    pub rule_id: u32,
    pub compliant: bool,
    pub actual_value: u64,
    pub margin_bps: i64,
}

#[derive(Debug, Serialize)]
pub struct AuditInfo {
    pub log_id: u64,
    pub proof_hash: String,
    pub chain_hash: String,
    pub timestamp_utc: String,
    pub tee_attestation: tee::AttestationReport,
}

#[derive(Debug, Serialize)]
pub struct EvaluateResponse {
    pub decision: String,
    pub total_rules: u32,
    pub pass_count: u32,
    pub block_count: u32,
    pub evaluation_ms: f64,
    pub rules: Vec<RuleResult>,
    pub audit: AuditInfo,
    /// Ed25519 signature over "AGF-EVAL-V1:{proof_hash}:{chain_hash}:{timestamp_utc}"
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub description: &'static str,
}

#[derive(Debug, Serialize)]
pub struct PublicKeyResponse {
    pub public_key: String,
    pub algorithm: &'static str,
    pub description: &'static str,
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: "0.1.0",
        description: "AGF Compliance Engine — Phase 3 (OpenSpec v2.0)",
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /public-key
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_public_key(State(state): State<AppState>) -> Json<PublicKeyResponse> {
    Json(PublicKeyResponse {
        public_key: state.signer.public_key_hex(),
        algorithm: "Ed25519",
        description: "AGF server signing key. Use agf-verify to validate evaluation results.",
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /audit-log
// ─────────────────────────────────────────────────────────────────────────────

pub async fn get_audit_log(State(state): State<AppState>) -> Json<Vec<AuditEntry>> {
    let log = state.audit.lock().expect("audit lock poisoned");
    Json(log.entries().to_vec())
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /evaluate
// ─────────────────────────────────────────────────────────────────────────────

pub async fn evaluate(
    State(state): State<AppState>,
    Json(req): Json<EvaluateRequest>,
) -> Result<Json<EvaluateResponse>, (StatusCode, String)> {

    // ── 1. Load and validate ARSL ─────────────────────────────────────────────
    let toml_str = std::fs::read_to_string(&req.rule_file)
        .map_err(|e| (StatusCode::BAD_REQUEST,
            format!("Cannot read rule file '{}': {}", req.rule_file, e)))?;

    let arsl_file = arsl::parse_arsl(&toml_str)
        .map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY, format!("ARSL parse error: {}", e)))?;

    arsl::validate(&arsl_file)
        .map_err(|errs| (StatusCode::UNPROCESSABLE_ENTITY,
            format!("ARSL validation errors: {}",
                errs.iter().map(|e| e.to_string()).collect::<Vec<_>>().join("; "))))?;

    // ── 2. Compile ────────────────────────────────────────────────────────────
    let timestamp = Utc::now().timestamp() as u64;
    let batch = arsl::compile_batch(&arsl_file, &req.data, req.entity_id, timestamp)
        .map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY, format!("Compilation error: {}", e)))?;

    // ── 3. Evaluate ───────────────────────────────────────────────────────────
    let t0 = Instant::now();
    let result = evaluate_batch(&batch);
    let eval_ms = t0.elapsed().as_secs_f64() * 1000.0;

    // ── 4. Proof hash ─────────────────────────────────────────────────────────
    let proof_input = format!(
        "{}:{}:{}:{}",
        req.rule_file, req.entity_id, result.pass_count, result.block_count
    );
    let proof_hash = format!("blake3:{}", blake3::hash(proof_input.as_bytes()).to_hex());

    // ── 5. TEE attestation stub ───────────────────────────────────────────────
    let attestation = tee::generate_attestation_stub(proof_hash.as_bytes());

    // ── 6. Append to IAL ─────────────────────────────────────────────────────
    let timestamp_utc = Utc::now().to_rfc3339();
    let decision_str = if result.all_compliant { "PASS" } else { "BLOCK" };

    let audit_entry = {
        let mut log = state.audit.lock().expect("audit lock poisoned");
        log.append(req.entity_id, decision_str, &req.rule_file, &proof_hash, &timestamp_utc)
    };

    // ── 7. Sign the result ────────────────────────────────────────────────────
    let msg = signing::signing_message(&proof_hash, &audit_entry.chain_hash, &timestamp_utc);
    let signature = state.signer.sign(&msg);

    // ── 8. Assemble response ──────────────────────────────────────────────────
    let rules: Vec<RuleResult> = result.results.iter().map(|r| RuleResult {
        rule_id: r.rule_id,
        compliant: r.compliant,
        actual_value: r.actual_value,
        margin_bps: r.margin_bps,
    }).collect();

    Ok(Json(EvaluateResponse {
        decision: decision_str.into(),
        total_rules: result.total_rules,
        pass_count: result.pass_count,
        block_count: result.block_count,
        evaluation_ms: (eval_ms * 1000.0).round() / 1000.0,
        rules,
        signature,
        audit: AuditInfo {
            log_id: audit_entry.log_id,
            proof_hash,
            chain_hash: audit_entry.chain_hash.clone(),
            timestamp_utc,
            tee_attestation: attestation,
        },
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /evaluate-entity  — multi-vertical evaluation
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EvaluateEntityRequest {
    pub entity_id: u32,
    pub entity_name: String,
    pub rule_files: Vec<String>,
    pub data: HashMap<String, u64>,
}

#[derive(Debug, Serialize)]
pub struct VerticalResult {
    pub rule_file: String,
    pub vertical: String,
    pub decision: String,
    pub total_rules: u32,
    pub pass_count: u32,
    pub block_count: u32,
    pub evaluation_ms: f64,
    pub rules: Vec<RuleResult>,
}

#[derive(Debug, Serialize)]
pub struct EvaluateEntityResponse {
    pub entity_id: u32,
    pub entity_name: String,
    pub overall_decision: String,
    pub verticals: Vec<VerticalResult>,
    pub total_rules: u32,
    pub total_pass: u32,
    pub total_block: u32,
    pub evaluation_ms: f64,
    pub audit: AuditInfo,
    pub signature: String,
}

pub async fn evaluate_entity(
    State(state): State<AppState>,
    Json(req): Json<EvaluateEntityRequest>,
) -> Result<Json<EvaluateEntityResponse>, (StatusCode, String)> {

    if req.rule_files.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "rule_files must not be empty".into()));
    }

    let mut verticals: Vec<VerticalResult> = Vec::new();
    let mut grand_total = 0u32;
    let mut grand_pass  = 0u32;
    let mut grand_block = 0u32;
    let mut total_eval_ms = 0.0f64;
    let mut proof_parts: Vec<String> = Vec::new();

    for rule_file in &req.rule_files {
        // ── Load + parse + validate ──────────────────────────────────────────
        let toml_str = std::fs::read_to_string(rule_file)
            .map_err(|e| (StatusCode::BAD_REQUEST,
                format!("Cannot read '{}': {}", rule_file, e)))?;

        let arsl_file = arsl::parse_arsl(&toml_str)
            .map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY,
                format!("ARSL parse error in '{}': {}", rule_file, e)))?;

        arsl::validate(&arsl_file)
            .map_err(|errs| (StatusCode::UNPROCESSABLE_ENTITY,
                format!("ARSL validation errors in '{}': {}",
                    rule_file,
                    errs.iter().map(|e| e.to_string()).collect::<Vec<_>>().join("; "))))?;

        // ── Compile + evaluate ───────────────────────────────────────────────
        let timestamp = Utc::now().timestamp() as u64;
        let batch = arsl::compile_batch(&arsl_file, &req.data, req.entity_id, timestamp)
            .map_err(|e| (StatusCode::UNPROCESSABLE_ENTITY,
                format!("Compilation error in '{}': {}", rule_file, e)))?;

        let t0 = Instant::now();
        let result = evaluate_batch(&batch);
        let eval_ms = t0.elapsed().as_secs_f64() * 1000.0;

        // ── Accumulate ───────────────────────────────────────────────────────
        grand_total += result.total_rules;
        grand_pass  += result.pass_count;
        grand_block += result.block_count;
        total_eval_ms += eval_ms;

        let decision_str = if result.all_compliant { "PASS" } else { "BLOCK" };
        let vertical_name = arsl_file.metadata.regulation.clone();

        proof_parts.push(format!("{}:{}:{}:{}", rule_file, result.pass_count, result.block_count, decision_str));

        let rules: Vec<RuleResult> = result.results.iter().map(|r| RuleResult {
            rule_id: r.rule_id,
            compliant: r.compliant,
            actual_value: r.actual_value,
            margin_bps: r.margin_bps,
        }).collect();

        verticals.push(VerticalResult {
            rule_file: rule_file.clone(),
            vertical: vertical_name,
            decision: decision_str.into(),
            total_rules: result.total_rules,
            pass_count: result.pass_count,
            block_count: result.block_count,
            evaluation_ms: (eval_ms * 1000.0).round() / 1000.0,
            rules,
        });
    }

    // ── Combined proof hash ──────────────────────────────────────────────────
    let overall_decision = if grand_block == 0 { "PASS" } else { "BLOCK" };
    let combined_input = format!(
        "entity:{}:{}:{}",
        req.entity_id,
        overall_decision,
        proof_parts.join("|")
    );
    let proof_hash = format!("blake3:{}", blake3::hash(combined_input.as_bytes()).to_hex());

    // ── TEE attestation ──────────────────────────────────────────────────────
    let attestation = tee::generate_attestation_stub(proof_hash.as_bytes());

    // ── Append to IAL ────────────────────────────────────────────────────────
    let timestamp_utc = Utc::now().to_rfc3339();
    let audit_entry = {
        let mut log = state.audit.lock().expect("audit lock poisoned");
        log.append(req.entity_id, overall_decision, "multi-vertical", &proof_hash, &timestamp_utc)
    };

    // ── Sign ─────────────────────────────────────────────────────────────────
    let msg = signing::signing_message(&proof_hash, &audit_entry.chain_hash, &timestamp_utc);
    let signature = state.signer.sign(&msg);

    Ok(Json(EvaluateEntityResponse {
        entity_id: req.entity_id,
        entity_name: req.entity_name,
        overall_decision: overall_decision.into(),
        verticals,
        total_rules: grand_total,
        total_pass: grand_pass,
        total_block: grand_block,
        evaluation_ms: (total_eval_ms * 1000.0).round() / 1000.0,
        signature,
        audit: AuditInfo {
            log_id: audit_entry.log_id,
            proof_hash,
            chain_hash: audit_entry.chain_hash.clone(),
            timestamp_utc,
            tee_attestation: attestation,
        },
    }))
}

