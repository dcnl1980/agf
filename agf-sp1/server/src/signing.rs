//! AGF Server — Ed25519 Request Signing
//!
//! Every evaluation result is signed with an Ed25519 keypair. The public key
//! is published at GET /public-key so any holder of an audit log entry can
//! independently verify that the result was produced by this server binary.
//!
//! Key lifecycle:
//!   - At startup, checks AGF_SIGNING_KEY_HEX env var (64-byte hex seed).
//!   - If absent, generates an ephemeral keypair and logs the public key.
//!   - In production: mount the seed as a K8s Secret and set AGF_SIGNING_KEY_HEX.
//!
//! Reference: AGF OpenSpec v2.0 §9.5 — Result Authentication

use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use rand::rngs::OsRng;

/// An initialized Ed25519 signing keypair for this server instance.
#[derive(Clone)]
pub struct AgfSigner {
    signing_key: SigningKey,
}

impl AgfSigner {
    /// Initialize from the `AGF_SIGNING_KEY_HEX` environment variable,
    /// or generate a fresh ephemeral keypair if the variable is absent.
    pub fn from_env_or_generate() -> Self {
        if let Ok(hex) = std::env::var("AGF_SIGNING_KEY_HEX") {
            let bytes = hex::decode(hex.trim())
                .expect("AGF_SIGNING_KEY_HEX must be 64 hex chars (32-byte seed)");
            let seed: [u8; 32] = bytes
                .try_into()
                .expect("AGF_SIGNING_KEY_HEX must decode to exactly 32 bytes");
            let signing_key = SigningKey::from_bytes(&seed);
            tracing::info!(
                "Loaded signing key from AGF_SIGNING_KEY_HEX. Public key: ed25519:{}",
                hex::encode(signing_key.verifying_key().as_bytes())
            );
            Self { signing_key }
        } else {
            let signing_key = SigningKey::generate(&mut OsRng);
            tracing::warn!(
                "AGF_SIGNING_KEY_HEX not set — using EPHEMERAL keypair. \
                 Public key: ed25519:{}. Signatures will not be reproducible across restarts.",
                hex::encode(signing_key.verifying_key().as_bytes())
            );
            Self { signing_key }
        }
    }

    /// Sign `message` and return the hex-encoded signature (128 hex chars).
    pub fn sign(&self, message: &[u8]) -> String {
        let sig: Signature = self.signing_key.sign(message);
        format!("ed25519:{}", hex::encode(sig.to_bytes()))
    }

    /// Return the hex-encoded Ed25519 public key (64 hex chars).
    pub fn public_key_hex(&self) -> String {
        format!("ed25519:{}", hex::encode(self.signing_key.verifying_key().as_bytes()))
    }

    /// Return raw verifying key for external use.
    pub fn verifying_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }
}

/// Build the canonical message that is signed for a given evaluation.
/// This must be reproduced identically by `agf-verify`.
///
/// Format: `"AGF-EVAL-V1:{proof_hash}:{chain_hash}:{timestamp_utc}"`
pub fn signing_message(proof_hash: &str, chain_hash: &str, timestamp_utc: &str) -> Vec<u8> {
    format!("AGF-EVAL-V1:{proof_hash}:{chain_hash}:{timestamp_utc}").into_bytes()
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::Verifier;

    fn make_signer() -> AgfSigner {
        // Deterministic seed for tests
        let seed = [0x42u8; 32];
        AgfSigner {
            signing_key: SigningKey::from_bytes(&seed),
        }
    }

    #[test]
    fn test_sign_produces_64_byte_hex_with_prefix() {
        let s = make_signer();
        let sig = s.sign(b"test message");
        assert!(sig.starts_with("ed25519:"));
        // 64 bytes = 128 hex chars + 8 prefix chars
        assert_eq!(sig.len(), 128 + 8);
    }

    #[test]
    fn test_public_key_has_correct_prefix_and_length() {
        let s = make_signer();
        let pk = s.public_key_hex();
        assert!(pk.starts_with("ed25519:"));
        assert_eq!(pk.len(), 64 + 8); // 32 bytes = 64 hex + prefix
    }

    #[test]
    fn test_signature_is_deterministic_for_same_key_and_message() {
        // Ed25519 with same key + message always produces same sig
        let s1 = make_signer();
        let s2 = make_signer();
        assert_eq!(s1.sign(b"hello"), s2.sign(b"hello"));
    }

    #[test]
    fn test_different_messages_produce_different_signatures() {
        let s = make_signer();
        assert_ne!(s.sign(b"message-a"), s.sign(b"message-b"));
    }

    #[test]
    fn test_signature_verifies_against_public_key() {
        let s = make_signer();
        let msg = b"AGF-EVAL-V1:blake3:abc:blake3:def:2026-03-22T11:00:00Z";
        let sig_hex = s.sign(msg);
        let sig_bytes = hex::decode(&sig_hex[8..]).unwrap(); // strip "ed25519:"
        let sig = Signature::from_bytes(&sig_bytes.try_into().unwrap());
        s.verifying_key().verify(msg, &sig).expect("signature should verify");
    }

    #[test]
    fn test_tampered_message_fails_verification() {
        let s = make_signer();
        let sig_hex = s.sign(b"original message");
        let sig_bytes = hex::decode(&sig_hex[8..]).unwrap();
        let sig = Signature::from_bytes(&sig_bytes.try_into().unwrap());
        assert!(s.verifying_key().verify(b"tampered message", &sig).is_err());
    }

    #[test]
    fn test_signing_message_format_is_canonical() {
        let msg = signing_message("blake3:aaa", "blake3:bbb", "2026-03-22T00:00:00Z");
        let expected = b"AGF-EVAL-V1:blake3:aaa:blake3:bbb:2026-03-22T00:00:00Z";
        assert_eq!(msg, expected);
    }
}
