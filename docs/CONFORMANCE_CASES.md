# AGF Conformance Cases — Golden Dataset

**Version:** Phase 2 (OpenSpec v2.0)
**Date:** 2026-03-22
**Status:** Draft — pending legal SME review
**Reproducible via:** `cargo run --release --bin conformance` (all 19 cases pass)

This document records the definitive test vectors for each ARSL rule file. For each case: the regulatory source, ARSL encoding, input data, expected decision, and rationale. A legal SME should review whether each ARSL encoding correctly captures the regulatory intent.

---

## Vertical 1: HMT Financial Sanctions (`rules/sanctions/hmt.arsl.toml`)

**Regulation:** Sanctions and Anti-Money Laundering Act 2018 (SAMLA 2018)
**Regulator:** HM Treasury
**Total rules:** 5

### SAN-PASS — Clean Counterparty ✅ PASS (5/5)

| Field | Value | Interpretation |
|---|---|---|
| `counterparty_jurisdiction_hash` | 99 | NL (Netherlands) — not in HMT blocked list |
| `ubo_jurisdiction_hash` | 99 | NL — not blocked |
| `currency_code_hash` | 42 | EUR — not blocked |
| `counterparty_name_hash` | 12345 | Not on OFAC SDN list |
| `transaction_amount_gbp` | 500,000 pence | GBP 5,000 — below GBP 10,000 threshold |

**Expected:** All 5 PASS. **Actual:** ✅ All 5 PASS.

### SAN-BLOCK-JURISDICTION — Russian Counterparty 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `counterparty_jurisdiction_hash` | 18 | **HMT-SAN-001 BLOCK** — RU is in blocked list `[18,36,72,144,288,576,1152]` |

**Regulation:** SAMLA 2018 §1. Counterparty's jurisdiction hash 18 (Russia) matches `not_member_of` blocked set.
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

### SAN-BLOCK-BOTH-JUR — Both Counterparty and UBO Sanctioned 🚫 BLOCK (2/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `counterparty_jurisdiction_hash` | 18 (RU) | HMT-SAN-001 BLOCK |
| `ubo_jurisdiction_hash` | 36 (KP) | **HMT-SAN-002 BLOCK** |

**Expected:** 3 PASS, 2 BLOCK. **Actual:** ✅ 3 PASS, 2 BLOCK.

### SAN-BLOCK-OFAC-NAME — OFAC SDN Name Match 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `counterparty_name_hash` | 912,081 (0xDEAD1) | **OFAC-SDN-001 BLOCK** — hash in blocked list `[0xDEAD1..0xDEAD5]` |

**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

### SAN-BLOCK-AMOUNT — Large Transaction Threshold 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `transaction_amount_gbp` | 2,000,000 pence (GBP 20,000) | **HMT-SAN-005 BLOCK** — exceeds 1,000,000 pence (GBP 10,000) maximum |

**Regulation:** MLR 2017 Reg 33. Transactions above GBP 10,000 to high-risk counterparties require EDD.
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

---

## Vertical 2: GDPR / EU AI Act Consent (`rules/gdpr/consent.arsl.toml`)

**Regulation:** GDPR (EU) 2016/679 + EU AI Act 2024/1689
**Regulator:** ICO (UK)
**Total rules:** 5

### CON-PASS — Compliant Data Subject ✅ PASS (5/5)

| Field | Value | Interpretation |
|---|---|---|
| `gdpr_explicit_consent` | 1 | Consent given (Art. 6(1)(a)) |
| `special_category_consent` | 1 | Explicit special category consent (Art. 9(2)(a)) |
| `erasure_request_active` | 0 | No active erasure request (Art. 17) |
| `days_since_collection` | 180 | 180 days < 730-day limit (Art. 5(1)(e)) |
| `ai_prohibited_category` | 0 | Not a prohibited AI practice (EU AI Act Art. 5) |

**Expected:** All 5 PASS. **Actual:** ✅ All 5 PASS.

### CON-BLOCK-NO-CONSENT — Missing GDPR Consent 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `gdpr_explicit_consent` | 0 | **GDPR-CON-001 BLOCK** — `boolean_true` gate: value must be 1 |

**Regulation:** GDPR Art. 6(1)(a). Processing without explicit consent is unlawful.
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

### CON-BLOCK-ERASURE — Active Erasure Request 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `erasure_request_active` | 1 | **GDPR-ERA-001 BLOCK** — `equals 0` gate: value must be 0 |

**Regulation:** GDPR Art. 17. Data subject exercised right to erasure; processing must cease.
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

### CON-BLOCK-RETENTION — Retention Period Exceeded 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `days_since_collection` | 800 | **GDPR-RET-001 BLOCK** — `maximum 730` gate: 800 > 730 |

**Regulation:** GDPR Art. 5(1)(e). Data must not be retained longer than necessary (2-year default).
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

