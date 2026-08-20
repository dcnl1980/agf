# AGF control plane (dev)

HTTP API for the **dashboard** and product surfaces. Persists to **SQLite** under `data/control-plane.db` (configurable). See `docs/DASHBOARD_IMPLEMENTATION_TASKS.md` for the full roadmap.

## Run

```bash
npm install
npm start
```

Default port: **4000** (override with `PORT`).

**Re-seed** default customer, published bundle `rb_dev_default`, and sample approvals: delete the `data/` directory (or only `data/control-plane.db`) and restart.

### Docker: full stack (MinIO, kernel, control plane, website)

From the **repo root** (see also `docker-compose.yml` at the top of that file):

```bash
docker compose up -d --build
```

**Smoke test (E2E HTTP):** from the repo root, `bash scripts/verify-stack.sh` (uses ports from **`.env`**; curls kernel, control plane, MinIO, the website, and `/api` through nginx).

- **App + API (same origin):** `http://127.0.0.1:<WEBSITE_HOST_PORT>` (default **8088**) — nginx serves the SPA and proxies `/api` to the control plane. Map is `WEBSITE_HOST_PORT` → in-container **8080**; the static build does not set `VITE_CONTROL_PLANE_API_BASE` (browser uses relative `/api`).
- **AGF kernel (optional direct):** `http://127.0.0.1:<AGF_KERNEL_HOST_PORT>` (default **3036** → in-container **3000**)
- **Control plane API (optional direct):** `http://127.0.0.1:<CONTROL_PLANE_HOST_PORT>` (default **4046** → in-container **4000**)
- **MinIO:** S3 `http://127.0.0.1:<MINIO_S3_API_HOST_PORT>`, console `http://127.0.0.1:<MINIO_S3_CONSOLE_HOST_PORT>` (defaults **9000** / **9001**; set in the repo **`.env`**)

**Database:** the control plane’s **SQLite** file lives in the Docker named volume `control_plane_data` (path inside the container: `/data/control-plane.db`). The repo’s `agf-sp1` tree is **bind-mounted** read-only for rule files and (optionally) a prebuilt `arsl-validate` under `agf-sp1/target`. By default `CONTROL_PLANE_SKIP_ARSL_VALIDATE=1` in compose so publish does not need the validator binary inside the image.

**Environment:** copy `.env.example` to the repo **`.env`** to set **host ports** (`AGF_KERNEL_HOST_PORT`, `CONTROL_PLANE_HOST_PORT`, `WEBSITE_HOST_PORT`, MinIO), `MINIO_*` credentials, `CONTROL_PLANE_JWT_SECRET`, and `CONTROL_PLANE_SKIP_ARSL_VALIDATE`. **`website` + Vite** (`npm run dev`) reads the repo **`.env`** and proxies `/api` to `http://127.0.0.1:${CONTROL_PLANE_HOST_PORT}` so it lines up with Docker-published control plane ports. **Default** `CONTROL_PLANE_HOST_PORT` in `.env` is `4046`; for a fully local `npm` control plane on **4000**, set `CONTROL_PLANE_HOST_PORT=4000` or remove it and rely on the Vite default of **4000** when the variable is missing.

`docker compose.sandbox.yml` remains for an isolated, locked-down `agf-server` only; it is **not** the same as this full product stack.

### Optional: MinIO (S3-compatible, local)

From the **repo root**, `docker compose up -d` starts **MinIO** (see `docker-compose.yml`). Published ports are set in the repo **`.env`** (see **`.env.example`**: `MINIO_S3_API_HOST_PORT`, `MINIO_S3_CONSOLE_HOST_PORT`). This is for development when you wire evidence or other artifacts to object storage (same API as AWS S3).

| | |
|--|--|
| S3 API | `http://127.0.0.1:<MINIO_S3_API_HOST_PORT>` (default **9000**; see repo `.env`) |
| Console | `http://127.0.0.1:<MINIO_S3_CONSOLE_HOST_PORT>` (default **9001**; create buckets here; default login `minioadmin` / `minioadmin` unless you set `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`) |
| Example dev bucket | `agf` (or any name you prefer; use it in S3 clients when uploads are wired) |
| Client config | path-style addressing, e.g. region `us-east-1` |

The control plane does not require MinIO today (exports are written under `data/exports` on disk). When you add uploads, point your S3 client at the endpoint above. Pin `minio/minio` to a specific `RELEASE…` tag in real deployments; `latest` in compose is for convenience.

