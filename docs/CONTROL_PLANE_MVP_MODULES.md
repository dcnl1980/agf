# Control Plane MVP Modules

## Objective

Define the minimum control-plane product surface required to make AGF buyable and operable, while keeping kernel scope narrow.

MVP guardrail:

- do not depend on ZK proof generation
- do not depend on hardware attestation
- do not move ruleset governance into kernel

## Module List (MVP)

## 1. Agent Registry

Purpose:

- register agent identities and ownership metadata
- map agent to customer/org/workspace scope

Minimum capabilities:

- create/update/deactivate agent — **Done** (`POST/GET/PATCH .../agents`, `POST .../deactivate`)
- attach allowed execution channels/integrations — **Done** (`channels` JSON on agent)
- issue stable `agent_id` used in policy/evidence records — **Done** (`agt_…` ids; evaluate rejects unknown/inactive agentId when supplied)

## 2. Org, User, and Role Management

Purpose:

- control who can author, approve, publish, execute, and export

Minimum capabilities:

- user and service principal records
- role-based access controls for policy lifecycle and evidence export
- organization boundary constraints

Note:

- multi-tenancy, if required by product SKU, exists here
- never inside kernel evaluation runtime

## 3. Ruleset Lifecycle API

Purpose:

- own upload, review, versioning, approval, publication

Minimum capabilities:

- draft creation and version upload
- reviewer workflow
- approval to publish immutable bundle
- published bundle pinning for kernel execution

Reference:

- `docs/RULESET_LIFECYCLE_SPEC.md`

## 4. Policy Execution Gateway Integration

Purpose:

- submit evaluate requests to customer-scoped kernel
- map kernel outputs into platform decision model

Minimum capabilities:

- call `/evaluate` and `/evaluate-entity`
- normalize `PASS`/`BLOCK` to `ALLOW`/`BLOCK`
- support policy route to `REQUIRE_APPROVAL` when configured

## 5. Approvals and HITL Queue

Purpose:

- operationalize `REQUIRE_APPROVAL` and exception governance

Minimum capabilities:

- queue pending approval decisions
- assign approvers
- capture approve/reject action with immutable audit record
- feed decision outcome back to orchestrator path

## 6. Dashboard and Audit Explorer

Purpose:

- provide day-to-day operator UX

Minimum capabilities:

- decision volume and outcome summary
- blocked/approval-required queue visibility
- drill-down to decision payload, rule version, signature, chain hash

## 7. Evidence Viewer and Export

Purpose:

- allow compliance teams and regulators to retrieve evidence safely

Minimum capabilities:

- query by time range, entity, and bundle version
- export signed decisions + chain/checkpoint material
- role-gated access and export logging

Reference:

- `docs/EVIDENCE_SCHEMA.md`

## 8. Integration Hooks

Purpose:

- connect common orchestrators/frameworks without rewriting business logic

MVP integrations:

- Temporal
- LangChain/LangGraph

Reference:

- `docs/INTEGRATION_QUICKSTART_TEMPORAL.md`
- `docs/INTEGRATION_QUICKSTART_LANGCHAIN_LANGGRAPH.md`

## Out of Scope for MVP

- mandatory ZK proof generation in hot path
- mandatory TEE attestation in production path
- federated cross-organization trust network productization
- broad trust-scoring engine as gating substitute for deterministic policy

## Exit Criteria for MVP

MVP is ready when:

1. teams can register agents and assign roles
2. policy authors can upload/review/approve/publish rulesets
3. workloads can call kernel through stable execution gateway
4. approvals queue handles `REQUIRE_APPROVAL` flows
5. operators can inspect and export signed evidence
6. at least two integration adapters run in working quickstart paths