### CON-BLOCK-AI-ACT — EU AI Act Prohibited Category 🚫 BLOCK (1/5)

| Field | Value | Rule Triggered |
|---|---|---|
| `ai_prohibited_category` | 1 | **EUAI-ART5-001 BLOCK** — `equals 0` gate: must not be a prohibited practice |

**Regulation:** EU AI Act Art. 5. Social scoring, subliminal manipulation, exploitation of vulnerabilities.
**Expected:** 4 PASS, 1 BLOCK. **Actual:** ✅ 4 PASS, 1 BLOCK.

---

## Vertical 3: KYC Standard Onboarding (`rules/kyc/standard_onboarding.arsl.toml`)

**Regulation:** MLR 2017, FCA SYSC 6.3, PS22/9
**Regulator:** FCA
**Total rules:** 6

### KYC-PASS — Ideal Applicant ✅ PASS (6/6)

| Field | Value | Interpretation |
|---|---|---|
| `customer_age_years` | 25 | >= 18 (FSMA 2000 s.26) |
| `aml_risk_score` | 12 | <= 24 (standard onboarding range) |
| `id_verification_passed` | 1 | Verified (MLR 2017 Reg 28(3)(a)) |
| `country_of_birth_hash` | 77 (NL) | Not in FATF high-risk list `[36,72,101,288,512]` |
| `pep_status` | 0 | Not a PEP (MLR 2017 Reg 35(1)) |
| `applicant_name_hash` | 12345 | Not on HMT/OFAC sanctions list |

**Expected:** All 6 PASS. **Actual:** ✅ All 6 PASS.

### KYC-BLOCK-UNDERAGE — Minor Applicant 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `customer_age_years` | 16 | **KYC-AGE-001 BLOCK** — `minimum 18` gate: 16 < 18 |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

### KYC-BLOCK-AML-SCORE — High AML Risk 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `aml_risk_score` | 35 | **KYC-AML-001 BLOCK** — `maximum 24` gate: 35 > 24 → escalate to EDD |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

### KYC-BLOCK-NO-ID — Failed ID Verification 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `id_verification_passed` | 0 | **KYC-IDV-001 BLOCK** — `boolean_true` gate: not verified |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

### KYC-BLOCK-JURISDICTION — FATF High-Risk Jurisdiction 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `country_of_birth_hash` | 72 (IR/Iran) | **KYC-JUR-001 BLOCK** — `not_member_of` gate: 72 is in `[36,72,101,288,512]` |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

### KYC-BLOCK-PEP — Politically Exposed Person 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `pep_status` | 1 | **KYC-PEP-001 BLOCK** — `equals 0` gate: PEP requires EDD |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

### KYC-BLOCK-NAME-SANCTIONS — Sanctions List Name Match 🚫 BLOCK (1/6)

| Field | Value | Rule Triggered |
|---|---|---|
| `applicant_name_hash` | 11 | **KYC-SAN-001 BLOCK** — `not_member_of` gate: 11 is in `[11,22,33]` |

**Expected:** 5 PASS, 1 BLOCK. **Actual:** ✅ 5 PASS, 1 BLOCK.

---

## Vertical 4: FCA Consumer Duty / DORA (`rules/fca/consumer_duty.arsl.toml`)

**Regulation:** FCA Consumer Duty + DORA ICT requirements
**Regulator:** FCA / ESMA
**Total rules:** 10

### MULTI-VERTICAL-PASS — All Capital & DORA Rules Pass ✅ PASS (10/10)

Stress test capital = 600 bps (6.00%) > 550 bps (5.50%) threshold.
**Expected:** All 10 PASS. **Actual:** ✅ All 10 PASS.

### MULTI-VERTICAL-BLOCK — Stress Test Capital Breach 🚫 BLOCK (1/10)

Stress test capital = 480 bps (4.80%) < 550 bps (5.50%) threshold.
Rule FCA-CD-009 blocks. Matches the original OpenSpec v1.3 benchmark exactly.
**Expected:** 9 PASS, 1 BLOCK. **Actual:** ✅ 9 PASS, 1 BLOCK.

---

## Summary

| Vertical | Cases | Rules | Result |
|---|---|---|---|
| HMT Sanctions | 5 | 5 | ✅ All pass |
| GDPR/EU AI Act | 5 | 5 | ✅ All pass |
| KYC Onboarding | 7 | 6 | ✅ All pass |
| FCA Capital + DORA | 2 | 10 | ✅ All pass |
| **Total** | **19** | **26 distinct** | **✅ 19/19** |

**Host evaluation time:** 5.4ms (all 19 cases)

> [!IMPORTANT]
> This document is a technical test harness, not a legal opinion. The ARSL encodings must be reviewed by a qualified legal SME to confirm they correctly capture the regulatory intent of each referenced article. In particular: the jurisdiction hash values, AML score threshold (24), and retention period (730 days) should be validated against the specific entity type and jurisdiction context.

