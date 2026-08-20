# Open source and enterprise editions

This document explains how the **public (community) open-source** distribution of AGF relates to **enterprise** add-ons, what each includes, and how they differ.

## Summary

| | Community (this repository) | Enterprise (private) |
| --- | --- | --- |
| **License** | [Apache-2.0](../LICENSE) for code in this repo | Proprietary; terms under your commercial agreement |
| **Source** | Full source: `agf-sp1`, `control-plane`, `website`, docs | Private repositories and artifacts you ship to customers |
| **Can you self-host?** | Yes: build from source or published community images | Yes, when you deploy vendor-provided enterprise builds or your own private fork with enterprise modules |
| **What you get** | Deterministic kernel, control plane API, web UI, local stack (e.g. Docker Compose), public documentation | Optional proprietary routes, integrations (SSO, advanced audit, etc.), support SLAs, and certified builds as offered by the vendor |
| **Forking** | Permitted under Apache-2.0, subject to [trademark policy](../TRADEMARK.md) | N/A for proprietary add-ons; community kernel remains forkable |

The **open-core** model means: the **entire product that exists in this public repository** is meant to be **useful, buildable, and runnable on its own** without secret enterprise code. Enterprise value is **additive** and lives **outside** this tree (private packages, private images, or hosted services), wired in through **documented extension points**.

## What is in the public (open-source) edition?

Everything published here under Apache-2.0, including in particular:

- **`agf-sp1`** — Rust evaluation kernel (HTTP server, ARSL tooling, optional SP1/zk research paths as documented in the [whitepaper](WHITEPAPER.md)).
- **`control-plane`** — HTTP API for bundles, customers, evidence, auth, and proxy to the kernel.
- **`website`** — Operator-facing web application.
- **Compose and scripts** — Local full stack and verification helpers (e.g. `docker-compose.yml`, `scripts/verify-stack.sh`).
- **Technical documentation** in `docs/`, this file, and the root [README](../README.md).

Anyone may **clone, build, and run** this stack, subject to the license and third-party dependencies. That also means **competitors can fork the kernel and control plane**; commercial differentiation is expected to come from support, operations, certified builds, premium integrations, and brand—not from hiding the ability to `docker compose up`.

## What is the enterprise edition?

**Enterprise** is not a second copy of AGF in this repo. It is:

- **Private code** (e.g. a separate `agf-enterprise` repository) that extends the same runtime.
- **Private Docker images** or build pipelines that layer enterprise-only assets on top of public base images.
- **Commercial terms**: support, SLAs, and optional hosting as defined in your contract.

Typical enterprise-only capabilities (examples, not a commitment in this open repo):

- Integrations: SSO, IdP, enterprise audit sinks, ticketing, or customer-specific APIs.
- Policy or governance features that you choose not to open-source.
- Hardening, FIPS, or compliance packaging sold as part of a vendor distribution.

## How enterprise connects to the open-source stack

The control plane supports an optional **extension module** loaded at startup when the environment variable `AGF_ENTERPRISE_MODULE` is set to a path of an ES module file. If unset, the service runs in **open-source-only** mode with no hidden behavior.

- **Details and env var:** [control-plane README — Enterprise extension hook](../control-plane/README.md#enterprise-extension-hook)
- **Example for local dev:** [`.env.example`](../.env.example) (commented `AGF_ENTERPRISE_MODULE`)

The extension receives the Express `app` (and related context) and may register additional routes, such as `GET /api/v1/enterprise/…`. A **template** for a private enterprise repo (plugin + Dockerfile + CI) lives under `templates/agf-enterprise-private/`; use `scripts/scaffold-enterprise-repo.sh` to copy it to a private path (see [README — Private enterprise bootstrap](../README.md#private-enterprise-bootstrap)).

**Website:** The public web app is complete for community use. Further enterprise UI can be shipped as a separate private SPA, lazy-loaded plugins, or duplicated branding per your product strategy; that is not required for the community edition to function.

**Rust kernel:** Advanced enterprise-only behavior can also be delivered as a **separate process** (sidecar) calling the kernel’s public HTTP API, or via optional `Cargo` features in a private crate, without placing proprietary code in this repository.

## Ruleset marketplace (ecosystem)

AGF can support an **open ecosystem** where authors **publish** ARSL policy bundles to a **catalog** (like a package or extension index) and operators **import** entries into their own org using the same bundle APIs—without requiring a single vendor to host all rules. That layer is **metadata + discovery** on top of the existing publish flow, not a second kernel.

See [RULESET_MARKETPLACE.md](RULESET_MARKETPLACE.md) for phases (Git + JSON through optional HTTP index and in-product UI), trust boundaries, and the **canonical** catalog under [`catalog/`](../catalog/README.md) (browsed in the site at `/marketplace` when you run the website locally or deploy it).

## Licensing and contribution

- **Open-source code** in this repository is under **Apache-2.0** unless a file says otherwise. See [LICENSE](../LICENSE) and [NOTICE](../NOTICE).
- **Contributions** to this repository are expected to follow [CONTRIBUTING.md](../CONTRIBUTING.md) (including DCO sign-off as described there).
- **Trademarks:** “AGF” and related names are not free-for-all product branding; see [TRADEMARK.md](../TRADEMARK.md).

## Why publish the full kernel (including `agf-sp1`)?

Publishing `agf-sp1` under a permissive license means third parties can **rebuild the engine from source**. That is intentional for auditable, deterministic policy evaluation. A recorded decision and legal checkpoint list is in [KERNEL_LICENSE_DECISION.md](KERNEL_LICENSE_DECISION.md). If a future product decision required a **source-available** or **closed** kernel, that would be a separate license strategy and is **not** what this public repo represents today.

## Support matrix (conceptual)

| Need | Community edition | Enterprise (vendor offering) |
| --- | --- | --- |
| Use and modify source | Yes, under Apache-2.0 | N/A; enterprise add-ons are licensed separately |
| Best-effort community help (issues, discussions) | Where you host the public repo | As offered by the vendor for entitled customers |
| Contractual support / SLAs | Not implied by the license | Typically yes, per agreement |
| Certified or air-gapped builds | You build and operate yourself | Often provided by the vendor if offered |

## Related documents

- [README](../README.md) — Quick start and repository scope
- [KERNEL_LICENSE_DECISION.md](KERNEL_LICENSE_DECISION.md) — Kernel public licensing decision
- [RULESET_MARKETPLACE.md](RULESET_MARKETPLACE.md) — Community ruleset catalog / marketplace model
- [WHITEPAPER.md](WHITEPAPER.md) — Technical architecture and scope of claims
- [API_CONTRACTS.md](API_CONTRACTS.md) — Public API surface
