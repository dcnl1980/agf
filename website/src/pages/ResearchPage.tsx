import { motion } from 'framer-motion';
import { SectionWrapper } from '../components/layout/SectionWrapper';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Download, Fingerprint, BookOpen, Lock, TerminalSquare, ShieldAlert, Layers } from 'lucide-react';
import React from 'react';

export default function ResearchPage() {
  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-[10rem] pb-[6rem] border-b border-border/50 flex flex-col items-center justify-center overflow-hidden bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[1000px] mx-auto px-6 text-center relative z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Badge variant="outline" className="text-accent bg-surface-card border-border px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-bold">
              Whitepaper v1.0
            </Badge>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-7xl text-white font-bold leading-tight mb-6 max-w-[900px] mx-auto"
          >
            Agentic Governance Framework
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-[800px] mx-auto mb-10"
          >
            Deterministic compliance evaluation with cryptographic audit integrity — documented here as the enforcement kernel inside a broader AI governance stack: operators work through a control plane (policy lifecycle, identities, trust signals, HITL) while verdicts are produced only inside the isolated evaluator.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button size="lg" asChild className="bg-white text-black hover:bg-white/90 px-8 py-6 text-base font-semibold">
              <a href="/public/agf-whitepaper-v1.pdf" download className="flex items-center gap-2">
                Download Whitepaper (PDF) <Download className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <p className="text-xs text-white/40 mt-4 uppercase tracking-widest">NeuroCluster • March 2026</p>
          </motion.div>
        </div>
      </section>

      {/* Abstract */}
      <section className="py-24 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-3xl font-bold mb-6 text-white text-center">Abstract</h2>
          <div className="prose prose-invert prose-p:text-white/70 prose-p:leading-relaxed prose-lg mx-auto">
            <p>
              Financial compliance evaluation is predominantly manual, slow, and difficult to audit independently. We present the <strong>Agentic Governance Framework (AGF)</strong>, a system that compiles regulatory rules expressed in a domain-specific language (ARSL) into deterministic evaluation functions, executes those functions against structured action or entity context, and produces a tamper-evident audit record signed with Ed25519 and hash-chained with Blake3.
            </p>
            <p>
              We position AGF in a <strong>two-layer architecture</strong>: a governance control plane for configuration, risk signals, human approvals, and integrations does not execute policy math; the enforcement kernel does, with no outbound I/O during evaluation. The evaluation runs inside a Kata Containers micro-VM on Kubernetes, with the strongest live proof today coming from a gpu-scoped deployment that fail-closes outbound network access before the evaluator starts. We describe the system design, report prototype performance (26 rules evaluated in under 3 ms end-to-end), and outline an <em>optional, off-hot-path</em> direction for zero-knowledge proof of correct evaluation via SP1 zkVM — distinct from the default signed-audit production path. We critically assess the trust model, distinguish execution integrity from data integrity, caution against using probabilistic trust scores as a substitute for formal allow/deny logic, and identify open questions regarding rule formalization, key management, regulatory acceptance, and production readiness.
            </p>
          </div>
        </div>
      </section>

      {/* Key Contributions Grid */}
      <section className="py-24 bg-black px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Key Contributions</h2>
            <p className="text-xl text-ink-secondary max-w-[700px] mx-auto">
              How AGF redefines the mechanics of regulatory compliance validation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <TerminalSquare className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">ARSL</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                A TOML-based rule specification language that formalizes regulatory rules as machine-readable, version-controlled specifications.
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <BookOpen className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">Deterministic Evaluation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                A pure-function evaluation model using integer arithmetic, producing identical results across platforms and executions.
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <Fingerprint className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">Cryptographic Audit</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                A Blake3 hash-chained, Ed25519-signed Immutable Audit Log providing tamper-evident, verifiable evaluation records.
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <Lock className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">Defense-in-Depth</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                Multi-layer isolation via distroless containers, Kata QEMU micro-VMs, and a validated gpu-scoped no-egress runtime profile.
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <Layers className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">Control Plane vs Kernel</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                Separation of concerns: UX, orchestration, and trust scoring inform process; deterministic PASS/BLOCK/HITL outcomes and signed logs come only from the enforcement kernel.
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border hover:border-white/20 transition-colors">
              <CardHeader>
                <ShieldAlert className="w-8 h-8 text-accent mb-4" />
                <CardTitle className="text-xl text-white">Critical Assessment</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-secondary leading-relaxed">
                Explicit discussion of data integrity limitations, formalization risk, key management gaps, ZK as non-default assurance, and regulatory acceptance.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Read Before Relying */}
      <section className="py-24 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[800px] mx-auto">
          <div className="border border-caution-border bg-caution-bg/10 p-8 rounded-2xl relative overflow-hidden">
             {/* Subtle background glow */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-caution-text/5 rounded-full blur-3xl" />
             
             <h3 className="text-2xl font-bold text-caution-text mb-6 flex items-center gap-3">
                <ShieldAlert className="w-6 h-6" /> Important Notice
             </h3>
             <div className="space-y-4 text-white/70 text-sm leading-relaxed relative z-10">
               <p>
                 This whitepaper describes a <strong>prototype system</strong>. It does not constitute legal advice, and NeuroCluster makes no representation that use of AGF will result in compliance with any specific law or regulation.
               </p>
               <p>
                 The system provides integrity guarantees over the evaluation process. It does not validate the accuracy or completeness of input data, nor does it substitute for legal interpretation of regulatory text.
               </p>
               <p>
                 Zero-knowledge proofs are a demonstrated research path (e.g. SP1 conformance), not the default real-time evaluation feature: production posture is direct deterministic execution plus Ed25519-signed hash chains. Hardware TEE attestation and HSM/KMS key management are roadmap items.
               </p>
               <p>
                 Dynamic trust or risk scores — where used — are inputs and workflow signals; they must not replace versioned rules as the primary enforcement mechanism.
               </p>
             </div>
          </div>
        </div>
      </section>
      
      {/* Claim Boundary Matrix */}
      <section className="py-20 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[900px] mx-auto">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">Claim Boundary Matrix</h3>
          <p className="text-center text-ink-secondary mb-8">
            Live truth today is deterministic execution plus signed audit integrity in an isolated runtime profile. ZK proof and hardware attestation remain premium assurance modules.
          </p>
          <div className="overflow-x-auto border border-border rounded-xl bg-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-white">Capability</th>
                  <th className="px-4 py-3 text-left text-white">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border"><td className="px-4 py-3 text-ink-secondary">Deterministic evaluation and decisioning</td><td className="px-4 py-3 text-emerald-400">Live</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-3 text-ink-secondary">Signed decisions + hash-chained audit</td><td className="px-4 py-3 text-emerald-400">Live</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-3 text-ink-secondary">Policy path API runtime</td><td className="px-4 py-3 text-emerald-400">Live</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-3 text-ink-secondary">ZK proof in hot path</td><td className="px-4 py-3 text-purple-300">Prototype (Optional)</td></tr>
                <tr><td className="px-4 py-3 text-ink-secondary">Hardware TEE attestation</td><td className="px-4 py-3 text-amber-300">Roadmap / Premium</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-ink-muted mt-4">
            See `docs/CREDIBILITY_MATRIX.md` for the full claim posture reference used by product and GTM messaging.
          </p>
        </div>
      </section>

      {/* Citation Box */}
      <section className="py-16 bg-black px-6">
         <div className="max-w-[800px] mx-auto text-center">
            <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-4">Academic Citation</h3>
            <div className="bg-surface-card border border-border p-6 rounded-xl font-mono text-xs text-white/40 text-left overflow-x-auto select-all">
              NeuroCluster. "Agentic Governance Framework (AGF): Deterministic Compliance Evaluation with Cryptographic Audit Integrity." Technical Whitepaper v1.0, March 2026.
            </div>
         </div>
      </section>
    </div>
  );
}
