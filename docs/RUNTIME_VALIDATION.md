# AGF Runtime Validation Status

**Date:** 2026-04-22  
**Workspace:** `/Users/cvsteenbergen/Code/agf`  
**Scope:** hard validation of the currently implemented runtime, using local code execution and end-to-end process validation.

## Executive Summary

The AGF runtime is now **hard-validated for local execution** across the following chain:

1. ARSL rule loading and validation
2. Deterministic batch evaluation
3. Blake3 proof hash generation
4. Blake3 hash-chained audit append
5. Ed25519 signing
6. Public-key publication
7. Independent signature verification
8. Multi-vertical API evaluation over a live local server process

This means we can now make **strong, code-backed claims** about the implemented local runtime path.

We **cannot** yet claim hard production truth for:

- hardware-rooted TEE attestation
- confidential-computing guarantees
- live Kata micro-VM enforcement in a running production cluster
- live zero-egress enforcement in a running production cluster
- persistent production signing-key management via HSM/KMS

Those remain deployment or roadmap claims until validated on real infrastructure.

## What Was Hard-Validated

### 1. Test Suite

Command:

```bash
cd /Users/cvsteenbergen/Code/agf/agf-sp1
cargo test
```

Observed result:

- `45` library tests passed
- `19` server tests passed
- `7` integration tests passed
- `1` doctest passed

Validated areas:

- deterministic rule evaluation
- ARSL parsing and validation
- batch evaluation semantics
- Blake3 audit-chain integrity
- Ed25519 signing and verification
- `/health`
- `/evaluate`
- `/evaluate-entity`
- `/public-key`
- signature roundtrip verification
- audit-log integrity across multiple evaluations

Relevant files:

- [agf-sp1/lib/src/lib.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/lib/src/lib.rs)
- [agf-sp1/server/src/api.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/api.rs)
- [agf-sp1/server/src/signing.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/signing.rs)
- [agf-sp1/server/src/audit.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/audit.rs)
- [agf-sp1/server/tests/integration_tests.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/tests/integration_tests.rs)

### 2. Implemented Rule Packs

Command:

```bash
find /Users/cvsteenbergen/Code/agf/agf-sp1/rules -name '*.arsl.toml' | wc -l
```

Observed result:

- `19` implemented rule files

This is a hard count of implemented policy artifacts, not a legal adequacy judgment.

### 3. End-to-End Runtime Chain Over a Live Server

The strongest runtime validation performed in this environment was a real process-to-process run:

1. start the live AGF server binary
2. call it from the `agf-demo` binary over HTTP
3. execute multi-vertical evaluation
4. emit a signed audit bundle
5. fetch the public key
6. independently verify the Ed25519 signature

Commands used:

```bash
cd /Users/cvsteenbergen/Code/agf/agf-sp1
cargo run -p agf-server --bin agf-server
```

Then:

```bash
cd /Users/cvsteenbergen/Code/agf/agf-sp1
cargo run -p agf-server --bin agf-demo -- --server http://127.0.0.1:3000 --output runtime_validation_demo.json
```

Observed runtime result:

- local server accepted `POST /evaluate-entity`
- `26/26` rules passed across 4 verticals
- audit bundle was returned
- signature was independently verified as valid
- result artifact was written to:
  [runtime_validation_demo.json](/Users/cvsteenbergen/Code/agf/agf-sp1/runtime_validation_demo.json)

Observed demo output included:

- `✅ PASS (26/26 rules)`
- `Signature VALID`
- `DEMO COMPLETE — 26 rules evaluated, signed, verified`

Relevant files:

- [agf-sp1/server/src/main.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/main.rs)
- [agf-sp1/server/src/bin/agf_demo.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/bin/agf_demo.rs)

## What This Proves

The current codebase supports these stronger statements:

- AGF has a real local runtime path for deterministic rule evaluation.
- The server can evaluate a multi-vertical request over live HTTP.
- The runtime emits a Blake3-based audit artifact and Ed25519 signature.
- The public key can be retrieved and used to verify the signature independently.
- The end-to-end chain is not merely theoretical or documentation-only.

## What This Does Not Prove

### 1. TEE Attestation Is Not Production-Real

Current code uses a stub:

- [agf-sp1/server/src/tee.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/tee.rs)

Hard evidence from code:

- `enclave_type` is `"mock"`
- the exported function is `generate_attestation_stub`
- comments explicitly state Nitro attestation is a production replacement path

Therefore:

- no hardware-rooted attestation is currently proven
- no enclave PCR chain is currently proven
- no confidential-computing claim should be upgraded to production truth

### 2. Kata Runtime Is Manifest-Backed, Not Runtime-Proven Here

Deployment manifests exist:

- [deploy/k8s/02-deployment.yaml](/Users/cvsteenbergen/Code/agf/deploy/k8s/02-deployment.yaml)
- [deploy/k8s/03-network-policy.yaml](/Users/cvsteenbergen/Code/agf/deploy/k8s/03-network-policy.yaml)

These prove:

- the intended deployment posture includes `runtimeClassName: kata-qemu`
- the intended network policy is deny-all egress
- the intended pod posture is non-root, read-only filesystem, dropped capabilities

They do **not** prove:

- a real cluster is currently running that manifest
- the pod actually launched under Kata
- the node hardware exposes SNP/TDX
- the network policy is enforced in a live cluster today

### 3. Signing-Key Production Posture Is Not Yet Hard-Proven

Current runtime validation used an ephemeral signing key because `AGF_SIGNING_KEY_HEX` was not set.

This proves the local signing flow works, but does not prove:

- stable production key persistence
- KMS/HSM-backed signing
- key rotation
- revocation and trust-chain procedures

## Claim Matrix

### Safe To Claim As Proven

- Deterministic rule evaluation exists and runs locally.
- Multi-vertical HTTP runtime exists and runs locally.
- Blake3 audit-chain logic exists and is tested.
- Ed25519 signing and public-key verification exist and are tested.
- A live local runtime chain has been executed end to end.
- 19 ARSL rule-pack files are implemented in the repo.

### Safe To Claim As Prototype / Deployment-Dependent

- SP1 / zkVM proving path
- TEE / enclave attestation
- Kata-backed runtime isolation
- zero-egress enforcement in-cluster
- HSM / KMS-backed production signing

### Not Safe To Claim As Production Truth Yet

- hardware-rooted confidential runtime
- production-attested enclave measurement
- production-verified zero-egress runtime
- regulator-accepted cryptographic compliance evidence
- legal compliance guarantees

## Recommended Website / Documentation Changes

### Claims that can now be strengthened

- "AGF has a live local runtime path that evaluates, signs, and verifies end to end."
- "The evaluation, audit, and signature chain is code-backed and test-backed."
- "Independent signature verification is implemented and demonstrated."

### Claims that must remain conservative

- anything implying real TEE attestation is live
- anything implying Kata runtime has been independently proven in production
- anything implying ZK proving is part of the default production hot path
- anything implying legal compliance is guaranteed

## Next Step to Reach Real Production Truth

To upgrade from local runtime proof to production-runtime proof, the next hard gate is:

1. deploy to a real Kubernetes cluster
2. verify the pod is actually scheduled with Kata runtime
3. capture runtime evidence from the node/runtime layer
4. replace mock TEE attestation with real Nitro or equivalent attestation
5. verify the attestation document against a hardware-rooted trust chain
6. demonstrate deny-all egress from inside the live runtime
7. rerun the end-to-end evaluation and signature verification in that environment

Until that work is complete, the correct positioning is:

> **Local runtime path: proven.**  
> **Production attested runtime: not yet proven.**
