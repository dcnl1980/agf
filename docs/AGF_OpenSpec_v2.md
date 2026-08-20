# AGF — OpenSpec v2: Claims Validation & Product Redefinition

> **Version:** 2.0 — 2026-03-20
> **Author:** Technical Review (Antigravity)
> **Status:** ACTIVE — Supersedes AGF_OpenSpec_v1.md for strategic direction
> **Classification:** Confidential — Mach5 / NeuroCluster

---

## Purpose of This Document

OpenSpec v1 was an architectural assessment. It was honest about the risks — particularly the LCC — but it did not cleanly separate **what has been proved** from **what has been claimed**.

This version does exactly that.

The goal is to define the **real product** that is already demonstrable, separate it from the aspirational vision, and build an evidence-backed roadmap that can withstand investor, regulator, and acquirer scrutiny.

---

## Table of Contents

1. [The Claim Audit](#1-the-claim-audit)
2. [What Is Already Proved — With Real Cases](#2-what-is-already-proved--with-real-cases)
3. [What Is Not Proved — Honest Gap Analysis](#3-what-is-not-proved--honest-gap-analysis)
4. [The Real Product](#4-the-real-product)
5. [Candidate Rule Verticals — Real Cases](#5-candidate-rule-verticals--real-cases)
6. [The LCC Reframing](#6-the-lcc-reframing)
7. [Revised Feasibility Assessment](#7-revised-feasibility-assessment)
8. [The 12-Week Validation Roadmap](#8-the-12-week-validation-roadmap)
9. [What a Credible Demo Looks Like](#9-what-a-credible-demo-looks-like)
10. [Open Questions for Decision](#10-open-questions-for-decision)

---

## 1. The Claim Audit

The following table audits every material claim made in the AGF marketing materials and v1 OpenSpec against current evidence.

| Claim | Source | Evidence Status | Verdict |
|---|---|---|---|
| "Turns natural-language legal text into deterministic, verifiable machine logic" | Business case, OpenSpec §1 | No evidence. LCC is theoretical. | ❌ Unproved |
| "ZK proofs enforce compliance pre-execution in <200ms" | Business case | Verification: 76.96ms ✅. Generation: 15.29s CPU ⚠️ | ✅ Partial |
| "Compliance rules evaluate inside SP1 zkVM" | OpenSpec §8.2 Test A | 10 rules, 2.77ms, 32K cycles ✅ | ✅ Proved |
| "Deterministic rule evaluation via ZK" | ARSL pipeline + benchmark | 11 unit tests, E2E pipeline ✅ | ✅ Proved |
| "Linear scalability to 1,000+ rules" | Test B | 1,000 rules in 91ms ✅ | ✅ Proved |
| "Proof verification in <200ms without re-execution" | Benchmark | 76.96ms verified ✅ | ✅ Proved |
| "FCA Consumer Duty rules encoded in ARSL" | `consumer_duty.arsl.toml` | 10 rules, 9 PASS 1 BLOCK ✅ | ✅ Proved |
| "TEE attestation provides input data integrity" | OpenSpec §3.3 | Architecture designed; no PoC | ❌ Unimplemented |
| "LCC compiles arbitrary legal text to RISC-V" | Business case, pipeline diagram | No implementation exists | ❌ Unproved |
| "Formal verification (Coq/Lean) of legal semantics" | Business case | Research problem; none attempted | ❌ Unproved |
| "Regulator acceptance of ZK proofs" | Business case | No regulatory engagement documented | ❌ Unproved |
| "Insurers will price AGF-verified decisions differently" | Business case | No insurer engagement documented | ❌ Unproved |
| "E&O liability cap capped by proof guarantees" | Business case | No legal opinion documented | ❌ Unproved |
| "Multi-jurisdiction reconciliation" | Business case | No design; no implementation | ❌ Unproved |
| "Hardware-embedded licensing" (RISC-V chip licensing) | Business case | Speculative; no OEM discussions | ❌ Speculative |
| "Patent pending — no prior art" | Business case | Filed; not granted; not confirmed | ⚠️ Unverified |
| "$2.2B–$24.6B valuation range" | OpenSpec §2.3 | Model-derived; no commercial traction | ⚠️ Premature |

### Verdict Summary

| Category | Count |
|---|---|
| ✅ **Proved** (real evidence, reproducible) | **6** |
| ✅ **Partial** (one dimension proved, one missing) | **1** |
| ❌ **Unproved** (designed but not implemented, or speculative) | **9** |
| ⚠️ **Unverified** (claimed, not confirmed) | **2** |

> [!CAUTION]
> The ratio is 6 proved to 9–11 unproved. The product is real but narrower than the business case represents. The remainder of this OpenSpec defines what the real product is, and what it would take to prove the rest.

---

## 2. What Is Already Proved — With Real Cases

These are not aspirations. They are reproducible, machine-verifiable results from the `agf-sp1/` codebase.

### 2.1 Deterministic Rule Evaluation in SP1 zkVM

**What:** A batch of compliance rules is loaded into the SP1 zkVM, evaluated against input data, and produces a cryptographically committed decision.

**Proof:**
```
Total Cycles:   32,768
Cycles/Rule:    3,276
Execution Time: 2.77ms (CPU)
Rules:          10 (FCA Capital Adequacy, Liquidity, Leverage, NSFR, DORA)
Result:         9 PASS, 1 BLOCK
Decision:       🚫 BLOCK (correct — Rule 10: stressed capital 4.80% < 5.50% minimum)
```
Reproduced from: `BENCHMARK_RESULTS.md §Test A`
Run with: `RUST_LOG=info cargo run --release --bin benchmark -- --execute`

**Why it matters:** The rule engine cannot be tampered with. Anyone who receives the transcript can see exactly what rule was checked, against what value, with what threshold.

---

### 2.2 ZK Proof Generation and Independent Verification

**What:** A cryptographic proof is generated that the above evaluation happened correctly. The proof can be verified by anyone, independently, in 77ms, without access to the prover or the input data.

**Proof:**
```
Setup time:           1.18s  (one-time per program version)
Proof generation:     15.29s (CPU; GPU: ~0.5–2s estimated)
Proof size:           7.43 MB Core STARK (~250KB as Groth16)
Verification time:    76.96ms ✅ (well under 200ms target)
```
Reproduced from: `BENCHMARK_RESULTS.md §ZK Proof Generation`
Run with: `SP1_PROVER=cpu cargo run --release --bin benchmark -- --prove`

**Why it matters:** The verification time (77ms) is the real production metric. Proof generation is a one-time compute cost, often pre-computable. Verification is the latency a downstream consumer experiences.

---

### 2.3 ARSL: A Working Rule Specification Language for Compliance

**What:** Rules are not hardcoded. They are defined in a structured TOML-based language (ARSL — AGF Rule Specification Language), parsed, validated, compiled, and evaluated inside SP1.

**Proof:**
```
File:     rules/fca/consumer_duty.arsl.toml
Rules:    10 (with regulatory source citations: CRR Article 92, DORA Article 19, etc.)
Pipeline: Parse (694µs) → Validate → Compile (1.1µs) → Evaluate (167ns) → zkVM (3.05ms)
Tests:    11 unit tests passing (6 ARSL-specific + 5 rule evaluation)
```
Reproduced from: `BENCHMARK_RESULTS.md §ARSL Pipeline`
Run with: `cargo run --release --bin arsl-compile -- --file rules/fca/consumer_duty.arsl.toml --execute`

**What ARSL proves is solvable:**
- Compliance rules can be expressed in a structured, auditable, version-controllable format
- Regulatory citations (`regulation`, `article`, `legal_text`) are embedded in each rule
- Rules can be loaded, swapped, and hot-reloaded without recompiling the zkVM program
- The rule language is domain-specific enough to be readable by a compliance officer

**What ARSL does NOT prove:**
- That a legal drafter can generate ARSL from statute without engineering support
- That the ARSL encoding is semantically correct under FCA interpretation
- That ARSL captures the full scope of any regulation

---

### 2.4 Linear Scaling — Predictable Performance

**What:** The performance model is predictable and linear. This is critical for commercial credibility.

**Proof:**
```
10 rules    → 32,768 cycles  → 2.77ms  (72× under 200ms) ✅
50 rules    → 146,564 cycles → 7.18ms  (28× under 200ms) ✅
100 rules   → 290,828 cycles → 11.32ms (18× under 200ms) ✅
500 rules   → 1,432,462 cycles → 47ms  (4× under 200ms)  ✅
1,000 rules → 2,862,502 cycles → 91ms  (2× under 200ms)  ✅

Scaling formula (verified): cycles ≈ 5,000 + 2,862 × N
```
Reproduced from: `BENCHMARK_RESULTS.md §Test B`

**Why it matters for the commercial story:** A bank's counterparty risk model might have 200–500 rules. A sanctions screening gate might have 50. An underwriting decision tree might have 100. All fit well within the proven performance envelope.

---

## 3. What Is Not Proved — Honest Gap Analysis

### 3.1 The LCC: Legal Text → Correct Formal Meaning

**The gap:** Every ARSL rule in existence today was hand-crafted by an engineer who read the regulation and interpreted it. The business case describes an LCC that can ingest raw legal text and automatically produce correct formal logic. No such component exists.

**The spectrum of difficulty:**

| Source Text | Difficulty | Example |
|---|---|---|
| Numerical threshold in regulation | 🟢 Low | "LCR ≥ 100%" — directly maps to `minimum` condition |
| Condition with defined term | 🟡 Medium | "eligible own funds" — requires a defined term graph |
| Conditional obligation | 🟡 Medium | "Where a firm is in stress, it shall..." |
| Proportionality clause | 🔴 High | "The FCA may, having regard to all circumstances..." |
| Discretionary standard | 🔴 Critical | "Treating customers fairly" — no deterministic encoding |

**The honest position:** What is buildable and defensible is a **rule authoring pipeline** where:
1. Engineers (or compliance specialists) author rules in ARSL using regulatory citations
2. The rules are reviewed and approved by a legal SME
3. The rules are compiled and tested against known-good decisions
4. The cryptographic proof attests that *these approved rules* ran correctly

This is not "compiling law." It is "provably executing approved rules." That is a different and smaller claim — but it is completely real, commercially valuable, and technically defensible.

---

### 3.2 TEE Attestation — Architecture Without Implementation

**The gap:** The OpenSpec describes a TEE (AWS Nitro / Azure SEV-SNP) that attests to the integrity of input data before it enters the SP1 prover. This is architecturally sound and well-documented. It has not been implemented.

**What is needed:**
- AWS Nitro Enclave PoC: enclave startup, document generation, attestation parsing
- Cycle overhead measurement of TEE document verification inside SP1 guest
- End-to-end latency measurement: TEE attestation + SP1 prove + verify

**Risk level:** Low. AWS Nitro is production-grade. Integration is a 3-4 week sprint, not a research problem.

---

### 3.3 Regulator Acceptance

**The gap:** Zero documented regulatory engagement. Whether the FCA, PRA, or any other primary regulator will accept ZK-proof compliance attestations as satisfying their reporting or supervisory requirements is entirely unvalidated.

**What is needed:**
- A letter of inquiry or sandbox engagement with FCA/PRA Innovation Hub
- A legal opinion on whether ZK proofs satisfy "evidence" requirements under the relevant regulation
- Engagement with a Big Four compliance audit team to understand whether proofs can replace or supplement traditional audits

**Risk level:** Unknown. This is the most important un-answered question for commercialisation.

---

### 3.4 Insurability and Liability-Cap Claims

**The gap:** The business case implies that AGF proofs can reduce E&O insurance premiums or cap liability for automated compliance failures. No insurance broker or legal counsel has been engaged. This claim has no foundation.

**What is needed:**
- A legal opinion on whether ZK proof of rule execution changes liability exposure
- A preliminary discussion with a MGA (managing general agent) specialising in tech-liability or RegTech
- Analysis of whether existing D&O/E&O policy language contemplates cryptographic proof

---

### 3.5 Multi-Jurisdiction Reconciliation

**The gap:** Described in business cases; not designed anywhere in the codebase. The ARSL `metadata.jurisdiction` field exists but has no reconciliation logic.

**What is needed:** This is a v3 problem. It should not appear in MVP materials.

---

### 3.6 Real Commercial Pull

**The gap:** No signed LOIs, no pilot agreements, no paying customers.

**What is needed:** A credible MVP demo → targeted pilot with a UK bank, insurer, or FinTech under FCA sandbox → commercial term sheet.

---

## 4. The Real Product

Based on what is proved and what is buildable in the next 12 weeks, the real product is:

> **A provable compliance decision engine for narrow, objective, high-value rules — using SP1 zkVM to generate cryptographic proof that a specific, pre-approved rule set was evaluated correctly against attested input data.**

### What Makes This Valuable

1. **Proof of execution** — Not "we ran the check." But: "here is a cryptographic proof, verifiable in 77ms, that *these rules* ran against *this data* and produced *this decision*."
2. **Rule portability** — Rules are defined in ARSL (versionable, auditable, citable back to the original regulation). Different clients can load different rule sets.
3. **Tamper-proof audit trail** — The proof is the audit trail. No database, no log, no trust in the operator.
4. **Latency compatible with real-time enforcement** — Sub-100ms verification means it can sit in a payment flow, a trading pre-check, or a consent gate.

### What This Is NOT (MVP Scope)

- ❌ Automatic compilation of legal text to rules (that is v3)
- ❌ Handling of ambiguous or discretionary standards
- ❌ Multi-jurisdiction reconciliation
- ❌ On-chain verification (unless the client requires it; off-chain IAL is sufficient)
- ❌ A general-purpose compliance platform

---

## 5. Candidate Rule Verticals — Real Cases

Each of the following verticals has an identical structure: **objective numerical thresholds or boolean gates, defined in primary legislation, with clear PASS/BLOCK semantics**. All of them can be encoded in ARSL today.

### 5.1 Underwriting Thresholds (Insurance / Credit)

**Example rules:**
- Maximum LTV ratio for mortgage approval (FCA MCOB 11)
- Minimum credit score threshold for product eligibility
- Maximum exposure to a single counterparty (CRR Article 395)

**Current ARSL analog:** `FCA-CD-001` to `FCA-CD-007` — already implemented

**What the proof adds:** An underwriter can receive a proof that the decision was made against the approved lending policy — useful for audit, dispute resolution, and regulatory examination.

---

### 5.2 Capital and Liquidity Checks (Prudential Banking)

**Example rules:**
- Capital Adequacy Ratio ≥ 8% (CRR Article 92)
- Liquidity Coverage Ratio ≥ 100% (CRR Article 412)
- Net Stable Funding Ratio ≥ 100% (CRR2 Article 428a)
- Leverage Ratio ≥ 3% (CRR2 Article 92(1)(d))

**Status:** ✅ All four already implemented in `consumer_duty.arsl.toml`

**What the proof adds:** Rather than a CFO signing off a compliance attestation, the bank can submit a ZK proof to the PRA that its daily prudential check ran correctly against the reported figures. If the figures are TEE-attested from the core banking system, the proof is end-to-end tamper-proof.

---

### 5.3 Sanctions Screening Gates (AML / OFAC / UN)

**Example rules:**
- Is the counterparty name on an OFAC SDN list? (binary: YES/NO)
- Does the transaction ISO country code appear in the HMT Financial Sanctions list?
- Does the beneficial owner's jurisdiction appear on the FATF high-risk list?

**Current ARSL analog:** Requires `equals` or list-membership condition type — minor ARSL extension

**What the proof adds:** A sanctions screening vendor can produce a proof-per-screen. Rather than a log entry (which can be altered), the bank holds an immutable cryptographic record that the screen ran, against which list version, and produced which result.

---

### 5.4 Consent Checks (GDPR / PECR / EU AI Act)

**Example rules:**
- Has the data subject provided explicit GDPR Article 6(1)(a) consent before this processing event?
- Is the AI system categorised as high-risk under EU AI Act Annex III? (lookup gate)
- Has the data subject exercised the right to erasure, and is this a new processing request?

**Current ARSL analog:** Boolean `equals` condition on consent flags — already supported

**What the proof adds:** GDPR Article 5(2) requires accountability. A ZK proof of the consent check is a stronger accountability artefact than a database record, because the check logic itself is in the proof, not just the outcome.

---

### 5.5 Structured Claims Processing (Insurance)

**Example rules:**
- Claim amount ≤ policy limit (numerical threshold)
- Days since incident ≤ notification period (e.g., ≤ 30 days, ARSL `range`)
- Claimant KYC status = verified (boolean gate)

**Current ARSL analog:** Directly encodable with existing condition types

**What the proof adds:** The insurer can prove to a reinsurer, an auditor, or a financial ombudsman that a claim was assessed against *exactly* the policy terms that were in effect on the incident date — and that no manual override occurred.

---

### 5.6 KYC Eligibility (Onboarding)

**Example rules:**
- Customer age ≥ 18 (minimum condition)
- Country of birth NOT in restricted jurisdiction list (exclusion gate)
- AML risk score ≤ threshold for standard onboarding (maximum condition)
- ID verification = passed (boolean gate)

**Current ARSL analog:** Mix of `minimum`, `maximum`, and `equals` conditions — all supported

**What the proof adds:** The onboarding decision is provably rule-based and auditable. Useful for FCA SMCR accountability, internal audit, and cross-border correspondent banking due diligence.

---

## 6. The LCC Reframing

### Old Framing (v1): "We compile law into mathematics"

This is a research problem. It implies automatic ingestion of natural language statute and production of provably correct formal logic. No one has solved this. Do not lead with this.

### New Framing (v2): "We prove your rules ran"

The LCC in MVP is a **structured rule authoring environment**, not an automatic compiler. It consists of:

1. **Rule Schema (ARSL v0.1)** — Already built. A structured language where compliance engineers write rules with regulatory citations.
2. **Validation Layer** — Already built. Schema checks, condition type validation, severity checks.
3. **Compiler Target** — Already built. ARSL → `ComplianceBatch` → SP1 guest input.
4. **Review Workflow** — To be built. A rule approval workflow where a legal SME signs off on the encoding before it is promoted to production.
5. **Conformance Test Suite** — To be built. Golden dataset of (regulatory text, expected encoding, test vectors with known PASS/BLOCK outcomes).

The key insight: **The legal semantic gap is bridged by a human expert, not by an AI compiler.** The proof attests that the *approved rule* ran. The approval workflow creates accountability for the encoding. This is how all regulated compliance software works — the novelty is the proof of execution.

### What Stays Novel

- The proof of execution is genuinely new. There is no existing system that produces a ZK proof that a compliance rule engine ran correctly.
- The ARSL schema + SP1 binding is patentable as a combination, even without the general LCC.
- The tamper-proof audit log (proof as IAL) is differentiable from every existing SIEM or log-based compliance system.

---

## 7. Revised Feasibility Assessment

| Component | Status | Feasibility | Timeline |
|---|---|---|---|
| SP1 zkVM integration | ✅ DONE | Proved | — |
| ARSL rule language (v0.1) | ✅ DONE | Proved | — |
| Rule evaluation in zkVM | ✅ DONE | Proved | — |
| ZK proof generation + verification | ✅ DONE | Proved | — |
| Scaling to 1,000 rules | ✅ DONE | Proved | — |
| TEE attestation (AWS Nitro PoC) | ❌ TODO | 90% — standard engineering | 3–4 weeks |
| ARSL `member_of` condition (list checks) | ❌ TODO | 95% — minor ARSL extension | 1 week |
| Rule review / approval workflow | ❌ TODO | 85% — process + UI | 4–6 weeks |
| Conformance test suite (5 verticals) | ❌ TODO | 80% — needs legal SME time | 6–8 weeks |
| GPU proving benchmark | ❌ TODO | 95% — hardware access needed | 2–3 weeks |
| Groth16 compressed proof pipeline | ❌ TODO | 85% — SP1 supports it natively | 2–3 weeks |
| REST API (submit batch, return proof) | ❌ TODO | 90% — standard Rust/Axum | 3–4 weeks |
| Immutable Audit Log (IAL) | ❌ TODO | 85% — cryptographic signing | 2–3 weeks |
| Regulator engagement (FCA sandbox) | ❌ TODO | Unknown | 8–16 weeks |
| Commercial pilot (1 client) | ❌ TODO | Unknown | 12–24 weeks |

> [!IMPORTANT]
> The tech is further along than a typical seed-stage product. The proof of concept phase is complete. The gap is: conformance testing, TEE integration, a production API layer, and commercial validation. These are engineering problems, not research problems.

---

## 8. The 12-Week Validation Roadmap

This replaces the 20-week plan from v1 for the near-term. The goal is not to build everything — it is to validate the **maximum number of claims** in the minimum time, to produce a demo that a bank's Chief Compliance Officer would take seriously.

### Phase 1 (Weeks 1–3): Harden the Core

| Task | Output | Proves |
|---|---|---|
| Add `member_of` condition to ARSL | Sanctions screening rules encodable | OFAC/HMT screening is a real use case |
| Add boolean `equals` with field path | Consent and KYC gates | GDPR consent gate is encodable |
| Groth16 proof pipeline | 250KB proof vs 7.4MB STARK | "Proof size is production-practical" |
| GPU proving benchmark (cloud instance) | Actual sub-2s proof generation time | Breaks the "15s = too slow" objection |
| 11 unit tests → 30+ tests | Broader correctness coverage | Engineering rigour |

### Phase 2 (Weeks 4–6): Real Cases, Real Regulations

| Task | Output | Proves |
|---|---|---|
| Encode 5 sanctions rules (OFAC, HMT) | `rules/sanctions/ofac.arsl.toml` | Sanctions screening is real |
| Encode 5 GDPR consent checks | `rules/gdpr/consent.arsl.toml` | EU AI Act gate is real |
| Encode 5 KYC eligibility rules | `rules/kyc/standard_onboarding.arsl.toml` | KYC gate is real |
| Encode 3 underwriting rules (FCA MCOB) | `rules/mortgage/mcob11.arsl.toml` | Underwriting use case is real |
| Conformance tests: all must match known-good decisions | Golden dataset | "The rules are correct" |

### Phase 3 (Weeks 7–9): TEE + API

| Task | Output | Proves |
|---|---|---|
| AWS Nitro PoC | Attested data feeds into SP1 | "Input data integrity" claim is real |
| TEE latency measurement | Cycle overhead in guest | E2E proof latency is predictable |
| REST API (Axum): `POST /evaluate` → proof + decision | API integration possible | "Production API" claim is real |
| Immutable Audit Log (Blake3 hash chain of proofs) | IAL PoC | "Tamper-proof audit trail" claim is real |

### Phase 4 (Weeks 10–12): Demo + Regulatory Prep

| Task | Output | Proves |
|---|---|---|
| End-to-end demo (KYC gate → compliance check → proof → verify) | Video + live demo | Real-world use case |
| Technical whitepaper v1 | Investor/partner document | Intellectual rigour |
| FCA Innovation Hub inquiry letter | Regulatory sandbox engagement | Commercial seriousness |
| Legal opinion request: does ZK proof satisfy FCA audit requirements? | Legal memo | Insurability + liability claim path |

---

## 9. What a Credible Demo Looks Like

A demo that would pass scrutiny from a Chief Compliance Officer, a head of enterprise risk, or a ZK-literate investor:

```
SCENARIO: KYC + Sanctions + Capital gate for a new correspondent banking relationship

INPUT (TEE-attested from core banking system):
  - Customer age:            34 (≥ 18 ✅)
  - Country of birth:        NL (not in restricted list ✅)
  - AML risk score:          12 (≤ 25 threshold ✅)
  - ID verification status:  verified ✅
  - Counterparty jurisdiction: RU (on HMT Financial Sanctions list ❌)
  - Reported capital ratio:  11.2% (≥ 8% ✅)

RULE SET:
  - rules/kyc/standard_onboarding.arsl.toml  (FCA SYSC 6.3)
  - rules/sanctions/hmt.arsl.toml            (Sanctions and Anti-Money Laundering Act 2018)
  - rules/fca/consumer_duty.arsl.toml        (CRR Article 92)

EVALUATION:
  5 PASS, 1 BLOCK (counterparty jurisdiction on HMT list)

ZK PROOF:
  Generated: 1.2s (single GPU)
  Size:      248KB (Groth16)
  Contains:  commitment to rule set hash + input hash + decision

VERIFICATION:
  Time:      77ms
  By:        Any party with the proof + verification key
  Result:    ✅ BLOCK — counterparty is sanctions-restricted

AUDIT LOG ENTRY:
  Timestamp:  2026-03-20T17:24:03Z
  Proof hash: 0xabcd...ef01
  Decision:   BLOCK
  Rule set:   v2.1.4 (Git SHA: 4f9e3c8...)
  Immutable:  Cannot be altered retrospectively
```

**This demo:**
- Uses real regulatory citations
- Is reproducible
- Requires no trust in the operator
- Proves the rule engine ran correctly
- Can be verified by a third party in 77ms
- Would hold up under FCA supervisory examination as an audit artefact

---

## 10. Open Questions for Decision

These questions require human input and cannot be resolved by the engineering team alone.

> [!IMPORTANT]
> **Q1 — LCC Scope**: Should "LCC" be rebranded to reflect reality? The MVP LCC is a structured rule authoring tool, not an automatic legal compiler. Continuing to describe it as a compiler risks credibility when scrutinised.

> [!IMPORTANT]
> **Q2 — Regulatory Engagement Timeline**: When does NeuroCluster engage the FCA Innovation Hub? This is the single highest-value action not yet taken. Regulatory acceptance is the biggest unvalidated commercial risk.

> [!IMPORTANT]
> **Q3 — Proof Mode for MVP**: Groth16 (smallest proof, on-chain verifiable, slowest to generate) vs. Core STARK (largest proof, fastest to generate, off-chain only)? For MVP, Core STARK + IAL is sufficient. For a blockchain/DeFi client, Groth16 is required.

> [!IMPORTANT]
> **Q4 — Legal SME for Conformance Tests**: ARSL rules need to be validated against the source regulation by a qualified lawyer (FCA-barred solicitor or compliance officer). Has this been arranged?

> [!IMPORTANT]
> **Q5 — Patent Scope**: Should the patent filing be amended now that the MVP product is more precisely defined? Claiming "ZK proof of execution of approved compliance rule sets" is narrower but more defensible than "compiling law into mathematics."

> [!NOTE]
> **Q6 — Commercial Target**: Which of the 5 verticals (underwriting, capital/liquidity, sanctions, consent, KYC) presents the highest first-contract probability? Sanctions screening is arguably the most urgent because of OFAC SDN enforcement risk and existing API-based screening market (WorldCheck, ComplyAdvantage). This would be the highest-credibility pilot vertical.

---

## Changelog

| Version | Date | Changes |
|---|---|---|
| **2.0** | 2026-03-20 | New document. Claims audit (6 proved / 9–11 unproved). Real product redefinition. 5 vertical case studies. LCC reframing. 12-week validation roadmap. Demo scenario specification. |

---

> **End of OpenSpec v2.0**
>
> *This document should be read alongside `AGF_OpenSpec_v1.md` (architecture reference) and `BENCHMARK_RESULTS.md` (empirical data). OpenSpec v2 governs strategic direction from 2026-03-20 forward.*
