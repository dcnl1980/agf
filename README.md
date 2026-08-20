# AGF (Agentic Governance Framework)

AGF is a deterministic governance and compliance stack for agentic systems.
It combines:

- a Rust evaluation kernel (`agf-sp1`) for deterministic policy outcomes,
- a control plane API (`control-plane`) for lifecycle and evidence operations,
- a web UI (`website`) for operators.

## Repository scope

This repository is the **community edition** of AGF under Apache-2.0.

- See license: `/Users/cvsteenbergen/Code/agf/LICENSE`
- See notices: `/Users/cvsteenbergen/Code/agf/NOTICE`
- See contribution policy: `/Users/cvsteenbergen/Code/agf/CONTRIBUTING.md`
- See trademark policy: `/Users/cvsteenbergen/Code/agf/TRADEMARK.md`

## Quick start (full local stack)

1. Copy env template:
   - `cp .env.example .env`
2. Build and start services:
   - `docker compose up -d --build`
3. Open the website:
   - `http://127.0.0.1:8088` (or your `WEBSITE_HOST_PORT`)
4. Run smoke checks:
   - `bash scripts/verify-stack.sh`
5. Open marketplace (Phase C UI):
   - `http://127.0.0.1:8088/marketplace`

Main services:

- website: `http://127.0.0.1:${WEBSITE_HOST_PORT:-8088}` (also proxies `/catalog/` to the [catalog HTTP API](catalog-api/README.md), e.g. `/catalog/v1/entries`)
- control-plane API: `http://127.0.0.1:${CONTROL_PLANE_HOST_PORT:-4046}`
- catalog API (optional Phase B, host port `CATALOG_HOST_PORT`): `http://127.0.0.1:${CATALOG_HOST_PORT:-4055}`
- kernel: `http://127.0.0.1:${AGF_KERNEL_HOST_PORT:-3036}`

## Community vs enterprise

AGF uses an open-core model:

- **Community (this repo):** kernel, control-plane, website, local stack, and public docs.
- **Enterprise (private repo):** proprietary integrations/features loaded through extension hooks (for example, via `AGF_ENTERPRISE_MODULE` in control-plane).

The public repository stays buildable and runnable on its own.

For a full comparison (licensing, extension hooks, support), see `docs/OPEN_SOURCE_AND_ENTERPRISE.md`.

## Private enterprise bootstrap

Use the included scaffold helper to create a private `agf-enterprise` repo outside this public tree:

- `bash /Users/cvsteenbergen/Code/agf/scripts/scaffold-enterprise-repo.sh /absolute/path/to/agf-enterprise`

Template assets live under:

- `/Users/cvsteenbergen/Code/agf/templates/agf-enterprise-private`

## Documentation

- Open source vs enterprise: `/Users/cvsteenbergen/Code/agf/docs/OPEN_SOURCE_AND_ENTERPRISE.md`
- Ruleset marketplace (ecosystem): `/Users/cvsteenbergen/Code/agf/docs/RULESET_MARKETPLACE.md`
- Community catalog source of truth: `/Users/cvsteenbergen/Code/agf/catalog/community-catalog.json`
- API contracts: `/Users/cvsteenbergen/Code/agf/docs/API_CONTRACTS.md`
- Control-plane details: `/Users/cvsteenbergen/Code/agf/control-plane/README.md`
- Operations runbook: `/Users/cvsteenbergen/Code/agf/docs/RUNBOOK.md`
- Technical whitepaper: `/Users/cvsteenbergen/Code/agf/docs/WHITEPAPER.md`

## Support

- Security reporting process: see [`SECURITY.md`](SECURITY.md).
- General community support: use your source forge issues/discussions for this repository.
- Commercial support and SLAs: provided through the private enterprise distribution.
