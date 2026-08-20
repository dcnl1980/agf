# Ruleset marketplace (ecosystem)

This document describes a **community ruleset marketplace** for AGF: a place where authors can **publish** ARSL policy bundles and operators can **discover, pin, and import** them into their own control plane—similar in spirit to **package registries** or **extension marketplaces** (discoverable artifacts with versions and integrity guarantees).

The control plane already supports **publishing** bundles per tenant (`publicBundleId`, `bundleVersion`, digest, `ruleFiles`). A marketplace is an **ecosystem layer on top**: metadata, discovery, curation, and (optionally) a hosted index—not a replacement for the kernel or for tenant-specific approval workflows.

## Goals

- **Authors:** Register a stable ID, ship semver-style versions, document jurisdiction and use case, and let others **verify** content by digest.
- **Consumers:** Browse or search, **pin** a bundle identity + version (or exact digest) for reproducibility, then **import** into their org via existing APIs or GitOps.
- **Operators (you):** Run fully **self-hosted** (catalog is just files/Git) or offer a **hosted index** (SaaS or enterprise) without changing the Apache-2.0 engine.

## What exists today in this repository

- **Per-customer policy bundles** — SQLite table `policy_bundles` with `public_bundle_id`, `bundle_version`, `digest`, `rule_files_json` (see [control-plane `db.js`](../control-plane/src/db.js)).
- **Publish API** — `POST /api/v1/customers/:customerId/bundles` with `publicBundleId`, `bundleVersion`, `ruleFiles[]` (and optional ruleset workflow).
- **Validation** — `arsl-validate` when `CONTROL_PLANE_SKIP_ARSL_VALIDATE` is not set.

A marketplace **indexes** those same concepts for **cross-tenant** sharing; it does not bypass org isolation unless you explicitly build a “global install” product feature.

## Architecture options (phased)

### Phase A — Community catalog (no new server)

- **Source of truth:** A Git repository of ARSL files plus a **static catalog** (JSON) listing published entries.
- **Contribution model:** Pull requests, CODEOWNERS, optional signing (Sigstore) later.
- **Distribution:** `git` clone, or tarball release attachments, with consumers computing or trusting **digests** that match the control plane’s bundle digest.

This matches an “open ecosystem” with zero dependency on a vendor-hosted API.

### Phase B — HTTP catalog API (optional public service)

- A small read-only service (or static JSON on a CDN) that exposes:
  - `GET /v1/entries` — search/list with query params `q`, `tag`, `jurisdiction` (and raw catalog at `GET /v1/catalog`).
  - `GET /v1/entries/:id` — one listing (URL-encode the id; dots are fine).
  - `GET /v1/entries/:id/versions` — version list with digests.
- **Integrity:** Every listed version includes `digest` (and optionally a manifest URL) so clients never trust the index alone without verification.

**In this repository:** the Node server in [`catalog-api/`](../catalog-api/) implements these routes. [Docker compose](../docker-compose.yml) builds the `catalog-api` service; the [website `nginx`](../website/nginx.conf) exposes it at **`/catalog/`** (e.g. `https://<your-host>/catalog/v1/entries` same-origin). Local Vite [proxies `/catalog`](../website/vite.config.ts) to `CATALOG_HOST_PORT` (default 4055). See [`catalog-api/README.md`](../catalog-api/README.md).

The AGF **control plane** can remain the place where Bundles are **imported** into a customer; the catalog only **points** to artifacts.

### Phase C — In-product “marketplace” UI

