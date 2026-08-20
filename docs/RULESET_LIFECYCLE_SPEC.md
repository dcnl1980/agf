# Ruleset Lifecycle Specification (Control Plane Owned)

## Scope

This specification defines how rulesets move from authoring to production execution.

Authoritative boundary:

- control plane owns ruleset lifecycle APIs and workflows
- AGF kernel consumes only pinned, versioned, validated bundles
- kernel does not expose upload/review/publish APIs

## Lifecycle States

```text
DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> DEPRECATED -> RETIRED
```

### DRAFT

- Rules are uploaded or edited by authorized policy authors.
- Syntax and schema checks run automatically.
- Drafts are not executable by production kernels.

### IN_REVIEW

- Rules await reviewer action (compliance, legal-engineering, or delegated approver).
- Review comments and change history are immutable for audit.

### APPROVED

- Rules pass workflow approvals and validation gates.
- Bundle is eligible for publication but not yet active.

### PUBLISHED

- Control plane creates immutable bundle artifact with version pin.
- Kernel is permitted to load only this class of bundle.

### DEPRECATED

- Bundle remains verifiable and queryable but should not be used for new execution contexts.

### RETIRED

- Bundle is no longer active and no longer targetable for new policy runs.
- Historical evidence references stay resolvable.

## Versioning and Identity

Each published bundle must include:

- `bundle_id` (immutable unique identifier)
- `bundle_version` (semantic or monotonic version)
- `source_ref` (link to source rules)
- `schema_version` (rule schema/ARSL spec compatibility)
- `digest` (content hash over normalized bundle bytes)
- `published_at` and `published_by`

Recommended reference shape:

```json
{
  "bundle_id": "rb_2ddf6e8b",
  "bundle_version": "2026.04.23",
  "schema_version": "arsl-0.1.0",
  "digest": "blake3:5b1f...",
  "published_at": "2026-04-23T10:40:00Z",
  "published_by": "user_7f8a"
}
```

## Validation Gates (Before Publish)

1. Parse gate: ARSL parse succeeds.
2. Static validation gate: ARSL validation succeeds.
3. Compilation gate: rule pack compiles to executable batch artifacts.
4. Compatibility gate: bundle schema version is accepted by target kernel runtime.
5. Approval gate: control-plane reviewer workflow completes.

## Kernel Contract for Ruleset Consumption

Kernel execution endpoints accept only references to published bundles or server-local pinned paths mapped from published versions.

The kernel must reject:

- unvalidated drafts
- unapproved bundles
- mutable "latest" aliases without explicit version pin

## Alignment With Current Implementation

Current runtime already includes parse/validate/compile primitives and execution:

- `agf-sp1/lib/src/arsl.rs` (`parse_arsl`, `validate`, `compile_batch`)
- `agf-sp1/server/src/api.rs` (evaluation endpoints)
- `agf-sp1/script/src/bin/arsl_compile.rs` (compile path tooling)

This spec adds governance and publication semantics around those primitives without expanding kernel scope.

## Required Control Plane APIs

Implemented under `/v1/customers/{customer_id}/…` (see `control-plane` and `docs/API_CONTRACTS.md`).

- `POST /rulesets` create draft
- `POST /rulesets/{id}/versions` new draft version (label)
- `POST /rulesets/{id}/versions/{version}/review` or `…/submit-review` submit for review
- `POST /rulesets/{id}/versions/{version}/approve` or `…/approve-review` approve
- `POST /rulesets/{id}/versions/{version}/publish` publish immutable bundle
- `POST /rulesets/{id}/versions/{version}/deprecate` · `retire` retire
- `GET /rulesets/{id}/versions/{version}` version metadata and published bundle (digest, `publicBundleId`, paths)

Lifecycle mutations are written to **`audit_log`** (actions such as `ruleset_published`, `ruleset_approved`, …) for org-scoped audit export.

Detailed payloads are defined in `docs/API_CONTRACTS.md`.

## Audit Requirements

Lifecycle events must be auditable and exportable:

- who changed what and when
- which approvals were required and satisfied
- which exact bundle digest was published
- which evaluations referenced each bundle version
