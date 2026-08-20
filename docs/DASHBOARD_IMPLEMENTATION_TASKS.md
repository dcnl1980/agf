# Dashboard & control plane: implementation task list

This is the working backlog to turn the **specs** into a **runnable** Agentic AI Trust Platform surface. Status is updated as work lands.

## Legend

- **Done** — implemented in repo
- **In progress** / **Partial** — some pieces shipped; more to do
- **Next** — required for production-grade product
- **Later** — optional / post-MVP

---

## Phase A — Foundation (dev shell)

| ID | Task | Status |
|----|------|--------|
| A.1 | Add **control-plane** dev service (HTTP API) exposing dashboard-oriented endpoints under `/api/v1/...` | **Done** |
| A.2 | **Vite proxy** ` /api` → control-plane (see `website/vite.config.ts`) so the SPA calls same origin in dev | **Done** |
| A.3 | **`/dashboard` route** + **Navbar** / mobile entry to open the control plane UI | **Done** |
| A.4 | **Dashboard page**: summary KPIs, recent decisions, approval queue, kernel health, **Run demo evaluate**, **Export evidence** | **Done** |
| A.5 | Document **how to run** (two processes: Vite + control-plane) | **Done** (this file + `control-plane/README.md`) |

---

## Phase B — Persistence & identity

| ID | Task | Status |
|----|------|--------|
| B.1 | Replace in-memory store with **SQLite/Postgres** (customer-scoped schema) | **Done** (SQLite: `control-plane/data/control-plane.db`, `better-sqlite3`) |
| B.2 | **AuthN**: session or JWT; no anonymous dashboard in production | **Done** (product-scoped) — **access JWT** (short TTL, `CONTROL_PLANE_ACCESS_JWT_TTL` / `CONTROL_PLANE_JWT_TTL`) + **opaque refresh** in `sessions` (rotation on `POST /api/v1/auth/refresh`); `POST` login/register issues both; `POST` logout (refresh body and/or user bearer to revoke all); **password** flows: `forgot` / `reset` / `change` (`password_resets`); `GET /api/v1/auth/me`. **Not** in scope: enterprise IdP (OIDC/SAML), device-bound attestation, email delivery in-box (integrate with your mailer) |
| B.3 | **AuthZ**: roles (policy author, approver, viewer, admin) per `docs/API_CONTRACTS.md` | **Done** (product-scoped) — **org-scoped** `org_memberships` + JWT v2; **API key** + **platform admins** (`CONTROL_PLANE_PLATFORM_ADMINS`) = full access; `PATCH`/`DELETE` `.../users/:userId` for role updates and removal; `GET` `.../audit` reads `audit_log` for the org. **Not** in scope: ABAC, per-resource policies beyond org + role |
| B.4 | **Multi-tenant org model** in control plane only (kernel stays single-tenant per deploy) | **Done** (product-scoped) — `customers` (+ `metadata_json`), `org_invites` + `POST /api/v1/auth/accept-invite`; create org: **API key** or **platform admin** JWT (`POST /api/v1/customers` with optional `metadata`); `POST /api/v1/customers/:customerId/invites` (admin). **Not** in scope: billing, org tree, row-level security across regions (SQLite is single file) |

---

## Phase C — Ruleset lifecycle (product)

