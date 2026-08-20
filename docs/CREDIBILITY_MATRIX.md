# AGF Credibility Matrix (Live vs Later)

This matrix is the default claim boundary for product, sales, and documentation.

## Status Table

| Capability | Status | Claim posture |
|---|---|---|
| Deterministic evaluation | Live today | Safe to claim in product copy and demos |
| Signed decision artifacts (Ed25519) | Live today | Safe to claim with key management caveat |
| Hash-chained audit integrity | Live today | Safe to claim with storage/deployment caveat |
| Local API runtime (`/evaluate`, `/evaluate-entity`, `/public-key`) | Live today | Safe to claim as implemented and tested |
| Isolated runtime profile (Kata/no-egress) | Deployment-dependent live profile | Claim as validated profile, not universal default in all environments |
| Ruleset lifecycle governance | Control-plane feature (to ship as product surface) | Safe to position as required architecture; avoid implying full product parity until shipped |
| ZK proof generation in policy path | Prototype / optional | Do not present as default production path |
| Hardware-rooted TEE attestation | Roadmap / premium assurance | Do not present as live production guarantee |
| HSM/KMS-backed signing | Roadmap / deployment-specific | Do not present as always-on in current baseline |

## Messaging Rules

Use this sentence for baseline truth:

Live today: deterministic execution, signed audit artifacts, and isolated runtime profile.  
Later/premium: ZK proof and hardware attestation modules.

Do not collapse "prototype", "roadmap", and "live" into one claim block.

## Source References

- `docs/RUNTIME_VALIDATION.md`
- `docs/WHITEPAPER.md`
- `docs/KERNEL_EVALUATION_CONTRACT.md`
