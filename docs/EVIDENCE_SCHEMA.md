# Evidence Store Schema and Export Contract

## Why This Exists

Evidence is a first-class product boundary, not generic logging.

This schema defines the customer-owned evidence surface for:

- signed decisions
- policy/version pinning
- hash-chain integrity material
- optional proof artifacts
- regulator and audit exports

## Evidence Boundary Model

Per production customer:

- one evidence namespace/bucket/database scope
- one signing trust context
- one export surface

Cross-customer writes or reads in the same evidence scope are disallowed.

## Core Entities

### 1) `decision_record`

Immutable row/document per kernel decision.

```json
{
  "decision_id": "dec_01J1R5...",
  "customer_id": "cust_9f13",
  "entity_id": "12345",
  "decision": "ALLOW",
  "kernel_decision_raw": "PASS",
  "created_at": "2026-04-23T12:00:00Z",
  "evaluation_ms": 1.234,
  "signature": {
    "algorithm": "Ed25519",
    "value": "hex...",
    "public_key_id": "pk_2026_04"
  },
  "integrity": {
    "proof_hash": "blake3:...",
    "chain_hash": "blake3:...",
    "audit_log_id": 42
  },
  "policy_ref": {
    "bundle_id": "rb_2ddf6e8b",
    "bundle_version": "2026.04.23",
    "bundle_digest": "blake3:5b1f..."
  },
  "request_ref": {
    "request_id": "req_01J1R5...",
    "idempotency_key": "idem_..."
  }
}
```

### 2) `policy_bundle_ref`

Metadata index for published policy bundles referenced by decisions.

```json
{
  "bundle_id": "rb_2ddf6e8b",
  "bundle_version": "2026.04.23",
  "schema_version": "arsl-0.1.0",
  "digest": "blake3:5b1f...",
  "published_at": "2026-04-23T10:40:00Z",
  "published_by": "user_7f8a",
  "state": "PUBLISHED"
}
```

### 3) `chain_checkpoint`

Periodic checkpoint records to speed integrity verification over long chains.

```json
{
  "checkpoint_id": "chk_2026_04_23_1200",
  "customer_id": "cust_9f13",
  "from_audit_log_id": 1,
  "to_audit_log_id": 10000,
  "terminal_chain_hash": "blake3:...",
  "created_at": "2026-04-23T12:00:00Z"
}
```

### 4) `proof_artifact` (optional, non-MVP dependency)

References to ZK/attestation artifacts when premium assurance modules are enabled.

```json
{
  "artifact_id": "prf_01J1R6...",
  "decision_id": "dec_01J1R5...",
  "type": "zkvm_proof",
  "status": "available",
  "storage_uri": "s3://customer-evidence/proofs/prf_01J1R6.bin",
  "created_at": "2026-05-11T09:00:00Z"
}
```

## Export Contract

### Export Modes

1. Point export by decision ID.
2. Time-range export by created timestamp.
3. Bundle-version export (all decisions linked to one bundle).
4. Integrity export (decision set + checkpoints + verification metadata).

### Required Export Envelope

```json
{
  "export_id": "exp_01J1R7...",
  "customer_id": "cust_9f13",
  "generated_at": "2026-04-23T12:30:00Z",
  "window": {
    "from": "2026-04-23T00:00:00Z",
    "to": "2026-04-23T12:30:00Z"
  },
  "counts": {
    "decisions": 812,
    "bundles": 4,
    "checkpoints": 1
  },
  "records": {
    "decisions": [],
    "bundles": [],
    "checkpoints": [],
    "proof_artifacts": []
  },
  "manifest_hash": "blake3:..."
}
```

## MVP vs Premium

### MVP (required)

- decision records
- policy bundle references
- chain checkpoints
- export envelope and APIs

### Premium / Later Modules

- proof artifacts (ZK proofs)
- hardware attestation artifacts
- external notarization feeds

MVP must not depend on premium artifact generation to operate.

## Integrity Verification Rules

- verify signature over expected signing message format
- verify chain continuity over selected range
- verify decision policy reference matches published bundle digest
- verify export manifest hash over included records

## Storage and Retention Guidance

- immutable writes for `decision_record`
- append-only semantics for chain-linked data
- retention policy configurable per customer legal requirement
- WORM/object-lock support recommended for regulated environments

## Cross-References

- `docs/KERNEL_EVALUATION_CONTRACT.md`
- `docs/RULESET_LIFECYCLE_SPEC.md`
- `docs/API_CONTRACTS.md`
