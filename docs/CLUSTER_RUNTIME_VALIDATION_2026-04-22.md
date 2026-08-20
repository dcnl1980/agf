# AGF Live Cluster Runtime Validation

**Date:** 2026-04-22  
**Cluster context:** `neurocluster-remote`  
**Namespace:** `agf`

## Summary

A live cluster inspection was performed against the AGF deployment.

### Proven on the live cluster

- the Kubernetes cluster is reachable
- namespace `agf` exists
- deployment `agf-evaluator` exists
- pod `agf-evaluator-554c58477c-tc2ps` is running
- the live deployment uses `runtimeClassName: kata-qemu`
- the live deployment is scheduled on a Kata-capable node (`gpunode`)
- the cluster has Kata runtime classes installed, including:
  - `kata-qemu`
  - `kata-qemu-snp`
  - `kata-qemu-tdx`
- the node `gpunode` advertises `SEV_SNP=true`
- the live AGF pod loads a signing key from Kubernetes Secret, not ephemeral fallback

### Not proven, and currently false as broad production claims

- confidential runtime truth via `kata-qemu-snp`
- hardware-backed TEE attestation truth
- live zero-egress enforcement truth

### Newly proven in a narrower gpu-scoped profile

- a Kata QEMU workload can be pinned specifically to `gpunode`
- pod-local fail-closed outbound blocking can be enforced on `gpunode`
- an egress probe in that gpu-scoped profile returned `EXTERNAL_BLOCKED`

## Hard Findings

### 1. Confidential runtime claim is not currently true

The live deployment runs with:

```text
runtimeClassName: kata-qemu
```

not:

```text
runtimeClassName: kata-qemu-snp
```

An additional proof pod was scheduled with `kata-qemu-snp` on `gpunode`.
It failed to start successfully.

Observed kubelet error:

```text
Failed to create pod sandbox: ... This system doesn't support Confidential Computing (Guest Protection)
```

That means:

- the node labels alone are not enough
- the currently available cluster/runtime path does not yet provide working SNP guest protection for this workload

### 2. TEE attestation claim is not currently true

The application still uses mock attestation generation in:

- [agf-sp1/server/src/tee.rs](/Users/cvsteenbergen/Code/agf/agf-sp1/server/src/tee.rs)

Current API behavior is therefore not hardware-attested runtime proof.

### 3. Zero-egress claim is not currently true for the existing `agf` namespace

A temporary probe pod was created in namespace `agf` with:

- label `app=agf-evaluator`
- runtime class on Kata
- the same NetworkPolicy selector as the AGF evaluator

That pod was able to reach:

- the internal AGF service
- the public endpoint `1.1.1.1`

Therefore, external egress is not actually blocked in practice for AGF-selected pods on this cluster.

### 4. Zero-egress is now proven in a gpu-scoped truth profile

A separate gpu-scoped validation namespace was created so the pod could install a fail-closed iptables policy inside its own network namespace before the application started.

The proof pod:

- ran with `runtimeClassName: kata-qemu`
- was pinned to `gpunode`
- installed `OUTPUT DROP` plus explicit loopback and established-flow exceptions
- returned `EXTERNAL_BLOCKED` when probing `http://1.1.1.1`

This is materially different from the existing `agf` namespace:

- it is node-scoped to `gpunode`
- it relies on pod-local enforcement rather than cluster NetworkPolicy enforcement
- it still does not prove confidential computing or hardware attestation

## Root-Cause Direction

### Confidential runtime

Likely blockers:

- guest-protection runtime is not actually functional on the node despite feature labels
- the cluster has runtime classes installed, but SNP-capable pod sandbox creation fails
- AGF is still deployed on plain `kata-qemu`

### Zero egress

Likely blocker:

- the cluster currently uses `kube-flannel` and does not appear to have a policy-enforcing CNI such as Calico or Cilium for Kubernetes NetworkPolicy enforcement

## What Must Change Before Website / Docs Can Claim Production Truth

### For Kata/SNP truth

1. `kata-qemu-snp` must successfully start a workload on the target node
2. AGF deployment must actually run on that runtime class
3. TEE attestation must move from mock to real hardware-backed evidence

### For zero-egress truth

1. either a network-policy-enforcing CNI must be active, or the workload must use a pod-local fail-closed egress mechanism
2. external egress probe from the actual enforcement profile must fail
3. the verification must be repeatable via script

## Repo Changes Added

To make false positives harder in the future, the repo now includes:

- [deploy/k8s/02-deployment.yaml](/Users/cvsteenbergen/Code/agf/deploy/k8s/02-deployment.yaml)
  Current live profile, explicitly `kata-qemu`
- [deploy/k8s/02-deployment-snp.yaml](/Users/cvsteenbergen/Code/agf/deploy/k8s/02-deployment-snp.yaml)
  Candidate confidential profile
- [deploy/k8s/verify-production-truth.sh](/Users/cvsteenbergen/Code/agf/deploy/k8s/verify-production-truth.sh)
  A fail-closed script that checks confidential-runtime and zero-egress truth

## Bottom Line

Current truthful state:

> **Live Kubernetes deployment on Kata VM:** yes  
> **Live confidential-runtime proof:** no  
> **Live hardware attestation proof:** no  
> **Live zero-egress proof in `agf`:** no  
> **Live zero-egress proof in gpu-scoped truth profile:** yes  
> **Live hardware attestation proof:** no
