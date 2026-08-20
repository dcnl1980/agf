import { motion } from 'framer-motion';
import { SectionWrapper } from '../components/layout/SectionWrapper';
import { Badge } from '../components/ui/badge';
import { Shield, Lock, ChevronRight, Hash, Network, Box, LayoutDashboard, Plug, Users } from 'lucide-react';
import React from 'react';

export default function ArchitecturePage() {
  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-[8rem] pb-[4rem] border-b border-border/50 flex flex-col items-center justify-center overflow-hidden bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-6 text-center relative z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Badge variant="outline" className="text-accent bg-surface-card border-border px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-bold">
              Engineering Architecture
            </Badge>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-6 max-w-[900px] mx-auto"
          >
            Defensible by Design
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-[800px] mx-auto mb-8"
          >
            AGF separates what operators configure from what the kernel proves: a governance control plane handles identities, trust signals, workflows, and integrations, while the enforcement kernel alone runs deterministic evaluation with isolation and cryptographic audit. In production posture, each customer runs an isolated runtime environment for a customer-scoped kernel and evidence boundary.
          </motion.p>
        </div>
      </section>

      {/* Control plane vs kernel */}
      <section className="py-20 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-12 max-w-[720px]">
            <h2 className="text-3xl font-bold mb-4">Two layers, one trust boundary</h2>
            <p className="text-ink-secondary text-lg m-0">
              The control plane is allowed to move quickly on UX and orchestration. The enforcement kernel is deliberately narrow: no outbound calls during evaluation, versioned rules, and signed outputs. That separation lets auditors reason about the verdict path without conflating it with dashboard state.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-surface-card border border-border rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <LayoutDashboard className="w-8 h-8 text-accent" />
                <h3 className="text-xl font-bold m-0">Governance control plane</h3>
              </div>
              <ul className="space-y-3 text-ink-secondary m-0 pl-0 list-none">
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Agent registration and decentralized identifiers (DID-style) for traceability</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Teams, roles, SCIM/RBAC patterns, and policy publishing workflows</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Trust and risk scoring as signals — not a replacement for rule outcomes</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Human-in-the-loop queues, notifications, and export for regulators</li>
              </ul>
            </div>
            <div className="bg-surface-card border border-border rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-accent" />
                <h3 className="text-xl font-bold m-0">Enforcement kernel (policy firewall)</h3>
              </div>
              <ul className="space-y-3 text-ink-secondary m-0 pl-0 list-none">
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Pre-execution evaluation of proposed actions: ALLOW, BLOCK, or REQUIRE_APPROVAL</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> ARSL rules today; OPA/Rego-class policy packs for faster enterprise adoption</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Blake3 hash chain + Ed25519 signatures; optional ZK proofs off the hot path</li>
                <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-accent shrink-0 mt-1" /> Kata micro-VM isolation with a validated no-egress runtime profile</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col md:flex-row gap-4 items-stretch">
            <div className="flex-1 bg-black/40 border border-border rounded-xl p-6 flex gap-4">
              <Plug className="w-8 h-8 text-accent shrink-0" />
              <div>
                <h4 className="font-bold text-white mb-2 m-0">Integration layer</h4>
                <p className="text-ink-secondary text-sm m-0 leading-relaxed">
                  SDK-style adapters connect orchestrators and agent frameworks (Temporal first on the roadmap; additional stacks follow) so agents call into policy evaluation without rewriting core logic.
                </p>
              </div>
            </div>
            <div className="flex-1 bg-black/40 border border-border rounded-xl p-6 flex gap-4">
              <Users className="w-8 h-8 text-accent shrink-0" />
              <div>
                <h4 className="font-bold text-white mb-2 m-0">Deployment posture</h4>
                <p className="text-ink-secondary text-sm m-0 leading-relaxed">
                  SaaS-friendly control plane surfaces can coexist with customer-sovereign kernels: keep verdict keys in KMS/HSM, pin rule versions, and replicate audit shards for independent verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 5-Layer Pipeline Walkthrough (Process Deep-Dive Pattern) */}
      <section className="py-24 bg-surface px-6 relative border-b border-border/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-4">The Execution Pipeline (Kernel)</h2>
            <p className="text-ink-secondary text-lg">A zero-trust progression from authored policy to signed verdicts — the segment that must stay deterministic regardless of UI or integration churn.</p>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Rule Definition (ARSL)",
                desc: "We translate regulatory text into AGF Rule Specification Language (ARSL)—a strictly typed, machine-readable format. Rules are no longer guidelines; they are deterministic thresholds.",
                code: `[[rule]]
id = "EU-AI-014"
name = "Prohibited Practice Check"
category = "eu_ai_act"
severity = "critical"

[rule.condition]
type = "boolean_false"
field = "subliminal_manipulation"

[rule.enforcement]
on_fail = "block"`              },
              {
                step: "02",
                title: "Strict Compilation",
                desc: "The payload (AI output + metadata) is bound to the ARSL ruleset. The compiler validates schema integrity, types, and references before any logic executes.",
                code: `{
  "compiler_status": "OK",
  "payload_hash": "2cf24dba...",
  "rules_loaded": 14,
  "execution_mode": "strict"
}`
              },
              {
                step: "03",
                title: "Deterministic Evaluation",
                desc: "A pure function evaluates the batch. No external APIs. No randomness. No floating point operations. Same input guarantees identical output anywhere in the world.",
                code: `// Pure Function Execution
let evaluation = run_determistic(batch);

assert!(evaluation.side_effects == 0);
assert!(evaluation.pass == true);`
              },
              {
                step: "04",
                title: "Cryptographic Audit",
                desc: "Results are secured using a Blake3 hash chain and Ed25519 digital signatures. The signed message binds the outcome, the ruleset version, and the exact timestamp into an unforgeable record (distinct from zero-knowledge 'proofs').",
                code: `[SIGNATURE GENERATED]
Timestamp: 1714569830 UTC
Ed25519: 8a5f3...910bc

chain_hash(n) = Blake3(
  chain_hash(n-1) + payload
)`
              },
              {
                step: "05",
                title: "Kata VM Isolation",
                desc: "The sequence runs within a hardened Kata Containers QEMU micro-VM. In the strongest validated cluster profile, outbound network access is fail-closed before the evaluator starts and the process runs as non-root. This improves isolation materially, but it should not be confused with hardware-backed confidential computing.",
                code: `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: kata-qemu
handler: kata-qemu
---
# gpu-scoped fail-closed egress
iptables -P OUTPUT DROP`
              }
            ].map((layer, idx) => (
              <div key={idx} className="flex flex-col lg:flex-row gap-8 items-stretch group">
                <div className="flex-1 bg-surface-card border border-border p-8 rounded-xl relative overflow-hidden transition-colors hover:border-white/20">
                  <span className="absolute top-8 right-8 text-6xl font-black text-white/5">{layer.step}</span>
                  <h3 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <span className="text-accent">{layer.step}.</span> {layer.title}
                  </h3>
                  <p className="text-ink-secondary leading-relaxed max-w-[450px]">
                    {layer.desc}
                  </p>
                </div>
                <div className="flex-1 bg-[#09090D] border border-border rounded-xl p-6 font-mono text-xs md:text-sm text-white/70 overflow-x-auto shadow-inner h-full flex flex-col justify-center">
                  <pre className="m-0 bg-transparent text-emerald-400 p-0 font-mono">
                    <code>{layer.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep-Dive Grid: Primitives & Infrastructure */}
      <section className="py-24 bg-black px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Structural Primitives</h2>
            <p className="text-xl text-ink-secondary max-w-[700px] mx-auto">
              Our infrastructure relies on standard cryptographic primitives and strong isolation layers to create a defensible trust boundary around enforcement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-surface-card border border-border p-8 rounded-xl">
              <Hash className="w-8 h-8 text-accent mb-6" />
              <h3 className="text-2xl font-bold mb-3">Blake3 Hash Chaining</h3>
              <p className="text-ink-secondary leading-relaxed">
                Selected for performance and suitability for append-only audit chains. Every evaluation is chained to the previous one, making silent modification computationally infeasible under standard cryptographic assumptions. The architecture can swap in alternative hash functions where regulatory preference demands it.
              </p>
            </div>
            
            <div className="bg-surface-card border border-border p-8 rounded-xl">
              <Lock className="w-8 h-8 text-accent mb-6" />
              <h3 className="text-2xl font-bold mb-3">Ed25519 Signatures</h3>
              <p className="text-ink-secondary leading-relaxed">
                Provides deterministic nonce generation—eliminating broad classes of implementation vulnerabilities. Uses compact 64-byte signatures ensuring highly efficient but impenetrable verification of log integrity.
              </p>
            </div>
            
            <div className="bg-surface-card border border-border p-8 rounded-xl">
              <Box className="w-8 h-8 text-accent mb-6" />
              <h3 className="text-2xl font-bold mb-3">Hardware-Backed VMs</h3>
              <p className="text-ink-secondary leading-relaxed">
                Standard Docker provides kernel-sharing containers. AGF uses Kata Containers, placing each task inside a dedicated QEMU micro-VM with its own kernel. This reduces the blast radius of container compromise, though memory confidentiality still requires a real hardware TEE.
              </p>
            </div>

            <div className="bg-surface-card border border-border p-8 rounded-xl">
              <Network className="w-8 h-8 text-accent mb-6" />
              <h3 className="text-2xl font-bold mb-3">Zero Egress Policy</h3>
              <p className="text-ink-secondary leading-relaxed">
                The strongest validated cluster profile fail-closes outbound traffic inside the pod network namespace during evaluation, so the kernel cannot phone home while judging an action. That meaningfully narrows exfiltration paths, but it is still one layer in a broader deployment security model.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