## Endpoints (dev)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Process liveness |
| GET | `/api/v1/customers/:customerId/dashboard/summary` | KPIs |
| GET | `/api/v1/customers/:customerId/decisions` | Recent decisions (persisted) |
| POST | `/api/v1/customers/:customerId/evaluate` | Resolve bundle → `POST` AGF `/evaluate-entity` → store row |
| GET | `/api/v1/customers/:customerId/bundles` | Published bundles |
| POST | `/api/v1/customers/:customerId/bundles` | Publish a bundle (body: `publicBundleId`, `bundleVersion`, `ruleFiles[]`) |
| POST | `/api/v1/customers/:customerId/bundles/validate` | `arsl-validate` only (no write) for `ruleFiles[]` |
| GET | `/api/v1/customers/:customerId/agf/rule-file?path=...` | Read one file under `AGF_SP1_ROOT` (for dashboard diff) |
| POST | `/api/v1/customers` | Create org — **API key** or **platform admin** user JWT; optional `metadata` object |
| GET/POST | `/api/v1/customers/:customerId/users` | List or add user (admin) |
| PATCH/DELETE | `/api/v1/customers/:customerId/users/:userId` | Change role or remove from org (admin) |
| POST | `/api/v1/customers/:customerId/invites` | Create invite (admin); in dev, `CONTROL_PLANE_INVITE_DEV=1` returns `token` in JSON |
| GET/POST | `/api/v1/customers/:customerId/agents` | List / register agents (Agent Registry) |
| GET/PATCH | `/api/v1/customers/:customerId/agents/:agentId` | Get or update agent |
| POST | `/api/v1/customers/:customerId/agents/:agentId/deactivate` | Soft-deactivate agent |
| GET | `/api/v1/customers/:customerId/audit` | Security/admin audit log (admin) |
| POST | `/api/v1/auth/refresh` | Body `{ refreshToken }` — new access + refresh (rotates session) |
| POST | `/api/v1/auth/logout` | Body `{ refreshToken }` and/or `Authorization: Bearer` (revoke one session or all for user) |
| GET | `/api/v1/auth/me` | Current principal (user + memberships, legacy, or api key marker) |
| POST | `/api/v1/auth/change-password` | Authenticated: `{ currentPassword, newPassword }` — new tokens |
| POST | `/api/v1/auth/forgot-password` | `{ email }` — always `{ ok: true }`; dev: `CONTROL_PLANE_PASSWORD_RESET_DEV=1` returns `resetToken` |
| POST | `/api/v1/auth/reset-password` | `{ token, newPassword }` |
| POST | `/api/v1/auth/accept-invite` | `{ token, password }` — join org (new or existing user) |
| GET/POST | `/api/v1/customers/:customerId/rulesets` (+ versions) | List / create ruleset |
| GET | `.../rulesets/:rulesetId/versions/:versionId` | Version metadata + **published bundle** (digest, paths) when published |
| POST | `.../versions/:versionId/review` or `.../submit-review` | DRAFT → IN_REVIEW |
| POST | `.../versions/:versionId/approve` or `.../approve-review` | IN_REVIEW → APPROVED |
| POST | `.../versions/:versionId/publish` | Publish bundle (ARSL-validate; pins digest); response includes `state`, `publishedBy` |
| POST | `.../deprecate` · `.../retire` | Deprecate / retire published version |
| POST | `/api/v1/auth/login` | Body `{ email, password }` (org users) or `{ password }` (legacy shared password) |
| POST | `/api/v1/auth/register` | If `OPEN_REGISTRATION=1`, register viewer on default customer |
| GET | `/api/v1/customers/:customerId/evidence/export` | Sync download: `agf.evidence_export/v1` JSON (query `from`, `to`) |
| GET | `/api/v1/customers/:customerId/evidence/exports` | List async export jobs (query `limit`) |
| POST | `/api/v1/customers/:customerId/evidence/exports` | Create export job; body or query `from` / `to`; file written under `data/exports` |
| GET | `/api/v1/customers/:customerId/evidence/exports/:jobId` | Job status; when completed, `downloadPath` points at relative API path |
| GET | `/api/v1/customers/:customerId/evidence/exports/:jobId/download` | Download completed job file (same v1 JSON as sync export) |
| GET | `/api/v1/customers/:customerId/webhooks/outbox` | Recent `webhook_outbox` rows for the org (admin) |
| GET | `/api/v1/kernel/health` | AGF `GET /health` via `AGF_KERNEL_URL` |
| (legacy) | `/api/v1/dashboard/summary?customerId=` | Short path, default `cust_dev` |

