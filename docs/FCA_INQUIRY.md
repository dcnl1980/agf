# FCA Innovation Hub — Inquiry Letter

**[Date]**

Innovation Hub Team
Financial Conduct Authority
12 Endeavour Square
London E20 1JN

**Re: Innovation Hub Inquiry — Agentic Governance Framework (AGF): Deterministic Compliance Evaluation with Cryptographic Audit Integrity**

---

Dear Innovation Hub Team,

## 1. Company Introduction

NeuroCluster is a technology firm specialising in compliance automation for financial services. We have developed the **Agentic Governance Framework (AGF)**, a system that evaluates formalised representations of regulatory rules against entity data and produces a cryptographically signed, tamper-evident audit trail.

## 2. The Innovation

AGF automates the mechanically evaluable portion of compliance assessment using a **deterministic, verifiable computation**:

1. **Rules** are expressed in a machine-readable specification language (ARSL) that references specific FCA and EU regulation (e.g., CRR Article 92, MLR 2017 Regulation 28). These rules are authored interpretations of regulatory text, not regulator-published specifications.
2. **Evaluation** is a pure function — the same inputs and rules always produce the same output. There is no randomness or discretion in the computation itself.
3. **The result** is digitally signed (Ed25519, per RFC 8032) and appended to a Blake3 hash-chained audit log. A third party can verify the signature to confirm the integrity of the evaluation artifact, though this confirms execution integrity rather than the accuracy of the underlying input data.
4. **Isolation**: The evaluation runs inside a dedicated virtual machine (Kata Containers) on Kubernetes with zero network egress, reducing the risk of data exfiltration from the evaluation environment.

**Current coverage:** 26 rules across KYC (MLR 2017), Sanctions (SAMLA 2018), Capital Adequacy (CRR/CRR2), and GDPR/EU AI Act — implemented as a prototype.

**Prototype performance:** Evaluation of all 26 rules in under 3 milliseconds (internal measurement on a single hardware configuration). This compares favourably to the time typically required for equivalent manual assessments, though we recognise that manual processes perform additional judgment-dependent functions that the system does not automate.

## 3. Specific Questions for the Innovation Hub

We respectfully seek guidance on the following:

### 3.1 Cryptographic Audit Evidence
Under FCA SYSC 9 (Record Keeping) and MiFID II Article 16(6), firms must maintain adequate records. We understand the FCA's framework is technology-neutral and that tamper-evident audit trails with cryptographic integrity are consistent with digital record-keeping expectations. **We seek the FCA's view on whether a Blake3 hash-chained, Ed25519-signed evaluation result would be an acceptable format for audit artefacts**, and whether any additional requirements (e.g., specific hash algorithms, retention formats, or third-party certification) would apply.

### 3.2 Deterministic Rule Evaluation
Our rules are compiled from regulatory text into machine-readable specifications by subject-matter experts. The evaluation is deterministic: given the same inputs and rules, the output is always identical. **Does the FCA consider such deterministic evaluation a useful complement to existing compliance processes under SYSC 6.1 (Compliance)?** We recognise that deterministic evaluation covers the mechanically evaluable subset of compliance obligations and does not replace professional judgment where required.

### 3.3 Zero-Knowledge Proofs as Supervisory Evidence
We are developing a capability to produce **zero-knowledge proofs** of compliance evaluation. These proofs cryptographically demonstrate that a specific computation was performed correctly, without revealing the underlying entity data. This capability has been demonstrated in a prototype but is not yet deployed in production. **Would the FCA consider zero-knowledge proofs a potentially useful form of evidence that a compliance computation was performed correctly?** We seek early-stage guidance on whether this direction warrants further development for supervisory purposes.

## 4. Demonstration

We would welcome the opportunity to demonstrate AGF to the Innovation Hub team. A live demo evaluates a test entity across four regulatory verticals and produces a verifiable audit bundle that can be independently checked using our `agf-verify` command-line tool.

A detailed technical whitepaper is available upon request, including architecture description, trust-model analysis, benchmark methodology, and an explicit discussion of limitations and assumptions.

## 5. Contact

**[Name]**
NeuroCluster
**[Email]**
**[Phone]**

---

*This inquiry is submitted under the FCA Innovation Hub's open inquiry process. We understand this does not constitute a regulatory application and that any guidance provided is informal. Nothing in this letter should be construed as a claim that AGF guarantees compliance with any specific law or regulation.*
