#!/usr/bin/env bash
# End-to-end checks for the docker compose stack (or anything listening on the same host ports).
# Load ports from repo .env; defaults match .env.example.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
[ -f "$ROOT/.env" ] && set -a && source "$ROOT/.env" && set +a || true
K="${AGF_KERNEL_HOST_PORT:-3036}"
C="${CONTROL_PLANE_HOST_PORT:-4046}"
W="${WEBSITE_HOST_PORT:-8088}"
CATALOG="${CATALOG_HOST_PORT:-4055}"
S3="${MINIO_S3_API_HOST_PORT:-9000}"
fail=0
check() {
  name="$1"
  url="$2"
  if out=$(curl -fsS -m 8 "$url" 2>&1); then
    echo "OK  $name ($url)"
  else
    echo "FAIL $name ($url) — $out" >&2
    fail=1
  fi
}
echo "=== AGF stack E2E (curl) ==="
# Catalog API (Phase B) and website /catalog/ proxy need `docker compose up` (or `node catalog-api/server.mjs` for :4055 + rebuilt website image for nginx).
check "AGF kernel /health" "http://127.0.0.1:${K}/health"
check "Control plane /health" "http://127.0.0.1:${C}/health"
check "Control plane /api/v1/public/config" "http://127.0.0.1:${C}/api/v1/public/config"
check "MinIO S3 /minio/health/live" "http://127.0.0.1:${S3}/minio/health/live"
check "Website (nginx) /" "http://127.0.0.1:${W}/"
check "Website proxy /api/v1/public/config" "http://127.0.0.1:${W}/api/v1/public/config"
check "Catalog API /health (direct port)" "http://127.0.0.1:${CATALOG}/health"
check "Catalog API via website /catalog/v1/entries" "http://127.0.0.1:${W}/catalog/v1/entries"
# Through compose: kernel reachable from control plane (requires dashboard auth — smoke DB path only)
if curl -fsS -m 8 "http://127.0.0.1:${C}/api/v1/public/config" | grep -q jwtSigningConfigured; then
  echo "OK  public config JSON contains jwtSigningConfigured"
else
  echo "FAIL public config JSON" >&2
  fail=1
fi
if [ "$fail" -ne 0 ]; then
  echo "One or more checks failed."
  exit 1
fi
echo "All checks passed."
exit 0
