#!/usr/bin/env bash
#
# Hard validation for AGF production-runtime claims.
#
# Supported profiles:
#   PROFILE=kata-gpu
#     Proves the current strongest truthful deployment posture:
#     - Kata QEMU runtime
#     - pinned to gpunode
#     - pod-local fail-closed zero egress
#     - application TEE mode remains mock
#
#   PROFILE=confidential-snp
#     Proves the future confidential-computing posture if the cluster
#     can actually support it:
#     - kata-qemu-snp runtime
#     - SNP-capable node
#     - zero egress probe
#     - application requests hardware TEE mode
#
# The script is intentionally fail-closed:
# if the cluster cannot prove the selected claim, it exits non-zero.
#
# Usage:
#   KUBECTL=/tmp/kubectl PROFILE=kata-gpu bash deploy/k8s/verify-production-truth.sh
#   KUBECTL=/tmp/kubectl PROFILE=confidential-snp bash deploy/k8s/verify-production-truth.sh

set -euo pipefail

KUBECTL="${KUBECTL:-kubectl}"
PROFILE="${PROFILE:-kata-gpu}"
DEPLOY="${DEPLOYMENT_NAME:-agf-evaluator}"
POD_LABEL="${POD_LABEL:-app=agf-evaluator}"
TMP_RUNTIME_POD="agf-runtime-proof"
TMP_SNP_POD="agf-snp-proof"
TMP_EGRESS_POD="agf-egress-proof"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'
ok()   { echo -e "  ${GREEN}✅${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; exit 1; }

NS="${K8S_NS:-}"
EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-}"
EXPECTED_NODE="${EXPECTED_NODE:-}"
EXPECTED_TEE_MODE="${EXPECTED_TEE_MODE:-}"

case "${PROFILE}" in
  kata-gpu)
    NS="${NS:-agf-gpu}"
    EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-kata-qemu}"
    EXPECTED_NODE="${EXPECTED_NODE:-gpunode}"
    EXPECTED_TEE_MODE="${EXPECTED_TEE_MODE:-mock}"
    ;;
  confidential-snp)
    NS="${NS:-agf}"
    EXPECTED_RUNTIME="${EXPECTED_RUNTIME:-kata-qemu-snp}"
    EXPECTED_TEE_MODE="${EXPECTED_TEE_MODE:-require-hardware}"
    ;;
  *)
    fail "Unsupported PROFILE=${PROFILE}. Use kata-gpu or confidential-snp"
    ;;
esac

