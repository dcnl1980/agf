# API Contracts (Control Plane, Kernel Gateway, Evidence, HITL)

## Contract Scope

This document defines external API contracts for the AGF platform split:

- Control plane APIs (ruleset lifecycle, identity/org boundary, approvals)
- Kernel policy execution gateway APIs (evaluation only)
- Evidence store and export APIs
- HITL webhook/event contracts

## Conventions

- JSON over HTTPS
- RFC3339 timestamps
- explicit `customer_id`/`org_id` scoping in control-plane APIs
- immutable IDs for evidence and policy bundles
- idempotency keys for mutation endpoints

## 1) Control Plane APIs

## 1.1 Ruleset Lifecycle (authoritative owner)

### Create draft ruleset

- `POST /v1/customers/{customer_id}/rulesets`

Request:

```json
{
  "name": "finance_core",
  "description": "Core finance controls",
  "schema_version": "arsl-0.1.0"
}
```

Response:

```json
{
  "ruleset_id": "rs_01J1S4...",
  "state": "DRAFT",
  "created_at": "2026-04-23T12:00:00Z"
}
```

### Upload draft version

- `POST /v1/customers/{customer_id}/rulesets/{ruleset_id}/versions`

Request:

```json
{
  "version_label": "2026.04.23-1",
  "source_format": "arsl",
  "content": "base64-or-reference",
  "change_notes": "Added sanctions exception rule"
}
```

Response:

```json
{
  "ruleset_version_id": "rsv_01J1S5...",
  "state": "DRAFT",
  "validation": {
    "parse": "ok",
    "static_validation": "ok",
    "compile": "ok"
  }
}
```

### Get version (metadata + published bundle pin)

- `GET /v1/customers/{customer_id}/rulesets/{ruleset_id}/versions/{version_id}`

Response includes `state`, `versionLabel`, and `publishedBundle` (when `PUBLISHED`): `publicBundleId`, `bundleVersion`, `digest`, `ruleFiles` (array of on-disk paths), `publishedAt`.

### Review / approve / publish

- `POST .../submit-review` or **`POST .../review`** (alias) — DRAFT → IN_REVIEW (policy author / admin)
- `POST .../approve-review` or **`POST .../approve`** (alias) — IN_REVIEW → APPROVED (approver / admin)
- `POST /v1/customers/{customer_id}/rulesets/{ruleset_id}/versions/{version_id}/publish`

Publish response includes immutable bundle pin:

```json
{
  "bundle_id": "rb_2ddf6e8b",
  "bundle_version": "2026.04.23",
  "bundle_digest": "blake3:5b1f...",
  "state": "PUBLISHED",
  "published_at": "2026-04-23T12:20:00Z"
}
```

## 1.2 Identity and Org Boundary

### Create org role binding

- `POST /v1/customers/{customer_id}/orgs/{org_id}/role-bindings`

Request:

```json
{
  "subject_type": "user",
  "subject_id": "usr_124",
  "role": "policy_approver"
}
```

### Register agent

- `POST /v1/customers/{customer_id}/agents`

Request:

```json
{
  "agent_name": "payments-orchestrator",
  "org_id": "org_finops",
  "metadata": {
    "framework": "temporal"
  }
}
```

Response:

```json
{
  "agent_id": "agt_01J1S6...",
  "status": "active"
}
```

## 2) Kernel Policy Execution Gateway APIs

These map to currently implemented endpoints in `agf-sp1/server/src/api.rs`.

## 2.1 Current Runtime Endpoints

- `GET /health`
- `GET /public-key`
- `POST /evaluate`
- `POST /evaluate-entity`

## 2.2 Current Request/Response Shapes

### `POST /evaluate` (implemented now)

Request:

```json
{
  "rule_file": "agf-sp1/rules/finance/psd2_sca.arsl.toml",
  "entity_id": 12345,
  "data": {
    "transaction_amount": 10000
  }
}
```

Response fields include:

- `decision` (`PASS`/`BLOCK`)
- `rules[]`
- `audit.proof_hash`, `audit.chain_hash`, `audit.timestamp_utc`
- `signature`

### `POST /evaluate-entity` (implemented now)

Request:

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

Response fields include:

- `overall_decision` (`PASS`/`BLOCK`)
- per-vertical result array
- aggregate pass/block counts
- signed audit bundle and signature

## 2.3 Platform-Targeted Gateway Contract (next)

For control-plane mediation, the target request should reference published bundles:

