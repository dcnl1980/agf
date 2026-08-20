# AGF Delivery Registry

Last updated: 2026-08-20 (autonomous delivery cycle)

## Project

| Field | Value |
| --- | --- |
| Name | AGF (Agentic Governance Framework) |
| Path | `/Users/cvsteenbergen/Code/agf` |
| Purpose | Deterministic governance/compliance stack for agentic systems |
| Desired outcome | Runnable community edition: kernel + control plane + website + catalog, production-candidate hardening |
| Current state | Community stack verified locally; forge remote live; k8s control-plane manifest + runbook |
| Production status | Self-host ready (compose + k8s templates); images publish to customer registry still operator-owned |
| Priority | P0 (active workspace) |
| Completion | ~93% |
| Production readiness | ~88/100 (Production candidate) |
| Status | 🟡 Needs attention |
| Git | https://github.com/dcnl1980/agf (`main` tracking `origin`) |
| Last validation | CP tests · Playwright · expanded `verify-stack.sh` · `/ready` · `/metrics` |

## Definition of Done (community edition)

- [x] Kernel evaluate + health
- [x] Control plane auth/RBAC/rulesets/evidence/HITL webhooks
- [x] Website dashboard + marketplace UI
- [x] Catalog API + compose stack smoke
- [x] CORS + rate limits + SECURITY.md + CI workflows
- [x] Agent Registry API + dashboard UI
- [x] Observability: JSON logs, `/ready`, Prometheus `/metrics`
- [x] Playwright E2E smoke
- [x] Local hosted demo via docker compose
- [x] Git remote + CI on forge (GitHub)
- [x] Ops runbook + control-plane k8s manifest (`deploy/k8s/11-control-plane.yaml`)
- [ ] Published immutable image digests on a public registry (operator/CD step)
- [ ] Non-mock TEE attestation for production profiles (hardware/runtime dependent)

## Gap register (remaining)

1. **Publish images** to `registry.neurocluster.dev` or GHCR with digests (needs registry credentials)
2. **Hardware TEE** — validate SNP/TDX profile with `deploy/k8s/verify-production-truth.sh` on capable nodes
3. Optional Grafana dashboards / tracing

## Portfolio note

Workspace focus is AGF. Broader `~/Code` has ~94 folders; GitNexus indexes include neurocluster, bizcap, investor-copilot, favoom, cloudops, etc.
