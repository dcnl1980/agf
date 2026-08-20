# AGF Delivery Registry

Last updated: 2026-08-20 (autonomous delivery cycle)

## Project

| Field | Value |
| --- | --- |
| Name | AGF (Agentic Governance Framework) |
| Path | `/Users/cvsteenbergen/Code/agf` |
| Purpose | Deterministic governance/compliance stack for agentic systems |
| Desired outcome | Runnable community edition: kernel + control plane + website + catalog, production-candidate hardening |
| Current state | Local full stack **verified**; E.1–E.3 + Agent Registry + metrics |
| Production status | Not hosted; community self-host via compose/k8s |
| Priority | P0 (active workspace) |
| Completion | ~90% |
| Production readiness | ~84/100 (Production candidate) |
| Status | 🟡 Needs attention |
| Git | Local `main`; **no remote** — push/PR blocked |
| Last validation | CP tests 9/9 · Playwright 6/6 · `verify-stack.sh` · `/ready` · `/metrics` |

## Definition of Done (community edition)

- [x] Kernel evaluate + health
- [x] Control plane auth/RBAC/rulesets/evidence/HITL webhooks
- [x] Website dashboard + marketplace UI
- [x] Catalog API + compose stack smoke
- [x] CORS + in-process rate limits + SECURITY.md + CP CI workflow
- [x] Agent Registry MVP API + dashboard UI
- [x] Observability: JSON logs, `/ready`, Prometheus `/metrics`
- [x] Playwright E2E smoke (home, marketplace, login, dashboard)
- [x] Local hosted demo via docker compose (E.4 local); published registry images still open
- [ ] Git remote + CI on forge
- [ ] Non-mock TEE attestation for production profiles

## Gap register (executable next)

1. **Push remote** — needs forge project URL / credentials
2. Published container images to a registry (E.4 remainder)
3. Non-mock TEE for production profiles
4. Optional: Grafana/tracing beyond `/metrics`

## Portfolio note

Workspace focus is AGF. Broader `~/Code` has ~94 folders; GitNexus indexes include neurocluster, bizcap, investor-copilot, favoom, cloudops, etc.
