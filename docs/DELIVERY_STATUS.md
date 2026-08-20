# AGF Delivery Registry

Last updated: 2026-08-20 (autonomous delivery cycle)

## Project

| Field | Value |
| --- | --- |
| Name | AGF (Agentic Governance Framework) |
| Path | `/Users/cvsteenbergen/Code/agf` |
| Purpose | Deterministic governance/compliance stack for agentic systems |
| Desired outcome | Runnable community edition: kernel + control plane + website + catalog, production-candidate hardening |
| Current state | Forge live; GHCR publish workflow; non-root CP; E2E+smoke verified |
| Production status | Production candidate — community self-host via compose/k8s/GHCR |
| Priority | P0 |
| Completion | ~95% |
| Production readiness | ~90/100 |
| Status | 🟡 Needs attention (hardware TEE + first GHCR package visibility) |
| Git | https://github.com/dcnl1980/agf |
| Last validation | CP 9/9 · expanded verify-stack · GHCR workflow added |

## Definition of Done (community edition)

- [x] Kernel / control plane / website / catalog runnable
- [x] Auth, rulesets, evidence, HITL, agent registry
- [x] Security basics (CORS, rate limits, SECURITY.md, non-root CP image)
- [x] Observability (`/ready`, `/metrics`, JSON logs)
- [x] Playwright E2E + CI workflows
- [x] Ops runbook + control-plane k8s
- [x] Git remote (GitHub)
- [x] Image publish pipeline (GHCR workflow)
- [ ] First successful GHCR publish + public package visibility (CI run)
- [ ] Non-mock TEE on hardware (cluster-dependent)

## Gap register

1. Confirm GHCR workflow green and packages public
2. Hardware TEE validation on SNP/TDX nodes