| ID | Task | Status |
|----|------|--------|
| C.1 | Implement **ruleset CRUD + lifecycle** per `docs/RULESET_LIFECYCLE_SPEC.md` | **Done** — full state machine + `GET .../rulesets/{id}/versions/{versionId}` (metadata + **digest** / bundle pin); **`/review`** and **`/approve`** aliases; **audit_log** on create version, state transitions, publish (including `POST /bundles` with `rulesetVersionId`); `CONTROL_PLANE_STRICT_RULESET=1` for APPROVED gate |
| C.2 | **Compile/validate** on upload (call into `agf-sp1` or sidecar) before publish | **Done** (parse+validate) — `agf-sp1` binary `arsl-validate` via `control-plane` `arslValidate.js`; set `CONTROL_PLANE_SKIP_ARSL_VALIDATE=1` to bypass in dev; `ARSL_VALIDATE_BIN` to point at a built binary |
| C.3 | **Publish = immutable bundle** with digest; kernel load uses **pinned paths** in DB (proxy to `POST /evaluate-entity`) | **Done** (paths stored; AGF enforces at runtime) |
| C.4 | UI: ruleset editor / diff / approval workflow | **Done** (product-scoped) — org selector, line diff + validate, lifecycle actions, **published-bundle pin** (digest, ids) from API; not Monaco or threaded PR review (out of scope) |

---

## Phase D — Wire kernel & evidence

| ID | Task | Status |
|----|------|--------|
| D.1 | On each evaluation, **persist** `decision_record` + signature fields per `docs/EVIDENCE_SCHEMA.md` | **Done** (insert into `decisions` after successful AGF call) |
| D.2 | **POST** evaluation path: control plane → AGF `POST /evaluate-entity` with **bundle ref** (resolve `public_bundle_id` to stored rule paths) | **Done** — `POST /api/v1/customers/:id/evaluate` |
| D.3 | **Evidence export** job + download URL (S3 or local dump) | **Done** (product-scoped) — `GET .../evidence/export` returns **`agf.evidence_export/v1`** (see `control-plane/src/evidenceExport.js` + `docs/EVIDENCE_SCHEMA.md`); `GET`/`POST` `.../evidence/exports`, per-job `GET`, and `.../evidence/exports/:jobId/download` persist files under `data/exports` with `manifest_hash` in the body. **Not** in scope: S3, public signed download URLs, streaming huge windows |
| D.4 | HITL: `REQUIRE_APPROVAL` creates queue item; resolve hooks orchestrator (webhooks) | **Done** (product-scoped) — queue + `POST .../approvals/:id/resolve` (and customer-scoped + legacy resolve paths) enqueue **`webhook_outbox`** with retries/backoff; **`audit_log`** events `hitl_approval_queued` and `hitl_approval_resolved` (includes `decisionRef` for audit); admins can **GET** `.../webhooks/outbox` for recent deliveries. **Not** in scope: SQS/Kafka, DLQ admin UI, changing kernel to non–PASS/BLOCK for queued decisions unless extended or `hitl` request body is used as today |

---

## Phase E — Hardening & GTM

| E.1 | **SPA API base in production** (no Vite proxy) + rate limits, audit log, CORS | **Done** (product-scoped) — `VITE_CONTROL_PLANE_API_BASE` or same-origin nginx `/api`; CORS via `CONTROL_PLANE_CORS_ORIGINS`; in-process rate limits (`CONTROL_PLANE_RATE_LIMIT_*` / auth bucket); org `audit_log` + `GET .../audit`. **Not** in scope: distributed rate store, WAF rules |
| E.2 | **Observability**: structured logs, metrics, health checks for K8s | **Partial** — JSON request logs, `/health` + `/ready`, Prometheus text `/metrics` (decision/approval/agent/user gauges). **Not** in scope: Grafana dashboards, distributed tracing |
| E.3 | **E2E tests** (Playwright) for dashboard + API | **Done** (product-scoped) — `website/e2e/smoke.spec.ts` + `npm run test:e2e`; CI workflow `.github/workflows/e2e.yml` (compose + Playwright). Covers home, marketplace, login, `/ready`+`/metrics`, and authenticated dashboard agent registry |
| E.4 | **Hosted demo** or single-command `docker compose` for marketing | **Later** |

---

## How to run the dashboard (current)

1. **All-in-one (Docker):** from the repo root, `docker compose up -d --build` — see **`docker-compose.yml`** and repo **`.env`** (`WEBSITE_HOST_PORT`, etc., default **8088** for the main URL), with MinIO, AGF kernel, and SQLite on a named volume. See `control-plane/README.md` (Docker: full stack).

