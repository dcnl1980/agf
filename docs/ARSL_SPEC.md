# ARSL — AGF Rule Specification Language

> **Version:** 0.1.0
> **Status:** Draft Specification
> **Reference:** [AGF OpenSpec v1.2 — §7.2 Sprint 3](./AGF_OpenSpec_v1.md#72-phase-2-legal-engine-weeks-3-10)
> **Date:** 2026-03-07

---

## 1. Overview

ARSL (AGF Rule Specification Language) is a domain-specific language for expressing regulatory compliance rules in a format that is:

1. **Human-readable** — Legal and compliance teams can read and review rules
2. **Machine-parseable** — Rules compile deterministically to SP1 zkVM bytecode
3. **Formally unambiguous** — Every rule has exactly one interpretation
4. **Auditable** — Rules are versioned, traceable to regulatory sources, and diffable
5. **ZK-friendly** — Rules compile to efficient RISC-V cycles (target: <5,000 cycles/rule)

### Design Principles

| Principle | Rationale |
|---|---|
| **TOML syntax** | Unambiguous parsing (no YAML "Norway problem"), restricted types, no code execution during deserialization |
| **Deontic operators** | Obligations, prohibitions, permissions map directly to legal semantics |
| **Basis points** | All percentages expressed as integer basis points (1bp = 0.01%); no floating point |
| **Jurisdictional scoping** | Rules are namespaced by jurisdiction and regulation |
| **Deterministic evaluation** | Every rule produces a boolean PASS/BLOCK decision |

### Inspirations

| Language | What we take | What we don't |
|---|---|---|
| **Rego** (OPA) | Declarative policy-as-code, data-driven | Too general — we need domain-specific legal semantics |
| **LegalRuleML** (OASIS) | Deontic operators, defeasibility, temporal rules | XML is too verbose; we use TOML |
| **L4** (Singapore) | Boolean propositions, automatic code generation | Academic prototype; we need production-grade |
| **Drools** (Red Hat) | Rule engines, pattern matching | Java-centric; we target RISC-V |

---

## 2. File Structure

ARSL rules are organized as `.arsl.toml` files:

```
rules/
├── fca/                          # Jurisdiction: Financial Conduct Authority (UK)
│   ├── consumer_duty.arsl.toml   # FCA Consumer Duty rules
│   ├── capital_adequacy.arsl.toml
│   └── liquidity.arsl.toml
├── dora/                         # Jurisdiction: DORA (EU)
│   ├── ict_risk.arsl.toml
│   └── incident_reporting.arsl.toml
├── eu_ai_act/                    # Jurisdiction: EU AI Act
│   └── article5.arsl.toml
└── manifest.toml                 # Rule index and dependency graph
```

---

## 3. ARSL Syntax

### 3.1 Rule File Header

Every `.arsl.toml` file begins with metadata:

```toml
[metadata]
schema_version = "0.1.0"
jurisdiction = "UK"
regulator = "FCA"
regulation = "Consumer Duty"
regulation_ref = "PS22/9"
effective_date = "2023-07-31"
last_updated = "2026-03-07"
author = "AGF Compliance Team"
review_status = "approved"     # draft | review | approved | deprecated

# Provenance — maps to original legal text
[metadata.source]
title = "FCA Consumer Duty: Final Rules"
url = "https://www.fca.org.uk/publications/policy-statements/ps22-9-new-consumer-duty"
section = "Chapter 6 — Prudential Requirements"
```

### 3.2 Entity Definition

Entities represent the types of organizations being evaluated:

```toml
[[entity]]
id = "uk_bank"
name = "UK Regulated Bank"
description = "A bank authorized and regulated by the FCA under Part 4A of FSMA 2000"
required_fields = ["capital_ratio", "liquidity_coverage", "leverage_ratio", "tier1_capital"]
```

### 3.3 Rule Definition — Core Syntax

Each rule follows this structure:

```toml
[[rule]]
id = "FCA-CD-001"
name = "Capital Adequacy Ratio"
description = "The institution's total capital must be at least 8% of risk-weighted assets"
category = "capital"
severity = "critical"          # critical | high | medium | low | informational
entity_type = "uk_bank"

# Legal source mapping
[rule.source]
regulation = "CRR"              # Capital Requirements Regulation
article = "Article 92(1)(c)"
text = "An institution shall at all times satisfy the following own funds requirements: a total capital ratio of 8%"

# The actual check
[rule.condition]
type = "minimum"                # minimum | maximum | range | equals | not_equals
field = "capital_ratio"
threshold = 800                 # 8.00% expressed as basis points
unit = "bps"                    # bps (basis points) | seconds | count | currency_minor

# Enforcement action
[rule.enforcement]
on_pass = "allow"
on_fail = "block"               # block | warn | flag | escalate
notification = true
```

### 3.4 Operator Types

ARSL supports these condition types:

| Type | Syntax | Logic | Example |
|---|---|---|---|
| `minimum` | `field >= threshold` | Value must be at or above minimum | Capital ratio ≥ 8% |
| `maximum` | `field <= threshold` | Value must be at or below maximum | Large exposure ≤ 25% |
| `range` | `min <= field <= max` | Value must be within range | Leverage 3-5% |
| `equals` | `field == threshold` | Value must equal exactly | Status = Active |
| `not_equals` | `field != threshold` | Value must not equal | Status ≠ Suspended |
| `all_of` | All sub-conditions pass | Logical AND | Multiple ratio checks |
| `any_of` | At least one sub-condition passes | Logical OR | Alternative compliance |
| `none_of` | No sub-conditions pass | Logical NOR | Blacklist check |

### 3.5 Compound Rules

Rules can compose sub-conditions:

```toml
[[rule]]
id = "FCA-CD-010"
name = "Combined Capital Requirements"
description = "Entity must meet BOTH minimum capital AND minimum leverage"
category = "capital"
severity = "critical"
entity_type = "uk_bank"

[rule.condition]
type = "all_of"

[[rule.condition.checks]]
type = "minimum"
field = "capital_ratio"
threshold = 800
unit = "bps"

[[rule.condition.checks]]
type = "minimum"
field = "leverage_ratio"
threshold = 300
unit = "bps"

[[rule.condition.checks]]
type = "minimum"
field = "tier1_capital"
threshold = 600
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"
```

### 3.6 Temporal Rules

Rules that depend on time durations:

```toml
[[rule]]
id = "DORA-ICT-001"
name = "ICT Incident Reporting Deadline"
description = "Major ICT incidents must be reported within 4 hours"
category = "incident_response"
severity = "high"
entity_type = "financial_entity"

[rule.source]
regulation = "DORA"
article = "Article 19"
text = "Financial entities shall report major ICT-related incidents to the competent authority within 4 hours"

[rule.condition]
type = "maximum"
field = "incident_report_time"
threshold = 14400             # 4 hours = 14,400 seconds
unit = "seconds"

[rule.enforcement]
on_pass = "allow"
on_fail = "escalate"
escalation_target = "regulator"
```

---

## 4. Compilation Pipeline

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────┐
│ .arsl.toml  │────▶│  Parser  │────▶│ ComplianceBatch │──▶│ SP1 zkVM  │
│ (Rule File) │     │ (Rust)   │     │ (Rust types)  │     │ (Execute) │
└─────────────┘     └──────────┘     └──────────────┘     └───────────┘
                                                                │
                                                           ┌────▼────┐
                                                           │ ZK Proof │
                                                           │ (STARK)  │
                                                           └─────────┘
```

### 4.1 Parsing Stage

The ARSL parser (`arsl::parse`) converts `.arsl.toml` files into the `ComplianceBatch` type
that our SP1 guest program already accepts. This is a compile-time step — no parsing happens
inside the zkVM.

### 4.2 Type Mapping

| ARSL Concept | Rust Type | SP1 Guest |
|---|---|---|
| `rule.condition.threshold` | `ComplianceInput.minimum_threshold` | Read via `sp1_zkvm::io::read()` |
| `rule.condition.type = "minimum"` | `maximum_threshold = 0` | Branch in `evaluate_rule()` |
| `rule.condition.type = "range"` | Both thresholds set | Double comparison |
| `rule.enforcement.on_fail = "block"` | `ComplianceResult.compliant = false` | Committed as public value |

---

## 5. Example: Complete FCA Ruleset

```toml
# File: rules/fca/consumer_duty.arsl.toml

[metadata]
schema_version = "0.1.0"
jurisdiction = "UK"
regulator = "FCA"
regulation = "Consumer Duty"
regulation_ref = "PS22/9"
effective_date = "2023-07-31"
last_updated = "2026-03-07"
author = "AGF Compliance Team"
review_status = "approved"

[[entity]]
id = "uk_bank"
name = "UK Regulated Bank"

# ─── Rule 1: Capital Adequacy ────────────────────────────────

[[rule]]
id = "FCA-CD-001"
name = "Capital Adequacy Ratio"
description = "Total capital must be at least 8% of risk-weighted assets (CRR Art. 92)"
category = "capital"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR"
article = "Article 92(1)(c)"

[rule.condition]
type = "minimum"
field = "capital_ratio"
threshold = 800
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 2: Liquidity Coverage ──────────────────────────────

[[rule]]
id = "FCA-CD-002"
name = "Liquidity Coverage Ratio"
description = "LCR must be at least 100% (CRR Art. 412)"
category = "liquidity"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR"
article = "Article 412"

[rule.condition]
type = "minimum"
field = "liquidity_coverage"
threshold = 10000
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 3: Leverage Ratio ─────────────────────────────────

[[rule]]
id = "FCA-CD-003"
name = "Leverage Ratio"
description = "Leverage ratio must be at least 3% (CRR2 Art. 92(1)(d))"
category = "capital"
severity = "high"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR2"
article = "Article 92(1)(d)"

[rule.condition]
type = "minimum"
field = "leverage_ratio"
threshold = 300
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 4: Net Stable Funding ─────────────────────────────

[[rule]]
id = "FCA-CD-004"
name = "Net Stable Funding Ratio"
description = "NSFR must be at least 100% (CRR2 Art. 428a)"
category = "liquidity"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR2"
article = "Article 428a"

[rule.condition]
type = "minimum"
field = "net_stable_funding"
threshold = 10000
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 5: Large Exposure Limit ───────────────────────────

[[rule]]
id = "FCA-CD-005"
name = "Large Exposure Limit"
description = "No single exposure shall exceed 25% of own funds (CRR Art. 395)"
category = "exposure"
severity = "high"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR"
article = "Article 395(1)"

[rule.condition]
type = "range"
field = "large_exposure"
min_threshold = 0
max_threshold = 2500
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 6: Solvency ───────────────────────────────────────

[[rule]]
id = "FCA-CD-006"
name = "Solvency Ratio"
description = "Solvency ratio must be at least 150% (Solvency II Directive)"
category = "capital"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "Solvency II"
article = "Article 100"

[rule.condition]
type = "minimum"
field = "solvency_ratio"
threshold = 15000
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 7: Tier 1 Capital ─────────────────────────────────

[[rule]]
id = "FCA-CD-007"
name = "Tier 1 Capital Ratio"
description = "CET1 capital ratio must be at least 6% (CRR Art. 92(1)(b))"
category = "capital"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR"
article = "Article 92(1)(b)"

[rule.condition]
type = "minimum"
field = "tier1_capital"
threshold = 600
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"

# ─── Rule 8: Counter-cyclical Buffer ────────────────────────

[[rule]]
id = "FCA-CD-008"
name = "Counter-Cyclical Capital Buffer"
description = "CCyB must be maintained at the rate set by the FCA (currently 0-2.5%)"
category = "capital"
severity = "medium"
entity_type = "uk_bank"

[rule.source]
regulation = "CRR"
article = "Article 130"

[rule.condition]
type = "minimum"
field = "countercyclical_buffer"
threshold = 0
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "warn"

# ─── Rule 9: Stress Test Capital ────────────────────────────

[[rule]]
id = "FCA-CD-009"
name = "Stressed Capital Adequacy"
description = "Capital must remain above 5.5% under adverse stress scenario"
category = "capital"
severity = "critical"
entity_type = "uk_bank"

[rule.source]
regulation = "FCA Prudential Sourcebook"
article = "BIPRU 2.2.12"

[rule.condition]
type = "minimum"
field = "stress_test_capital"
threshold = 550
unit = "bps"

[rule.enforcement]
on_pass = "allow"
on_fail = "block"
```

---

## 6. Type System

### 6.1 Deontic Operators

ARSL captures legal semantics through deontic operators:

| Operator | ARSL keyword | Meaning | ZK Semantics |
|---|---|---|---|
| **Obligation** | `on_fail = "block"` | Entity MUST comply | Proof commits `compliant = false` |
| **Prohibition** | `type = "maximum"` | Entity MUST NOT exceed | Proof commits `compliant = false` if exceeded |
| **Permission** | `on_fail = "allow"` | Entity MAY deviate | Proof commits `compliant = true` regardless |
| **Warning** | `on_fail = "warn"` | Entity SHOULD comply | Proof commits `compliant = true` + `warning = true` |

### 6.2 Value Types

| Type | Description | Example | Internal Representation |
|---|---|---|---|
| `bps` | Basis points (0.01%) | 800 = 8.00% | `u64` |
| `seconds` | Duration in seconds | 14400 = 4 hours | `u64` |
| `count` | Integer count | 5 = max 5 incidents | `u64` |
| `currency_minor` | Lowest currency unit | 100000 = £1,000.00 | `u64` |
| `boolean` | True/false flag | 1 = true | `u64` (0 or 1) |

---

## 7. Versioning & Governance

### Rule Lifecycle

```
DRAFT ──▶ REVIEW ──▶ APPROVED ──▶ ACTIVE ──▶ DEPRECATED
  │          │           │          │             │
  └──────────┴───────────┴──────────┴─────────────┘
                    git-versioned
```

Each rule file is:
- **Git-versioned** — every change is tracked with author and timestamp
- **Signed** — approved rules are cryptographically signed by authorized reviewers
- **Immutable once active** — active rules cannot be modified, only deprecated and replaced
- **Auditable** — full history of changes available for regulatory inspection

---

## 8. Next Steps

| Step | Description | Status |
|---|---|---|
| ✅ ARSL Specification | This document | Done |
| 🔜 ARSL Parser | Rust parser: `.arsl.toml` → `ComplianceBatch` | Next |
| 🔜 CLI Tool | `arsl compile rules/fca/ --output batch.json` | Next |
| ⬜ Validation Engine | Schema validation, cross-rule conflict detection | Planned |
| ⬜ LCC Integration | ARSL as intermediate target for natural language → formal rules | Phase 2 |