## Env

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Bind port |
| `AGF_KERNEL_URL` | `http://127.0.0.1:3000` | AGF `agf-server` base URL (evaluate + health) |
| `AGF_SP1_ROOT` | (auto) | Absolute path to the `agf-sp1` crate root for rule file resolution |
| `CONTROL_PLANE_DATA` | `./data` | Where SQLite file lives (under package root) |
| `SQLITE_PATH` | override for DB file | Full path to `.db` if needed |
| `CONTROL_PLANE_API_KEY` | unset | If set, require `Authorization: Bearer` (API key or JWT) on `/api/*` (see below for unauthenticated auth routes) |
| `CONTROL_PLANE_DASHBOARD_PASSWORD` | unset | If set, use with `POST /api/v1/auth/login` to obtain a JWT (needs `CONTROL_PLANE_JWT_SECRET`) |
| `CONTROL_PLANE_JWT_SECRET` | unset | Secret for signing login JWTs |
| `CONTROL_PLANE_ACCESS_JWT_TTL` | `15m` (via `CONTROL_PLANE_JWT_TTL` fallback) | Access token lifetime (`jose` `setExpirationTime` string) |
| `CONTROL_PLANE_REFRESH_DAYS` | `7` | Refresh session cookie lifetime (opaque token stored hashed in `sessions`) |
| `CONTROL_PLANE_PLATFORM_ADMINS` | unset | Comma-separated emails: may **create orgs** and have full org access (same as API key for RBAC) |
| `CONTROL_PLANE_PASSWORD_RESET_HOURS` | `1` | Reset token lifetime |
| `CONTROL_PLANE_PASSWORD_RESET_DEV` | unset | `1` = include `resetToken` in forgot-password JSON (never enable in production) |
| `CONTROL_PLANE_INVITE_DAYS` | `7` | Org invite link validity |
| `CONTROL_PLANE_INVITE_DEV` | unset | `1` = include invite `token` in create-invite response (never in production) |
| `CONTROL_PLANE_STRICT_RULESET` | unset | `1` = ruleset version must be `APPROVED` before publish |
| `CONTROL_PLANE_WEBHOOK_URL` | unset | Global webhook for `approval.resolved` / `approval.created` (per-customer row in `webhooks` table overrides URL) |
| `CONTROL_PLANE_WEBHOOK_SECRET` | unset | HMAC secret for `x-agf-signature-256` when using env URL |
| `CONTROL_PLANE_CORS_ORIGINS` | unset | Comma-separated browser origins for CORS; empty = same-origin only |
| `CONTROL_PLANE_RATE_LIMIT` | (enabled) | Set `0` to disable in-process rate limiting |
| `CONTROL_PLANE_RATE_LIMIT_WINDOW_MS` / `CONTROL_PLANE_RATE_LIMIT_MAX` | `60000` / `120` | General `/api` sliding window per client IP |
| `CONTROL_PLANE_AUTH_RATE_LIMIT_WINDOW_MS` / `CONTROL_PLANE_AUTH_RATE_LIMIT_MAX` | `60000` / `20` | Stricter bucket for `/api/v1/auth/*` |
| `AGF_ENTERPRISE_MODULE` | unset | Optional path to an enterprise extension module; when set, the module must export `default(ctx)` or `registerControlPlaneExtensions(ctx)` and can register additional routes/middleware |
| `ARSL_VALIDATE_BIN` | auto | Path to prebuilt `arsl-validate` (otherwise `cargo run` in `agf-sp1` or `target/*/arsl-validate`) |
| `CONTROL_PLANE_BOOTSTRAP_EMAIL` / `CONTROL_PLANE_BOOTSTRAP_PASSWORD` | unset | If `users` is empty, create an **admin** (needs `BOOTSTRAP_CUSTOMER` or defaults to `cust_dev`) |
| `CONTROL_PLANE_OPEN_REGISTRATION` | unset | `1` to allow `POST /api/v1/auth/register` (viewer on default customer) |
| `CONTROL_PLANE_REQUIRE_AUTH` | unset | `1` to require a bearer token for `/api/*` even in dev (no “open” API) |

**Website (production build):** set `VITE_CONTROL_PLANE_API_BASE` to the API origin, e.g. `https://your-cp.example.com` so the SPA calls `https://your-cp.example.com/api/...`.

**Users & orgs:** `users` + `org_memberships` + `sessions` (refresh) + `password_resets` + `org_invites` + `audit_log` tables. Access JWTs (v2) are short-lived; refresh tokens are opaque and stored hashed. Org **admin** has full role coverage within that org. New organizations: **API key** or **platform admin** (see `CONTROL_PLANE_PLATFORM_ADMINS`). Use **HTTPS** in production; do not enable `*_DEV` token echo flags outside local development. **Outbound webhooks** are written to `webhook_outbox` and retried in-process with exponential backoff.

**Unauthenticated JSON routes (no `Authorization` required):** `POST /api/v1/auth/login`, `POST /api/v1/auth/register` (if enabled), `POST /api/v1/auth/refresh`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/accept-invite`, `POST /api/v1/auth/logout`, and `GET /api/v1/public/config`.

### Enterprise extension hook

By default, AGF control plane starts in OSS mode. To load private enterprise
functionality at boot, set `AGF_ENTERPRISE_MODULE` to a file path.

The module contract is:

- `export default async function register(ctx) { ... }`, or
- `export async function registerControlPlaneExtensions(ctx) { ... }`

Where `ctx` contains `{ app, express, getDb, env }`.
