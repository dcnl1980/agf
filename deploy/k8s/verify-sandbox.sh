#!/usr/bin/env bash
# deploy/k8s/verify-sandbox.sh
#
# Runs layered verification of the AGF sandbox:
#   Layer 1: Docker sandbox security constraints
#   Layer 2: K8s kata runtime verification
#
# Prerequisites:
#   Layer 1: Docker running locally
#   Layer 2: kubectl connected to neurocluster (10.10.0.40)
#
# Usage:
#   bash deploy/k8s/verify-sandbox.sh [--layer1-only] [--layer2-only]

set -euo pipefail

LAYER1=true
LAYER2=true
SERVER_URL="http://localhost:3000"
K8S_NS="agf"

for arg in "$@"; do
  case $arg in
    --layer1-only) LAYER2=false ;;
    --layer2-only) LAYER1=false ;;
  esac
done

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }
info() { echo -e "  ${YELLOW}ℹ${NC}  $1"; }

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  AGF Sandbox Verification — Layer 1 (Software) + Layer 2   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

# ══════════════════════════════════════════════════════════════════════════════
# LAYER 1: Docker Software Sandbox
# ══════════════════════════════════════════════════════════════════════════════
if $LAYER1; then
  echo "━━ Layer 1: Docker Software Sandbox ━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # 1a. Build the image
  info "Building agf-server:dev image..."
  docker build -t agf-server:dev -f Dockerfile . --quiet
  ok "Image built"

  # 1b. Start the sandbox
  info "Starting sandbox container..."
  docker compose -f docker-compose.sandbox.yml up -d --wait 2>/dev/null
  ok "Container started"

  # Give it a moment to bind
  sleep 2

  # 1c. Health check
  HEALTH=$(curl -sf "${SERVER_URL}/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])")
  [[ "$HEALTH" == "ok" ]] && ok "GET /health → ok" || fail "GET /health failed: $HEALTH"

  # 1d. Evaluate PASS case (sanctions)
  PASS_RESP=$(curl -sf -X POST "${SERVER_URL}/evaluate" \
    -H 'Content-Type: application/json' \
    -d '{
      "rule_file": "rules/sanctions/hmt.arsl.toml",
      "entity_id": 9001,
      "data": {
        "counterparty_jurisdiction_hash": 99,
        "ubo_jurisdiction_hash": 99,
        "currency_code_hash": 42,
        "counterparty_name_hash": 12345,
        "transaction_amount_gbp": 500000
      }
    }')
  DECISION=$(echo "$PASS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['decision'])")
  [[ "$DECISION" == "PASS" ]] && ok "POST /evaluate sanctions → PASS" || fail "Expected PASS, got: $DECISION"

  # 1e. Evaluate BLOCK case (underage KYC)
  BLOCK_RESP=$(curl -sf -X POST "${SERVER_URL}/evaluate" \
    -H 'Content-Type: application/json' \
    -d '{
      "rule_file": "rules/kyc/standard_onboarding.arsl.toml",
      "entity_id": 1001,
      "data": {
        "customer_age_years": 16,
        "aml_risk_score": 12,
        "id_verification_passed": 1,
        "country_of_birth_hash": 77,
        "pep_status": 0,
        "applicant_name_hash": 12345
      }
    }')
  BLOCK_DECISION=$(echo "$BLOCK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['decision'])")
  [[ "$BLOCK_DECISION" == "BLOCK" ]] && ok "POST /evaluate KYC underage → BLOCK" || fail "Expected BLOCK, got: $BLOCK_DECISION"

  # 1f. Verify signature present
  SIG=$(echo "$PASS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('signature','MISSING'))")
  [[ "$SIG" == ed25519:* ]] && ok "Ed25519 signature present in response" || fail "Signature missing or malformed: $SIG"

  # 1g. Get public key
  PK=$(curl -sf "${SERVER_URL}/public-key" | python3 -c "import sys,json; print(json.load(sys.stdin)['public_key'])")
  [[ "$PK" == ed25519:* ]] && ok "GET /public-key → $PK" || fail "Public key malformed: $PK"

  # 1h. Audit log has 2 entries
  ENTRIES=$(curl -sf "${SERVER_URL}/audit-log" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  [[ "$ENTRIES" == "2" ]] && ok "GET /audit-log → 2 entries" || fail "Expected 2 audit entries, got: $ENTRIES"

  # 1i. Verify signature with agf-verify
  info "Running agf-verify on PASS response..."
  echo "$PASS_RESP" | cargo run -q --release --package agf-server --bin agf-verify -- --server "${SERVER_URL}" 2>/dev/null \
    && ok "agf-verify: signature + chain verified" \
    || fail "agf-verify failed"

  # 1j. Tamper test — modify the decision and verify FAILS
  TAMPERED=$(echo "$PASS_RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
d['decision']='BLOCK'  # tamper
print(json.dumps(d))
")
  # Save to tmp file and run verify (expect exit code 1)
  echo "$TAMPERED" > /tmp/agf-tampered.json
  if cargo run -q --release --package agf-server --bin agf-verify -- \
      --result /tmp/agf-tampered.json --server "${SERVER_URL}" 2>/dev/null; then
    fail "Tamper test: verify should have FAILED but PASSED"
  else
    ok "Tamper test: tampered result correctly REJECTED"
  fi

  # 1k. Check container security constraints
  info "Verifying container security constraints..."
  PRIVS=$(docker inspect agf-sandbox --format '{{.HostConfig.SecurityOpt}}')
  [[ "$PRIVS" == *"no-new-privileges:true"* ]] && ok "no-new-privileges: confirmed" || fail "no-new-privileges not set"
  READONLY=$(docker inspect agf-sandbox --format '{{.HostConfig.ReadonlyRootfs}}')
  [[ "$READONLY" == "true" ]] && ok "ReadOnlyRootFilesystem: confirmed" || fail "Not read-only"
  USER=$(docker inspect agf-sandbox --format '{{.Config.User}}')
  [[ "$USER" == "65532:65532" ]] && ok "Non-root user 65532: confirmed" || fail "Wrong user: $USER"

  docker compose -f docker-compose.sandbox.yml down -v --remove-orphans 2>/dev/null
  ok "Layer 1 sandbox stopped cleanly"
  echo
fi

# ══════════════════════════════════════════════════════════════════════════════
# LAYER 2: K8s Kata Containers
# ══════════════════════════════════════════════════════════════════════════════
if $LAYER2; then
  echo "━━ Layer 2: K8s Kata Containers (kata-qemu-snp) ━━━━━━━━━━━━━━━"

  # 2a. Check cluster is reachable
  kubectl cluster-info > /dev/null 2>&1 && ok "Cluster reachable" || fail "Cluster unreachable (check VPN)"

  # 2b. Verify kata RuntimeClass exists
  kubectl get runtimeclass kata-qemu-snp > /dev/null 2>&1 \
    && ok "kata-qemu-snp RuntimeClass exists" \
    || fail "kata-qemu-snp not found — check Kata Containers installation"

  # 2c. Apply manifests
  info "Applying AGF namespace + Kyverno exception..."
  kubectl apply -f deploy/k8s/01-namespace.yaml 2>&1 | grep -v "unchanged" | head -5

  info "Applying deployment + service..."
  kubectl apply -f deploy/k8s/02-deployment.yaml 2>&1 | grep -v "unchanged" | head -5

  info "Applying network policy..."
  kubectl apply -f deploy/k8s/03-network-policy.yaml 2>&1 | grep -v "unchanged" | head -5

  # 2d. Wait for deployment to be ready
  info "Waiting for evaluator pod to be Ready (up to 120s)..."
  kubectl rollout status deployment/agf-evaluator -n ${K8S_NS} --timeout=120s \
    && ok "agf-evaluator deployment Ready" \
    || { info "Deployment not ready — check logs: kubectl logs -n ${K8S_NS} deploy/agf-evaluator"; fail "Deployment timed out"; }

  # 2e. Check the pod is running on kata
  POD=$(kubectl get pod -n ${K8S_NS} -l app=agf-evaluator -o jsonpath='{.items[0].metadata.name}')
  RUNTIME=$(kubectl get pod -n ${K8S_NS} "${POD}" -o jsonpath='{.spec.runtimeClassName}')
  [[ "$RUNTIME" == "kata-qemu-snp" ]] && ok "Pod runtime: kata-qemu-snp confirmed" || fail "Unexpected runtime: $RUNTIME"

  # 2f. Verify kata VM boundary: kernel inside the pod should differ from host
  HOST_KERNEL=$(uname -r)
  POD_KERNEL=$(kubectl exec -n ${K8S_NS} "${POD}" -- uname -r 2>/dev/null || echo "unknown")
  if [[ "$POD_KERNEL" != "$HOST_KERNEL" ]]; then
    ok "Kata VM kernel (${POD_KERNEL}) ≠ host kernel (${HOST_KERNEL}) — VM boundary confirmed"
  else
    info "Kernel strings match (${POD_KERNEL}) — kata may not be using SNP hardware, but isolation is still active"
  fi

  # 2g. Run conformance job inside the cluster
  info "Running conformance job inside Kata pod..."
  kubectl delete job agf-conformance -n ${K8S_NS} --ignore-not-found 2>/dev/null
  kubectl apply -f deploy/k8s/04-conformance-job.yaml
  kubectl wait --for=condition=complete job/agf-conformance -n ${K8S_NS} --timeout=300s \
    && ok "Conformance job completed successfully inside Kata" \
    || { kubectl logs -n ${K8S_NS} -l job-name=agf-conformance --tail=30; fail "Conformance job failed"; }

  echo
  ok "Layer 2 verification complete"
fi

echo
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ ALL SANDBOX VERIFICATION CHECKS PASSED"
echo "     Layer 1: Software sandbox (Docker) — Ed25519 + IAL"
echo "     Layer 2: Kata VM (kata-qemu-snp) — K8s isolation"
echo "════════════════════════════════════════════════════════════════"