- Website pages: browse, detail, “copy install snippet” (curl/API example to publish into your org), and **optional signed-in “Publish bundle to org”** (calls the control plane `POST .../bundles` with the user’s session).
- **Enterprise:** Curated “verified” tier, private listings, or air-gapped mirror—implemented via the existing [`AGF_ENTERPRISE_MODULE`](../control-plane/README.md#enterprise-extension-hook) or a separate private UI repo.
- Current implementation in this repo: [`/marketplace`](../website/src/pages/MarketplacePage.tsx) and shareable per-entry routes **`/marketplace/:entryId`**. The marketplace page also surfaces the Phase B **HTTP API** base path (`/catalog/v1/…` when the catalog service is deployed).

## Catalog entry shape (suggested)

Each **listing** describes one logical product (e.g. `com.example.banking-aml-basics`) with one or more **versions**. Align version identifiers with what you pass as `bundleVersion` in the control plane.

Minimum fields (canonical files: [community-catalog.json](../catalog/community-catalog.json) and [community-catalog.schema.json](../catalog/community-catalog.schema.json)):

Bundle **digests** in the control plane are a `sha256:`-prefixed hex string over **deduplicated, lexicographically sorted absolute paths**, each path contributing `path + "\\0" + fileBytes`—see [`control-plane/src/digest.js`](../control-plane/src/digest.js) and the normative summary in [KERNEL_EVALUATION_CONTRACT.md](KERNEL_EVALUATION_CONTRACT.md#policy-bundle-content-digest-control-plane-interop). Catalog entries should use the **same** digest for a given set of `ruleFiles` (and the same `AGF_SP1_ROOT` resolution) so consumers can verify before import. CI runs [`validate-marketplace-catalog.mjs`](../scripts/validate-marketplace-catalog.mjs) to recompute and compare.

| Field | Purpose |
| --- | --- |
| `id` | Stable public ID (namespaced string; maps to `publicBundleId` when publishing) |
| `version` | Semver or opaque label (maps to `bundleVersion`) |
| `digest` | Content hash matching control-plane bundle digest for those files |
| `ruleFiles` | Paths relative to `agf-sp1` rules root, same as publish API |
| `license` | SPDX license of the **rules** (separate from Apache-2.0 engine) |
| `tags`, `jurisdiction` | Discovery and filtering only |
| `sourceUrl` | Link to Git tag or release artifact |
| `maintainer` | Contact or org id |

**Authoring note:** The license on **ARSL text** is chosen by the author; the engine remains Apache-2.0. Mixed-license repos should document rule licensing clearly.

## Trust and safety

- **Not legal compliance by listing.** The marketplace **does not** certify regulatory fitness; it can only reflect author claims, review badges, and digests.
- **Pin by digest** for high assurance; treat semver upgrades like dependency updates.
- **Moderation:** For a public index, plan for abuse reporting, yanking versions, and namespace ownership—same class of problems as npm/PyPI, solved operationally, not in the kernel.
- **Air-gapped:** Use Phase A (Git + JSON) and internal mirroring; no public network required.

## How “push” works in practice

1. **Author** packages rules, runs local `arsl-validate`, computes or records digest after publish in dev.
2. **Author** opens a PR to the community catalog **or** hosts their own [catalog HTTP API](../catalog-api/README.md) mirror; there is no `POST /v1/entries` in the default read-only service (registration stays Git- or process-based unless you add it).
3. **Consumer** selects an entry, then **imports** into their org:
   - Use control plane `POST /api/v1/customers/:customerId/bundles` with the same `publicBundleId`, `bundleVersion`, and `ruleFiles` as the catalog, **or**
   - Script that clones Git at a tag and posts the bundle.

**“Push to marketplace”** in a mature product is therefore **publish + register metadata**, not a separate write path to the kernel.

## Relationship to open source and enterprise

- **Community:** Catalog format, example JSON, and Phase A are fully alignable with the public repo and Apache-2.0.
- **Enterprise:** Curated registries, SSO for publishers, private marketplace UI, or SLA around mirror uptime—**extension services**, same pattern as [OPEN_SOURCE_AND_ENTERPRISE.md](OPEN_SOURCE_AND_ENTERPRISE.md).

## Implementation checklist (for maintainers)

- [x] Adopt a namespace convention for `publicBundleId` in [`catalog/README.md`](../catalog/README.md).
- [x] Canonical catalog + schema under [`catalog/`](../catalog/).
- [x] CI validates JSON schema, recomputes digests vs. the catalog, and runs `arsl-validate` for referenced `ruleFiles` ([marketplace-catalog.yml](../.github/workflows/marketplace-catalog.yml)).
- [x] Marketplace page implemented at `/marketplace` (and `/marketplace/:entryId` for direct links), including **in-app import** (publish bundle) when the user is allowed by RBAC.
- [x] Phase B HTTP index: [`catalog-api/`](../catalog-api/) + compose + nginx `/catalog/`.
- [x] Optional [CODEOWNERS](../.github/CODEOWNERS) template for `catalog/**` (uncomment and set your team).
- [x] Normative digest interop: [KERNEL_EVALUATION_CONTRACT.md](KERNEL_EVALUATION_CONTRACT.md#policy-bundle-content-digest-control-plane-interop).

## See also

- [OPEN_SOURCE_AND_ENTERPRISE.md](OPEN_SOURCE_AND_ENTERPRISE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md) — control plane endpoints
- [RULESET_LIFECYCLE_SPEC.md](RULESET_LIFECYCLE_SPEC.md) — internal ruleset state machine
