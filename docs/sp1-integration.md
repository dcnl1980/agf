# SP1 Zero-Knowledge Integration Plan

## Overview

[SP1](https://docs.succinct.xyz/docs/sp1/introduction) is a zero-knowledge virtual machine (zkVM) by Succinct Labs. It proves the correct execution of programs compiled for RISC-V, meaning standard Rust code can generate cryptographic proofs without custom circuit design or cryptography expertise.

SP1 directly strengthens Favoom's core claim: **"Favoom never stores personal data."** With ZK proofs, we upgrade from a privacy promise to a **cryptographic guarantee** — verifiers can confirm that trust scores and attestations are valid without Favoom or any third party ever revealing the underlying data.

## Why SP1

| Property | Detail |
|----------|--------|
| **Language** | Standard Rust — no circuit DSLs, no cryptography expertise needed |
| **Proof System** | Hypercube (V6) — multilinear polynomial commitments, state-of-the-art performance |
| **Verification** | On-chain (Solidity verifier on Base L2) or off-chain |
| **License** | MIT + Apache 2.0 (fully open source) |
| **Maturity** | Production-ready, rigorously audited by top security firms |

---

## Integration Points

### 1. Zero-Knowledge Trust Score Proofs

**Problem:** The trust score (0–100) is computed server-side from profile completeness, favorites received, introductions made, community participation, CRM engagement, and account maturity. Third-party verifiers must trust Favoom's API that this number is honest.

**Solution:** Move the trust score computation into an SP1 Rust program:
- **Private inputs**: Raw signal counts (favorites, introductions, communities, etc.)
- **Public output**: Final trust score (u8) + cryptographic proof
- The proof is verifiable on Base L2 — directly alongside the FavoomID Soulbound Token

```
┌─────────────────────────────┐
│  SP1 Program (Rust)         │
│  Private inputs:            │
│    • profile_fields_count   │
│    • favorites_received     │
│    • introductions_made     │
│    • community_count        │
│    • crm_contacts           │
│    • account_age_days       │
│  Public output:             │
│    • trust_score: u8        │
│    • proof: bytes           │
└─────────────────────────────┘
          │
          ▼ verify on-chain
┌─────────────────────────────┐
│  Base L2 Verifier Contract  │
│  SP1Verifier.verifyProof()  │
│  → stores score on FavoomID │
└─────────────────────────────┘
```

**Impact:** A ZK-proven trust score attached to a Soulbound Token is a genuinely novel primitive. No competitor in professional identity has this.

### 2. Zero-Knowledge Attestation Verification

**Problem:** The `verify()` endpoint answers queries like "Does this user have bank verification?" with YES/NO. Verifiers trust Favoom's API to answer honestly, and the query reveals which attestation types the verifier cares about.

**Solution:** Replace/augment verification with a ZK proof:
- **Private input**: User's full attestation set (types, sources, expiry)
- **Public input**: The verification query (e.g., `IDENTITY_BANK = true, TRUST_SCORE >= 60`)
- **Output**: `{ verified: true/false }` + proof

**Impact:**
- Verifiers get a cryptographic guarantee, not an API promise
- User's attestation details (source, claims, timestamps) remain completely hidden
- Selective disclosure becomes *provably* selective

### 3. Connector SDK Integrity Proofs (Long-term)

**Problem:** When a ConnectorOrg (employer, university) submits an attestation via the Connector SDK, we trust the connector is legitimate and the data hasn't been tampered with between their system and our API.

**Solution:** Connectors generate ZK proofs that:
1. The attestation data originated from a specific signed data source
2. The connector applied the correct transformation rules
3. The resulting attestation hash matches what's stored on-chain

**Impact:** Positions Favoom as the most trustworthy identity protocol — not just "we encrypt data" but "every step in the pipeline is mathematically verified."

---

## What SP1 Does Not Solve

| Concern | Why SP1 doesn't help |
|---------|---------------------|
| **Identity verification itself** | SP1 proves computation, not that iDIN/eIDAS verified a real person. Identity providers are still required. |
| **Key management** | SP1 doesn't manage encryption keys or wallets. The AES-256 key vault is still needed. |
| **On-chain gas costs** | SP1 proof verification on Base L2 costs gas (~200–400K gas per verification). Batch proofs where possible. |
| **Real-time messaging** | Trust-gated messaging needs speed, not proof generation. Use cached trust scores for filtering. |

---

## Architecture

### Proving Infrastructure

SP1 programs are written in **Rust**. Since the Favoom backend is Python/FastAPI, proving runs as either:

1. **Succinct Prover Network (Recommended for MVP)** — Hosted proving-as-a-service. Submit programs via API, receive proofs. No GPU infrastructure needed.
2. **Self-hosted Rust microservice** — A containerized Rust service called from the Python backend. Required for air-gapped enterprise deployments.

### Data Flow

```
User action (e.g. new attestation)
    │
    ▼
Python Backend (FastAPI)
    │ collect private inputs from DB
    ▼
SP1 Prover (Rust service or Succinct Network)
    │ generate proof
    ▼
Base L2 Smart Contract
    │ SP1Verifier.verifyProof()
    ▼
FavoomID SBT updated with proven trust score
```

### On-Chain Components

| Contract | Purpose |
|----------|---------|
| `FavoomID.sol` | Soulbound Token — existing, add `provenTrustScore` field |
| `SP1Verifier.sol` | Succinct-provided verifier contract (deployed on Base) |
| `TrustScoreVerifier.sol` | Wrapper: accepts SP1 proof, validates, updates FavoomID |

---

## Implementation Phases

### Phase A: PoC — ZK Trust Score (2–3 weeks)

- [ ] Write SP1 Rust program implementing the trust score algorithm
- [ ] Generate test proofs locally using SP1 SDK
- [ ] Deploy SP1Verifier contract on Base Sepolia
- [ ] Write TrustScoreVerifier wrapper contract
- [ ] Verify proof on-chain in test environment

### Phase B: Backend Integration (3–4 weeks)

- [ ] Create Rust microservice (or Succinct Network client) for proof generation
- [ ] Add proof generation trigger to `trust_protocol/service.py` after score recalculation
- [ ] Store proof hash on FavoomID model (`proof_hash` column)
- [ ] Add `/trust-protocol/proof/{user_id}` endpoint returning proof + public inputs
- [ ] Frontend: display "ZK Verified ✓" badge on trust score

### Phase C: ZK Attestation Verification (4–6 weeks)

- [ ] Write SP1 program for attestation verification logic
- [ ] Create `/trust-protocol/verify-zk` endpoint that returns proof alongside YES/NO
- [ ] Update Connector SDK documentation with ZK verification flow
- [ ] Add proof verification to third-party verifier API

### Phase D: Connector Integrity Proofs (8–12 weeks)

- [ ] Define connector proof specification (what connectors must prove)
- [ ] Provide SP1 proof templates in `@favoom/connector-sdk`
- [ ] Add proof validation to attestation ingestion pipeline
- [ ] Enterprise connector certification program update

---

## Strategic Value

1. **"Provably Private"** — Goes beyond "privacy by design" to mathematically proven privacy. Critical for enterprise sales and EU/eIDAS 2.0 compliance storytelling.

2. **Novel Primitive** — A ZK-proven trust score on a Soulbound Token has no equivalent in the professional identity market.

3. **Connector Marketplace Premium** — Enterprise connectors producing ZK proofs justify premium pricing: "Your HR data never leaves your systems — we prove attestations, not transfer data."

4. **Regulatory Tailwind** — The EU eIDAS 2.0 mandate (2027) emphasizes data minimization. ZK proofs are the gold standard for data minimization. Early positioning = first-mover advantage.

---

## References

- [SP1 Documentation](https://docs.succinct.xyz/docs/sp1/introduction)
- [SP1 GitHub](https://github.com/succinctlabs/sp1)
- [Succinct Prover Network](https://docs.succinct.xyz/docs/prover-network/introduction)
- [SP1 On-Chain Verification](https://docs.succinct.xyz/docs/sp1/verification/onchain)
