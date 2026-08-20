import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="flex flex-col bg-surface w-full text-ink min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-[8rem] pb-[4rem] flex flex-col items-center justify-center overflow-hidden bg-black border-b border-border/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[1000px] mx-auto px-6 text-center relative z-10 w-full">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-6"
          >
            We build the layer that <br/> <span className="text-accent-light text-accent">governs what AI is allowed to do.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-white/60 max-w-[700px] mx-auto mb-8"
          >
            NeuroCluster is an applied research and engineering organization based in the United Kingdom. We build infrastructure that combines enterprise-grade AI governance surfaces — the kind of visibility, approvals, identity, and integrations operators expect — with a deterministic policy kernel that cannot be bypassed through model prompts alone.
          </motion.p>
        </div>
      </section>

      {/* The Problem Narrative */}
      <section className="py-24 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-3xl font-bold mb-8">The Structural Governance Problem</h2>
          <div className="space-y-6 text-xl text-ink-secondary leading-relaxed">
            <p>
              In highly regulated domains like banking, healthcare, and government, trust is hollow without proof. Right now, organizations often deploy LLMs and autonomous agents behind subjective guardrails such as prompts, scorecards, or lightweight moderation.
            </p>
            <p>
              <strong>That is not enough for real governance.</strong>
            </p>
            <p>
              We believe the right product architecture has two layers. First, a control plane where teams onboard agents, route approvals, manage identities, and observe risk. Second, a narrow enforcement kernel where proposed actions are checked against formal rules before they run. If a regulation says "do not write data without explicit consent", the infrastructure should block or escalate that action through policy, not hope the model behaves.
            </p>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-24 bg-black px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Our Engineering Principles</h2>
            <p className="text-ink-secondary text-lg max-w-[600px] mx-auto">
              How we approach the intersection of AI scaling and regulatory rigidity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Rules, Not Hope",
                desc: "We translate regulatory and enterprise requirements into strict, versioned rulesets: ARSL where formality matters most, and pragmatic policy-pack paths where adoption speed matters."
              },
              {
                title: "Verifiable Records",
                desc: "Every evaluation should produce an independently verifiable, tamper-evident record. Cryptography proves the integrity of execution artifacts, not the truth of upstream data."
              },
              {
                title: "Operator-Usable Governance",
                desc: "Dashboards, approvals, identities, and integrations matter. Teams need control-plane tooling they can actually operate, not just a kernel buried in infrastructure."
              },
              {
                title: "Pessimistic Enforcement",
                desc: "We assume the AI agent can hallucinate, defect, or become compromised. The enforcement layer must remain a final, no-bypass gate with isolated execution and default-deny posture."
              }
            ].map((principle, idx) => (
              <Card key={idx} className="bg-surface-card border-border hover:border-white/20 transition-colors">
                <CardContent className="p-8">
                  <CheckCircle2 className="w-8 h-8 text-accent mb-4" />
                  <h3 className="text-xl font-bold mb-2 text-white">{principle.title}</h3>
                  <p className="text-ink-secondary m-0">{principle.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Layer */}
      <section className="py-24 bg-surface px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Explore the Infrastructure</h2>
          <p className="text-lg text-ink-secondary mb-10">
            The Agentic Governance Framework (AGF) is NeuroCluster's formal compliance kernel and reference implementation for the broader governance stack. Read the technical material to understand the enforcement model, audit trail, and trust boundaries.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Button size="lg" asChild className="bg-white text-black hover:bg-white/90 w-full sm:w-auto px-8">
              <Link to="/research">AGF Whitepaper v1.0</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-border hover:bg-surface-card w-full sm:w-auto px-8">
              <Link to="/contact">Request Institutional Briefing</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
