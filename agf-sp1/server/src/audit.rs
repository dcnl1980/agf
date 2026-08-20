//! Immutable Audit Log (IAL) — Blake3 hash chain
//!
//! Each evaluation appends a new entry to the log. The chain hash links each entry
//! to the previous one:
//!
//!   chain_hash[n] = blake3(
//!     chain_hash[n-1] || log_id || entity_id || decision || proof_hash || timestamp
//!   )
//!
//! The genesis entry uses chain_hash[0] = blake3("AGF-IAL-GENESIS-v1").
//!
//! This makes the log tamper-evident: mutating any prior entry invalidates all
//! subsequent chain hashes, which can be verified by any holder of the log.
//!
//! Reference: AGF OpenSpec v2.0 §9.3 — Immutable Audit Trail

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Sequential position in the log (1-indexed; 0 is genesis)
    pub log_id: u64,

    /// Entity ID from the evaluate request
    pub entity_id: u32,

    /// "PASS" or "BLOCK"
    pub decision: String,

    /// ARSL rule file evaluated
    pub rule_file: String,

    /// Blake3 hash of the evaluation inputs + result
    pub proof_hash: String,

    /// Blake3 hash of (previous chain_hash || this entry's fields)
    pub chain_hash: String,

    /// RFC-3339 timestamp of the evaluation
    pub timestamp_utc: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Log
// ─────────────────────────────────────────────────────────────────────────────

pub struct AuditLog {
    entries: Vec<AuditEntry>,
    /// The chain hash of the last appended entry (or genesis hash if empty)
    head_chain_hash: String,
    next_id: u64,
}

impl AuditLog {
    /// Create a new audit log, seeding the genesis hash.
    pub fn new() -> Self {
        let genesis = blake3::hash(b"AGF-IAL-GENESIS-v1");
        Self {
            entries: Vec::new(),
            head_chain_hash: format!("blake3:{}", genesis.to_hex()),
            next_id: 1,
        }
    }

    /// Append a new evaluation record and return the created entry.
    pub fn append(
        &mut self,
        entity_id: u32,
        decision: &str,
        rule_file: &str,
        proof_hash: &str,
        timestamp_utc: &str,
    ) -> AuditEntry {
        let log_id = self.next_id;

        // chain_hash[n] = blake3(previous_chain_hash || log_id || entity_id || decision || proof_hash || timestamp)
        let chain_input = format!(
            "{}||{}||{}||{}||{}||{}",
            self.head_chain_hash, log_id, entity_id, decision, proof_hash, timestamp_utc
        );
        let chain_hash = format!("blake3:{}", blake3::hash(chain_input.as_bytes()).to_hex());

        let entry = AuditEntry {
            log_id,
            entity_id,
            decision: decision.to_string(),
            rule_file: rule_file.to_string(),
            proof_hash: proof_hash.to_string(),
            chain_hash: chain_hash.clone(),
            timestamp_utc: timestamp_utc.to_string(),
        };

        self.head_chain_hash = chain_hash;
        self.next_id += 1;
        self.entries.push(entry.clone());
        entry
    }

    /// Return all entries in chronological order.
    pub fn entries(&self) -> &[AuditEntry] {
        &self.entries
    }

    /// Verify the full chain from genesis to the last entry.
    /// Returns Ok(()) if intact, Err(position) at the first broken link.
    pub fn verify_chain(&self) -> Result<(), u64> {
        let genesis = blake3::hash(b"AGF-IAL-GENESIS-v1");
        let mut prev_chain = format!("blake3:{}", genesis.to_hex());

        for entry in &self.entries {
            let chain_input = format!(
                "{}||{}||{}||{}||{}||{}",
                prev_chain, entry.log_id, entry.entity_id,
                entry.decision, entry.proof_hash, entry.timestamp_utc
            );
            let expected = format!("blake3:{}", blake3::hash(chain_input.as_bytes()).to_hex());
            if expected != entry.chain_hash {
                return Err(entry.log_id);
            }
            prev_chain = entry.chain_hash.clone();
        }
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(log: &mut AuditLog, id: u32, decision: &str, seq: u64) -> AuditEntry {
        log.append(
            id,
            decision,
            "rules/test.arsl.toml",
            &format!("blake3:fakehash{}", seq),
            "2026-03-22T11:00:00Z",
        )
    }

    #[test]
    fn test_genesis_chain_initialises_correctly() {
        let log = AuditLog::new();
        let genesis = blake3::hash(b"AGF-IAL-GENESIS-v1");
        let expected = format!("blake3:{}", genesis.to_hex());
        assert_eq!(log.head_chain_hash, expected);
        assert!(log.entries.is_empty());
    }

    #[test]
    fn test_first_entry_has_log_id_1() {
        let mut log = AuditLog::new();
        let entry = make_entry(&mut log, 9001, "PASS", 1);
        assert_eq!(entry.log_id, 1);
    }

    #[test]
    fn test_entries_increments_log_id() {
        let mut log = AuditLog::new();
        let a = make_entry(&mut log, 9001, "PASS", 1);
        let b = make_entry(&mut log, 9001, "BLOCK", 2);
        let c = make_entry(&mut log, 9001, "PASS", 3);
        assert_eq!(a.log_id, 1);
        assert_eq!(b.log_id, 2);
        assert_eq!(c.log_id, 3);
    }

    #[test]
    fn test_chain_hash_changes_between_entries() {
        let mut log = AuditLog::new();
        let a = make_entry(&mut log, 9001, "PASS", 1);
        let b = make_entry(&mut log, 9001, "PASS", 2);
        assert_ne!(a.chain_hash, b.chain_hash);
    }

    #[test]
    fn test_chain_verification_passes_on_intact_log() {
        let mut log = AuditLog::new();
        make_entry(&mut log, 9001, "PASS", 1);
        make_entry(&mut log, 9002, "BLOCK", 2);
        make_entry(&mut log, 9003, "PASS", 3);
        assert!(log.verify_chain().is_ok());
    }

    #[test]
    fn test_chain_verification_detects_tamper() {
        let mut log = AuditLog::new();
        make_entry(&mut log, 9001, "PASS", 1);
        make_entry(&mut log, 9002, "BLOCK", 2);

        // Tamper with the first entry's decision
        log.entries[0].decision = "PASS".to_string(); // was already PASS — change proof_hash
        log.entries[0].proof_hash = "blake3:tampered".to_string();

        // Chain should now be broken at entry 2 (since entry 1's chain_hash is now wrong for entry 2)
        let result = log.verify_chain();
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_log_verifies_ok() {
        let log = AuditLog::new();
        assert!(log.verify_chain().is_ok());
    }

    #[test]
    fn test_entries_slice_has_correct_length() {
        let mut log = AuditLog::new();
        assert_eq!(log.entries().len(), 0);
        make_entry(&mut log, 1, "PASS", 1);
        assert_eq!(log.entries().len(), 1);
        make_entry(&mut log, 2, "BLOCK", 2);
        assert_eq!(log.entries().len(), 2);
    }
}
