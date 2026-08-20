# Operations runbook — AGF community edition
#
# Scope: local compose + cluster deploy patterns in `deploy/k8s/`.

## Local stack

```bash
cp .env.example .env
# Optional for E2E/login: CONTROL_PLANE_BOOTSTRAP_* and CONTROL_PLANE_SEED_DEV_DATA=1
docker compose up -d --build
bash scripts/verify-stack.sh
```

URLs (defaults): website `http://127.0.0.1:8088`, control plane `http://127.0.0.1:4046`,
kernel `http://127.0.0.1:3036`, catalog `http://127.0.0.1:4055`.

Bootstrap login (when configured in `.env`): email/password from `CONTROL_PLANE_BOOTSTRAP_*`.

## Health & metrics

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Process liveness |
| `GET /ready` | SQLite ready (control plane) |
| `GET /metrics` | Prometheus text gauges |
| `GET /api/v1/public/config` | Auth/CORS/rate-limit flags (no secrets) |

## Rollback (compose)

```bash
docker compose down
# Restore previous images/tags if pinned, then:
docker compose up -d
```

SQLite data lives in Docker volume `agf_control_plane_data`. Destroy only if intentional:

```bash
docker compose down
docker volume rm agf_control_plane_data
```

## Kubernetes (outline)

1. Apply `deploy/k8s/01-namespace.yaml`
2. Create signing + control-plane secrets
3. Apply kernel (`02-deployment*.yaml`), control plane (`11-control-plane.yaml`), website (`10-website.yaml`)
4. Confirm TEE claims with `deploy/k8s/verify-production-truth.sh` before marketing hardware attestation

Image sources: NeuroCluster registry (`registry.neurocluster.dev/agf-*`) or community GHCR (`ghcr.io/dcnl1980/agf-*`). Pin digests in production.

Production must set `NODE_ENV=production` and a strong `CONTROL_PLANE_JWT_SECRET` (compose defaults are refused).

### TEE claim boundary

Default kernel profiles set `AGF_TEE_MODE=mock`. Do **not** claim hardware attestation until `PROFILE=confidential-snp` (or equivalent) passes `deploy/k8s/verify-production-truth.sh` on SNP/TDX-capable nodes.

## Incident notes

- Auth failures: check JWT secret, bootstrap user, clock skew
- Evaluate 502: kernel unreachable (`AGF_KERNEL_URL`)
- Publish failures: ARSL validate binary / `CONTROL_PLANE_SKIP_ARSL_VALIDATE` (never in production)
- Rate limit 429: tune `CONTROL_PLANE_*_RATE_LIMIT_*` or edge gateway

## Tests

```bash
cd control-plane && npm test
cd website && npm run test:e2e   # requires stack up + bootstrap user
```