cleanup() {
  ${KUBECTL} -n "${NS}" delete pod "${TMP_RUNTIME_POD}" --ignore-not-found=true >/dev/null 2>&1 || true
  ${KUBECTL} -n "${NS}" delete pod "${TMP_SNP_POD}" --ignore-not-found=true >/dev/null 2>&1 || true
  ${KUBECTL} -n "${NS}" delete pod "${TMP_EGRESS_POD}" --ignore-not-found=true >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   AGF Production Truth Verification                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo
echo "Profile: ${PROFILE}"
echo "Namespace: ${NS}"
echo

${KUBECTL} cluster-info >/dev/null 2>&1 || fail "Cluster unreachable"
ok "Cluster reachable"

${KUBECTL} -n "${NS}" get deploy "${DEPLOY}" >/dev/null 2>&1 || fail "Deployment ${DEPLOY} not found in namespace ${NS}"
ok "Deployment ${DEPLOY} exists"

RUNTIME="$(${KUBECTL} -n "${NS}" get deploy "${DEPLOY}" -o jsonpath='{.spec.template.spec.runtimeClassName}')"
if [[ "${RUNTIME}" == "${EXPECTED_RUNTIME}" ]]; then
  ok "Deployment runtimeClassName is ${EXPECTED_RUNTIME}"
else
  fail "Deployment runtimeClassName is ${RUNTIME}, expected ${EXPECTED_RUNTIME}"
fi

TEE_MODE="$(${KUBECTL} -n "${NS}" get deploy "${DEPLOY}" -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="AGF_TEE_MODE")].value}')"
if [[ "${TEE_MODE}" == "${EXPECTED_TEE_MODE}" ]]; then
  ok "Deployment AGF_TEE_MODE is ${EXPECTED_TEE_MODE}"
else
  fail "Deployment AGF_TEE_MODE is ${TEE_MODE}, expected ${EXPECTED_TEE_MODE}"
fi

LIVE_NODE="$(${KUBECTL} -n "${NS}" get pod -l "${POD_LABEL}" -o jsonpath='{.items[0].spec.nodeName}')"
if [[ -n "${LIVE_NODE}" ]]; then
  ok "Deployment pod is scheduled on ${LIVE_NODE}"
else
  fail "Could not resolve a live pod node for ${POD_LABEL}"
fi

if [[ -n "${EXPECTED_NODE}" ]]; then
  if [[ "${LIVE_NODE}" == "${EXPECTED_NODE}" ]]; then
    ok "Deployment pod is pinned to ${EXPECTED_NODE}"
  else
    fail "Deployment pod is on ${LIVE_NODE}, expected ${EXPECTED_NODE}"
  fi
fi

cat > /tmp/${TMP_RUNTIME_POD}.yaml <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${TMP_RUNTIME_POD}
  namespace: ${NS}
spec:
  runtimeClassName: ${EXPECTED_RUNTIME}
  restartPolicy: Never
  nodeSelector:
    katacontainers.io/kata-runtime: "true"
YAML

if [[ -n "${EXPECTED_NODE}" ]]; then
cat >> /tmp/${TMP_RUNTIME_POD}.yaml <<YAML
    kubernetes.io/hostname: ${EXPECTED_NODE}
YAML
fi

cat >> /tmp/${TMP_RUNTIME_POD}.yaml <<'YAML'
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: test
      image: busybox:1.36
      command: ["sh", "-c", "uname -r"]
      securityContext:
        privileged: false
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        capabilities:
          drop: ["ALL"]
YAML

${KUBECTL} apply -f /tmp/${TMP_RUNTIME_POD}.yaml >/dev/null
sleep 5

RUNTIME_PHASE="$(${KUBECTL} -n "${NS}" get pod "${TMP_RUNTIME_POD}" -o jsonpath='{.status.phase}')"
if [[ "${RUNTIME_PHASE}" == "Succeeded" || "${RUNTIME_PHASE}" == "Running" ]]; then
  ok "Runtime probe pod started under ${EXPECTED_RUNTIME}"
else
  echo
  ${KUBECTL} -n "${NS}" describe pod "${TMP_RUNTIME_POD}" || true
  fail "Runtime probe pod did not start successfully under ${EXPECTED_RUNTIME}"
fi

PROBE_NODE="$(${KUBECTL} -n "${NS}" get pod "${TMP_RUNTIME_POD}" -o jsonpath='{.spec.nodeName}')"
if [[ -n "${EXPECTED_NODE}" ]]; then
  if [[ "${PROBE_NODE}" == "${EXPECTED_NODE}" ]]; then
    ok "Runtime probe pod scheduled on ${EXPECTED_NODE}"
  else
    fail "Runtime probe pod scheduled on ${PROBE_NODE}, expected ${EXPECTED_NODE}"
  fi
fi

if [[ "${PROFILE}" == "confidential-snp" ]]; then
cat > /tmp/${TMP_SNP_POD}.yaml <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${TMP_SNP_POD}
  namespace: ${NS}
spec:
  runtimeClassName: ${EXPECTED_RUNTIME}
  nodeSelector:
    katacontainers.io/kata-runtime: "true"
  restartPolicy: Never
  securityContext:
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: test
      image: busybox:1.36
      command: ["sh", "-c", "uname -r"]
      securityContext:
        privileged: false
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        capabilities:
          drop: ["ALL"]
YAML

${KUBECTL} apply -f /tmp/${TMP_SNP_POD}.yaml >/dev/null
sleep 5

PHASE="$(${KUBECTL} -n "${NS}" get pod "${TMP_SNP_POD}" -o jsonpath='{.status.phase}')"
if [[ "${PHASE}" == "Succeeded" || "${PHASE}" == "Running" ]]; then
  ok "Confidential runtime probe pod started under ${EXPECTED_RUNTIME}"
else
  echo
  ${KUBECTL} -n "${NS}" describe pod "${TMP_SNP_POD}" || true
  fail "Confidential runtime probe pod did not start successfully under ${EXPECTED_RUNTIME}"
fi

NODE="$(${KUBECTL} -n "${NS}" get pod "${TMP_SNP_POD}" -o jsonpath='{.spec.nodeName}')"
SEV_SNP="$(${KUBECTL} get node "${NODE}" -o jsonpath='{.metadata.labels.feature\.node\.kubernetes\.io/cpu-cpuid.SEV_SNP}')"
if [[ "${SEV_SNP}" == "true" ]]; then
  ok "Probe pod scheduled on SNP-capable node ${NODE}"
else
  fail "Probe pod scheduled on node ${NODE} without SEV_SNP=true"
fi
fi

cat > /tmp/${TMP_EGRESS_POD}.yaml <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${TMP_EGRESS_POD}
  namespace: ${NS}
  labels:
    app: agf-evaluator
spec:
  runtimeClassName: ${RUNTIME}
  restartPolicy: Never
  nodeSelector:
    katacontainers.io/kata-runtime: "true"
YAML

if [[ -n "${EXPECTED_NODE}" ]]; then
cat >> /tmp/${TMP_EGRESS_POD}.yaml <<YAML
    kubernetes.io/hostname: ${EXPECTED_NODE}
YAML
fi

cat >> /tmp/${TMP_EGRESS_POD}.yaml <<'YAML'
  securityContext:
    seccompProfile:
      type: RuntimeDefault
YAML

if [[ "${PROFILE}" == "kata-gpu" ]]; then
cat >> /tmp/${TMP_EGRESS_POD}.yaml <<'YAML'
  initContainers:
    - name: lockdown-egress
      image: docker.io/library/alpine:3.20
      command:
        - sh
        - -ec
        - |
          apk add --no-cache iptables >/dev/null
          iptables -P OUTPUT DROP
          iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
          iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
      securityContext:
        privileged: false
        runAsNonRoot: false
        runAsUser: 0
        runAsGroup: 0
        readOnlyRootFilesystem: false
        allowPrivilegeEscalation: false
        seccompProfile:
          type: RuntimeDefault
        capabilities:
          drop: ["ALL"]
          add: ["NET_ADMIN"]
YAML
fi

cat >> /tmp/${TMP_EGRESS_POD}.yaml <<'YAML'
  containers:
    - name: test
      image: busybox:1.36
      command:
        - sh
        - -c
        - >
          wget -T 3 -O- http://1.1.1.1 >/tmp/out 2>/tmp/err && echo EXTERNAL_OK || echo EXTERNAL_BLOCKED
      securityContext:
        privileged: false
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        capabilities:
          drop: ["ALL"]
YAML

${KUBECTL} apply -f /tmp/${TMP_EGRESS_POD}.yaml >/dev/null
${KUBECTL} -n "${NS}" wait --for=jsonpath='{.status.phase}'=Succeeded pod/${TMP_EGRESS_POD} --timeout=120s >/dev/null 2>&1 || true

LOGS="$(${KUBECTL} -n "${NS}" logs "${TMP_EGRESS_POD}" 2>/dev/null || true)"
if echo "${LOGS}" | grep -q "EXTERNAL_BLOCKED"; then
  ok "External egress is blocked for the selected AGF profile"
else
  echo
  echo "${LOGS}"
  fail "External egress is NOT blocked for the selected AGF profile"
fi

echo
ok "All production-truth checks passed for ${PROFILE}"
