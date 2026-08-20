//! TEE Attestation — Stub for AWS Nitro Enclave Integration
//!
//! This module documents the attestation API surface and provides a testable mock
//! implementation. In a production deployment inside an AWS Nitro Enclave, the
//! `generate_attestation_stub` function would be replaced by a call to the Nitro
//! Secure Module (NSM) API, which produces a signed COSE_Sign1 document containing:
//!
//!   - PCR0–PCR2: hashes of the enclave image, kernel, and boot state
//!   - Nonce: the caller-supplied payload hash (binds the report to this evaluation)
//!   - Certificate chain: rooted at the AWS Nitro CA
//!
//! The verifier (regulator / auditor) can:
//!   1. Verify the certificate chain against the public AWS Nitro root CA
//!   2. Check PCR0 matches the expected enclave image hash (published separately)
//!   3. Confirm the nonce matches the proof_hash in the audit log entry
//!
//! Reference: AGF OpenSpec v2.0 §9.4 — TEE Attestation Design
//! Production path: https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclave-concepts.html

use chrono::Utc;
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Attestation Report
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttestationReport {
    /// The type of attestation.
    /// "mock" in this stub; "nitro" in production.
    pub enclave_type: String,

    /// Blake3 hash of the payload bound to this report.
    /// In production this would be the NSM document nonce field.
    pub payload_hash: String,

    /// Simulated PCR0 — in production this would be the SHA-384 of the enclave image.
    /// A fixed placeholder allows tests to assert the field is present and non-empty.
    pub pcr0: String,

    /// RFC-3339 timestamp when this report was generated.
    pub timestamp_utc: String,

    /// Human-readable note explaining the production path.
    pub note: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/// Generate a mock attestation report binding the given payload to a stub enclave.
///
/// # Arguments
/// * `payload` — arbitrary bytes to bind (typically the proof_hash as bytes).
///
/// # Production replacement
/// Replace the body of this function with:
/// ```no_run
/// // let nsm = aws_nitro_enclaves_nsm_api::driver::nsm_init();
/// // let request = aws_nitro_enclaves_nsm_api::api::Request::Attestation {
/// //     nonce: Some(payload.to_vec()),
/// //     user_data: None,
/// //     public_key: None,
/// // };
/// // let response = aws_nitro_enclaves_nsm_api::driver::nsm_process_request(nsm, request);
/// // // Parse response.document → COSE_Sign1 → AttestationReport fields
/// ```
pub fn generate_attestation_stub(payload: &[u8]) -> AttestationReport {
    let payload_hash = format!("blake3:{}", blake3::hash(payload).to_hex());

    // Simulated PCR0: blake3 of a fixed enclave build string
    // In production: SHA-384 of the EIF (Enclave Image File)
    let pcr0 = format!(
        "blake3:{}",
        blake3::hash(b"AGF-ENCLAVE-IMAGE-v0.1.0-PLACEHOLDER").to_hex()
    );

    AttestationReport {
        enclave_type: "mock".into(),
        payload_hash,
        pcr0,
        timestamp_utc: Utc::now().to_rfc3339(),
        note: concat!(
            "This is a mock attestation stub for the AGF MVP. ",
            "Production deployment requires AWS Nitro Enclave hardware. ",
            "See AGF OpenSpec v2.0 §9.4 for the production integration path."
        ).into(),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_attestation_report_fields_present() {
        let report = generate_attestation_stub(b"test-payload");
        assert_eq!(report.enclave_type, "mock");
        assert!(report.payload_hash.starts_with("blake3:"));
        assert!(report.pcr0.starts_with("blake3:"));
        assert!(!report.timestamp_utc.is_empty());
        assert!(!report.note.is_empty());
    }

    #[test]
    fn test_payload_hash_is_deterministic() {
        let a = generate_attestation_stub(b"same-payload");
        let b = generate_attestation_stub(b"same-payload");
        // payload_hash is blake3 of same input — must be identical
        assert_eq!(a.payload_hash, b.payload_hash);
        // pcr0 is also deterministic (same placeholder)
        assert_eq!(a.pcr0, b.pcr0);
    }

    #[test]
    fn test_different_payloads_produce_different_hashes() {
        let a = generate_attestation_stub(b"payload-a");
        let b = generate_attestation_stub(b"payload-b");
        assert_ne!(a.payload_hash, b.payload_hash);
    }

    #[test]
    fn test_enclave_type_is_mock() {
        let report = generate_attestation_stub(b"x");
        assert_eq!(report.enclave_type, "mock",
            "Production should change this to 'nitro'");
    }
}