```json
{
  "customer_id": "cust_9f13",
  "org_id": "org_finops",
  "agent_id": "agt_01J1S6...",
  "bundle_ref": {
    "bundle_id": "rb_2ddf6e8b",
    "bundle_version": "2026.04.23"
  },
  "entity_id": 12345,
  "data": {
    "transaction_amount": 10000
  }
}
```

Target response:

```json
{
  "decision": "ALLOW",
  "kernel_decision_raw": "PASS",
  "evidence_ref": "dec_01J1S8...",
  "signature": "hex...",
  "audit": {
    "proof_hash": "blake3:...",
    "chain_hash": "blake3:...",
    "timestamp_utc": "2026-04-23T12:30:00Z"
  }
}
```

## 3) Evidence Store and Export APIs

## 3.1 Query evidence

- `GET /v1/customers/{customer_id}/evidence/decisions?from=...&to=...&bundle_id=...`

Response:

```json
{
  "items": [
    {
      "decision_id": "dec_01J1S8...",
      "decision": "ALLOW",
      "bundle_id": "rb_2ddf6e8b",
      "signature": "hex..."
    }
  ],
  "next_cursor": "cur_..."
}
```

## 3.2 Export evidence package

- `POST /v1/customers/{customer_id}/evidence/exports`

Request:

```json
{
  "from": "2026-04-23T00:00:00Z",
  "to": "2026-04-23T12:30:00Z",
  "include_proof_artifacts": false
}
```

Response:

```json
{
  "export_id": "exp_01J1S9...",
  "status": "ready",
  "manifest_hash": "blake3:...",
  "download_url": "signed-url"
}
```

### 3.2.1 Implemented in the control plane (dev)

The dashboard-backed API uses the same logical shape with these concrete routes (per-method details and roles: `control-plane/README.md`):

- **Sync export:** `GET /api/v1/customers/{customer_id}/evidence/export?from=...&to=...` — response body is an **`agf.evidence_export/v1`** envelope: `export_contract`, `export_id` (or generated), `window`, `counts`, `records.decision_records` aligned with `docs/EVIDENCE_SCHEMA.md`, and **`manifest_hash`** (sha256 of the decision records JSON) for package integrity.
- **Async jobs:** `GET` and `POST /api/v1/customers/{customer_id}/evidence/exports` — `POST` accepts `from` / `to` in the body or query; list jobs with `GET` on the same path; completed files download from `GET /api/v1/customers/{customer_id}/evidence/exports/{jobId}/download` (on disk under `data/exports`, not a cloud signed URL).

## 4) HITL Webhooks and Events

## 4.1 Approval required event

Outbound event from control plane to workflow/orchestrator:

```json
{
  "event_type": "agf.approval.required",
  "event_id": "evt_01J1SA...",
  "customer_id": "cust_9f13",
  "org_id": "org_finops",
  "decision_id": "dec_01J1S8...",
  "agent_id": "agt_01J1S6...",
  "required_by": "2026-04-23T13:00:00Z",
  "evidence_ref": "dec_01J1S8..."
}
```

## 4.2 Approval resolved callback

Inbound callback to orchestrator:

```json
{
  "event_type": "agf.approval.resolved",
  "event_id": "evt_01J1SB...",
  "decision_id": "dec_01J1S8...",
  "resolution": "approved",
  "resolved_by": "usr_42",
  "resolved_at": "2026-04-23T12:45:00Z"
}
```

### 4.3 Implemented: audit and outbox visibility

- Approvals are persisted and resolved through the control-plane HTTP API; on enqueue and resolve, the server writes **`audit_log`** entries (`hitl_approval_queued`, `hitl_approval_resolved`) for compliance review.
- Outbound webhooks are staged in **`webhook_outbox`** and retried in-process. Admins can list recent outbox rows via **`GET /api/v1/customers/{customer_id}/webhooks/outbox`** (see `control-plane/README.md`).

## 5) Mapping to Current Runtime

Current API endpoints already implemented:

- `/evaluate`
- `/evaluate-entity`
- `/public-key`

Control-plane contracts in this document wrap those endpoints and add lifecycle, identity, and evidence semantics without widening kernel scope.

## 6) Error and Idempotency Guidance

- include `Idempotency-Key` for mutating control-plane requests
- return machine-stable error codes
- preserve validation failure detail for policy-author debugging
- avoid leaking cross-customer metadata in error payloads

## Cross-References

- `docs/RULESET_LIFECYCLE_SPEC.md`
- `docs/KERNEL_EVALUATION_CONTRACT.md`
- `docs/EVIDENCE_SCHEMA.md`
- `docs/CUSTOMER_ENVIRONMENT_BLUEPRINT.md`
