# AGF Kernel Evaluation Contract

## Intent

Define the Layer 1 contract for the AGF enforcement kernel as an evaluation-only, customer-scoped runtime.

Non-goals:

- no ruleset upload/review/publish APIs
- no identity/org management APIs
- no workflow queue orchestration
- no dashboard/reporting concerns

## Scope Boundary

Kernel responsibilities:

- deterministic policy evaluation
- `ALLOW` / `BLOCK` / `REQUIRE_APPROVAL` class outcomes
- signed audit material emission
- stable public-key retrieval for verification

Control plane responsibilities:

- ruleset lifecycle governance
- policy publication and bundle pinning
- approvals/HITL orchestration
- user/org/role lifecycle

## Runtime Topology

- One production kernel deployment serves one customer scope.
- Multi-tenancy is not implemented inside kernel runtime.
- Kernel consumes published bundle references from control plane.

## Current Endpoint Mapping

Based on existing implementation in `agf-sp1/server/src/api.rs`:

- `GET /health`
- `GET /public-key`
- `GET /audit-log`
- `POST /evaluate`
- `POST /evaluate-entity`

## Canonical Request and Response Shapes

### POST /evaluate (single ruleset)

Current request shape:

```json
{
  "rule_file": "/absolute/or/mapped/path/to/ruleset.arsl.toml",
  "entity_id": 12345,
  "data": {
    "capital_ratio": 900,
    "leverage_ratio": 400
  }
}
```

Current response shape (trimmed):

```json
{
  "decision": "PASS",
  "total_rules": 10,
  "pass_count": 10,
  "block_count": 0,
  "evaluation_ms": 1.234,
  "rules": [
    {
      "rule_id": 1,
      "compliant": true,
      "actual_value": 900,
      "margin_bps": 100
    }
  ],
  "audit": {
    "log_id": 42,
    "proof_hash": "blake3:...",
    "chain_hash": "blake3:...",
    "timestamp_utc": "2026-04-23T12:00:00Z",
    "tee_attestation": {
      "enclave_type": "mock"
    }
  },
  "signature": "hex-ed25519-signature"
}
```

### POST /evaluate-entity (multi-ruleset batch)

Current request shape:

```json
{
  "entity_id": 12345,
  "entity_name": "Example Corp",
  "rule_files": [
    "agf-sp1/rules/finance/psd2_sca.arsl.toml",
    "agf-sp1/rules/insurance/solvency_ii.arsl.toml"
  ],
  "data": {
    "capital_ratio": 900
  }
}
```

Current response shape (trimmed):

```json
{
  "entity_id": 12345,
  "entity_name": "Example Corp",
  "overall_decision": "PASS",
  "verticals": [
    {
      "rule_file": "agf-sp1/rules/finance/psd2_sca.arsl.toml",
      "vertical": "finance",
      "decision": "PASS",
      "total_rules": 5,
      "pass_count": 5,
      "block_count": 0,
      "evaluation_ms": 0.8,
      "rules": []
    }
  ],
  "total_rules": 12,
  "total_pass": 12,
  "total_block": 0,
  "evaluation_ms": 2.1,
  "audit": {
    "log_id": 43,
    "proof_hash": "blake3:...",
    "chain_hash": "blake3:...",
    "timestamp_utc": "2026-04-23T12:00:02Z",
    "tee_attestation": {
      "enclave_type": "mock"
    }
  },
  "signature": "hex-ed25519-signature"
}
```

### GET /public-key

Returns key material for independent verification:

```json
{
  "public_key": "hex-ed25519-public-key",
  "algorithm": "Ed25519",
  "description": "AGF server signing key..."
}
```

## Policy bundle content digest (control plane interop)

The control plane pins published bundles using a **content-addressed digest** of the underlying rule files. The community catalog and marketplace UI (`catalog/community-catalog.json`, website `/marketplace`) use the same algorithm so that catalog metadata can be compared to deployed bundles.

**Algorithm (implementation: `control-plane/src/digest.js`):**

- Resolve each `ruleFiles` path to an **absolute** path under the configured `agf-sp1` root (same as `control-plane`’s `resolveRuleFiles` / `AGF_SP1_ROOT`).
- Build the set of absolute paths, **deduplicate**, and **sort** lexicographically.
- For each path in order: append the **absolute path string** as UTF-8, then a null byte (`\0`), then the **raw file bytes** as read from disk.
- Compute **SHA-256** over the concatenation. Output the string `sha256:` followed by the lowercase hex digest (no colons in the hash).

**Interoperability:** Any tool that must match catalog digests (e.g. `scripts/marketplace-compute-digest.mjs`, `scripts/validate-marketplace-catalog.mjs`) must use the same absolute path strings as the control plane for a given `AGF_SP1_ROOT`. Pinning in CI validates that the catalog’s `digest` field matches a recomputation for the default repo layout.

**Not in kernel HTTP contract today:** the kernel’s `/evaluate` request still takes rule file paths or bundle material as implemented in `agf-sp1`; digest pinning is a control-plane and catalog concern until bundle references are first-class in evaluation requests (see the “Contract Hardening Required” section below).

## Contract Hardening Required (Control Plane + Kernel Integration)

1. Replace direct file-path ingestion with published bundle reference input.
2. Add explicit `bundle_id` and `bundle_version` fields in evaluation requests.
3. Include pinned bundle metadata in evaluation response/audit payload.
4. Preserve backward compatibility behind versioned API routes.

## Decision Semantics

Current implementation uses `PASS`/`BLOCK` strings.

Platform contract target:

- `ALLOW` (maps from pass-compliant result)
- `BLOCK` (maps from non-compliant result)
- `REQUIRE_APPROVAL` (policy path where control plane approval is required)

The control plane can map current return shape into platform decision enums until native enum output is added to kernel response.

## Security and Isolation Expectations

- deterministic execution path only
- no outbound calls during evaluation path
- customer-scoped signing context
- audit chain append after each decision
- public-key verification path remains externally callable

## Cross-References

- `docs/WHITEPAPER.md`
- `docs/RUNTIME_VALIDATION.md`
- `docs/RULESET_LIFECYCLE_SPEC.md`
- `agf-sp1/server/src/api.rs`
