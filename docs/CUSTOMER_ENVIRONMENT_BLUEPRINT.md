# Customer Environment Blueprint

## Purpose

Define the production deployment baseline for AGF as a customer-sovereign runtime:

- one isolated runtime environment per production customer
- one customer-scoped AGF kernel per production customer
- one customer-owned evidence boundary per production customer

This document is implementation-facing. It defines boundaries, ownership, and assurance tiers without changing AGF kernel scope.

## Authoritative Product Framing

An Agentic AI Trust Platform that lets enterprises register, govern, approve, and audit AI agents, with AGF as the deterministic enforcement kernel that decides what agents are allowed to do before execution.

## Baseline Architecture

```text
Customer Environment
├─ Customer Control Plane
│  ├─ agent registry
│  ├─ users / roles / org config
│  ├─ approvals / HITL workflows
│  ├─ dashboard / audit explorer
│  └─ ruleset lifecycle API (upload/review/version/approve/publish)
│
├─ AGF Enforcement Kernel (single-tenant, customer-scoped)
│  ├─ policy execution gateway
│  ├─ deterministic ALLOW / BLOCK / REQUIRE_APPROVAL
│  ├─ signed audit emit
│  └─ isolated runtime profile
│
└─ Customer Evidence Store
   ├─ signed decisions
   ├─ pinned rule versions
   ├─ audit chain material
   ├─ optional proof artifacts
   └─ export API
```

## Isolation Tiers

The rule is "one isolated runtime environment per production customer." The concrete shape depends on assurance tier.

### Tier A: Dedicated Cluster (highest assurance)

- Dedicated Kubernetes cluster for one production customer.
- Dedicated kernel deployment and dedicated evidence storage boundary.
- Recommended default for regulated sectors and strict sovereignty requirements.

### Tier B: Dedicated Namespace with Strong Isolation (medium-high assurance)

- Shared cluster with hard namespace isolation controls.
- Separate service accounts, network policies, storage classes, and secret scopes per customer.
- Allowed where regulator and customer risk teams accept shared control-plane substrate.

### Tier C: Dedicated Tenant Stack (controlled multi-tenant substrate)

- Dedicated logical stack per customer on shared platform infrastructure.
- Strong boundary controls remain mandatory around runtime, keys, and evidence.
- Not the recommended default for high-assurance regulated deployments.

## Trust and Ownership Boundaries

### Ruleset Ownership

- Ruleset lifecycle is owned by the control plane.
- Kernel never accepts ad-hoc unpinned policy text in production flow.
- Kernel executes only published, pinned, validated bundles.

### Key Ownership

- Customer controls signing-key ownership model.
- MVP can support software-managed keys in customer boundary.
- Preferred production posture: customer KMS/HSM-backed signing keys.

### Evidence Ownership

- Evidence is not generic application logging.
- Evidence store is a first-class customer boundary for regulator-grade exports.
- No cross-customer evidence mixing in storage or API.

## Non-Negotiable Kernel Constraints

- Kernel remains single-tenant and customer-scoped.
- Kernel scope is deterministic evaluation plus signed evidence emit.
- No UI, trust scoring, workflow orchestration, or ruleset governance APIs in kernel.

## Deployment Decision Matrix

| Requirement | Tier A | Tier B | Tier C |
|---|---|---|---|
| Regulated production (strict) | Recommended | Conditional | Not preferred |
| Strong sovereignty narrative | Strongest | Moderate | Weakest |
| Infrastructure cost | Highest | Medium | Lowest |
| Operational complexity | Highest | Medium | Medium |
| Audit clarity | Strongest | Strong | Moderate |

## Initial Implementation Deliverables

1. Control-plane ruleset lifecycle APIs with publish/pin semantics.
2. Kernel policy execution gateway contract (evaluate only).
3. Evidence schema and export contract.
4. Isolation-tier deployment profiles and acceptance checks.
5. Customer-facing runbook for key ownership and evidence export.