2. **Control plane** (port **4000**; creates `control-plane/data/control-plane.db` on first run) — without Docker:

   ```bash
   cd /path/to/agf/control-plane
   npm install
   npm start
   ```

3. **Optional — MinIO only** (S3-compatible object store; also included in the all-in-one compose above): published ports come from `MINIO_S3_API_HOST_PORT` and `MINIO_S3_CONSOLE_HOST_PORT` in the repo `.env` (defaults **9000** / **9001**). See `control-plane/README.md` (Optional: MinIO).

4. **Website** (Vite proxies `/api` to the control plane) — without Docker:

   ```bash
   cd /path/to/agf/website
   npm run dev
   ```

5. Open **http://localhost:5173/dashboard** (Vite) or, if using **Docker** above, **http://127.0.0.1:8088/dashboard** (or whatever you set for `WEBSITE_HOST_PORT` in the repo `.env`). For Vite with the control plane **only in Docker** on a mapped port, set `CONTROL_PLANE_HOST_PORT` in the repo `.env` (e.g. **4046**) so the Vite proxy targets the right port.

6. **Re-seed** the default published bundle (`rb_dev_default`) and demo approvals: **delete** `control-plane/data/` (or `control-plane/data/control-plane.db`) and restart the control plane (or `docker volume rm` the compose volume and `docker compose up -d` again).

7. For **“Run demo evaluate”** to succeed, run the AGF server from repo root (paths must resolve), or use the **docker compose** stack (kernel exposed on the host as **http://127.0.0.1:3036**; the control plane still uses `AGF_KERNEL_URL=http://agf-kernel:3000` inside the stack):

   ```bash
   cd /path/to/agf/agf-sp1
   cargo run -p agf-server --bin agf-server
   ```

   The dashboard sends the same entity payload as `agf-demo` (see `website/src/lib/demoEntityData.ts`) against the seeded four vertical rule files.

**Environment**

| Variable | Description |
|----------|-------------|
| `AGF_KERNEL_URL` | AGF `agf-server` base URL (default `http://127.0.0.1:3000`) for health + proxy evaluate |
| `AGF_SP1_ROOT` | Absolute path to `agf-sp1` (default: `../../agf-sp1` from `control-plane/src`) |
| `CONTROL_PLANE_API_KEY` | If set (with or without password auth), `/api/*` requires `Authorization: Bearer <key>` or valid JWT from login |
| `CONTROL_PLANE_DASHBOARD_PASSWORD` | If set, `POST /api/v1/auth/login` accepts this password; requires `CONTROL_PLANE_JWT_SECRET` |
| `CONTROL_PLANE_JWT_SECRET` | HS256 secret for login JWTs |
| `CONTROL_PLANE_ROLES` | Comma list placed in JWT (default: admin,policy_author,approver,viewer) |
| `CONTROL_PLANE_WEBHOOK_URL` / `CONTROL_PLANE_WEBHOOK_SECRET` | Default outbound webhook (per-customer override in `webhooks` table) |
| `CONTROL_PLANE_STRICT_RULESET` | `1` = ruleset version must be `APPROVED` before publish |
| `VITE_CONTROL_PLANE_API_KEY` | SPA sends as Bearer when no JWT in session (dev) |
| `VITE_CONTROL_PLANE_API_BASE` | Production API origin, e.g. `https://cp.example.com` — fetches go to `https://cp.example.com/api/...` |

**Production note:** a static Vite `build` has no dev proxy: set `VITE_CONTROL_PLANE_API_BASE` **or** put the static site and the control plane behind the same host and reverse-proxy `/api` to the API process.

---

## Out of scope for first dashboard cut

- Full ZK/TEE in hot path
- Production KMS/HSM integration
- Federated cross-org trust network

See `docs/CREDIBILITY_MATRIX.md` and the plan: MVP = deterministic + signed + isolated runtime; premium modules later.
