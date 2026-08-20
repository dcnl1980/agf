# AGF Delivery Registry

Last updated: 2026-08-20 (autonomous delivery cycle)

## Project

| Field | Value |
| --- | --- |
| Name | AGF (Agentic Governance Framework) |
| Path | `/Users/cvsteenbergen/Code/agf` |
| Purpose | Deterministic governance/compliance stack for agentic systems |
| Desired outcome | Runnable community edition: kernel + control plane + website + catalog, production-candidate hardening |
| Current state | Local full stack **verified**; Phase A–D + E.1 + Agent Registry API done |
| Production status | Not hosted; community self-host via compose/k8s |
| Priority | P0 (active workspace) |
| Completion | ~78% |
| Production readiness | ~72/100 (Beta / approaching production candidate) |
| Status | 🟡 Needs attention |
| Git | **No `.git` at repo root** — commits/PRs blocked until VCS initialized + remote |
| Last validation | `npm test` (control-plane, 7/7) + `scripts/verify-stack.sh` (local Docker) |

## Definition of Done (community edition)

- [x] Kernel evaluate + health
- [x] Control plane auth/RBAC/rulesets/evidence/HITL webhooks
- [x] Website dashboard + marketplace UI
- [x] Catalog API + compose stack smoke
- [x] CORS + in-process rate limits + SECURITY.md + CP CI workflow
- [x] Agent Registry MVP API (create/list/update/deactivate; evaluate rejects unknown/inactive agentId)
- [x] Agent Registry UI in dashboard
- [ ] Observability (structured logs/metrics/probes) — E.2
- [ ] Playwright E2E — E.3
- [ ] Hosted demo / published images — E.4
- [ ] Git remote + CI on forge (local git initialized; no remote yet)
- [ ] Non-mock TEE attestation for production profiles

## Gap register (executable next)

1. **E.2 Observability** — structured logs, metrics, k8s probes
2. **E.3 Playwright E2E** — dashboard + API flows
3. **Push remote** — needs forge project URL / credentials
4. Hosted demo / image publish

## Portfolio note

Workspace focus is AGF. Broader `~/Code` has ~94 folders; GitNexus indexes include neurocluster, bizcap, investor-copilot, favoom, cloudops, etc. Cross-link: neurocluster previously referenced AGF kernel images.
