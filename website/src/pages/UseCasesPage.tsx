import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Bot, BarChart4, Globe2, ShieldCheck, Heart, Plane, Zap, Phone,
  CheckCircle2, Landmark, Lock, Scale
} from 'lucide-react';
import React from 'react';

interface UseCase {
  icon: React.ReactNode;
  title: string;
  problem: string;
  enforcement: string;
  outcome: string;
  ruleFiles: string[];
  ruleCount: number;
  visual: React.ReactNode;
}

const useCases: UseCase[] = [
  {
    icon: <ShieldCheck className="text-accent w-6 h-6" />,
    title: 'KYC & Onboarding Gates',
    problem: 'Financial institutions need to verify identity, check sanctions lists, and assess risk before onboarding — but manual reconciliation is slow and mutable audit logs are easily contested.',
    enforcement: 'A single /evaluate call processes the applicant through 6 KYC rules: age gate (≥18), AML risk score (≤24), government ID verification, FATF jurisdiction exclusion, PEP status, and sanctions name-match — evaluated by the deterministic kernel before onboarding proceeds.',
    outcome: 'Every onboarding decision is rule-based, reviewable, and exported as a signed audit artifact rather than only a mutable database log entry.',
    ruleFiles: ['rules/finance/kyc/standard_onboarding.arsl.toml'],
    ruleCount: 6,
    visual: (
      <div className="bg-[#09090D] border border-border p-6 rounded-xl font-mono text-sm text-white/70 h-full flex flex-col justify-center">
        <div className="text-accent mb-4 text-xs font-bold uppercase tracking-widest">KYC Evaluation Payload</div>
        <pre className="text-cyan-400 bg-transparent p-0 m-0 leading-relaxed overflow-x-hidden text-[0.8rem]">
{`{
  "customer_age_years": 25,
  "aml_risk_score": 12,
  "id_verification_passed": true,
  "country_of_birth_hash": 77,
  "pep_status": 0,
  "applicant_name_hash": 12345
}`}
        </pre>
        <div className="mt-5 flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded border border-green-500/20">
          <CheckCircle2 className="w-4 h-4" />
          6/6 PASS — Standard Onboarding Approved (2.4ms)
        </div>
      </div>
    ),
  },
  {
    icon: <Globe2 className="text-accent w-6 h-6" />,
    title: 'Sanctions Screening',
    problem: 'Banks must screen counterparties against HMT, OFAC SDN, and FATF watchlists before every transaction. Existing screening vendors produce mutable log entries — easily altered, hard to prove to regulators.',
    enforcement: 'AGF loads 5 sanctions rules evaluating counterparty jurisdiction, UBO jurisdiction, currency denomination, SDN name-match, and large transaction thresholds. A blocked result (e.g., RU jurisdiction hash) yields a deterministic BLOCK verdict and a signed, hash-chained audit entry — not a zero-knowledge proof unless you opt into that separate assurance path.',
    outcome: 'Each sanctions screen produces a signed, tamper-evident record of which rules ran and what was blocked or allowed. Zero-knowledge verification remains a prototype path for higher-assurance deployments, not the default production flow.',
    ruleFiles: ['rules/finance/sanctions/hmt.arsl.toml'],
    ruleCount: 5,
    visual: (
      <div className="w-full flex flex-col gap-3">
        {[
          { label: 'HMT-SAN-001 · Counterparty Jurisdiction', result: 'PASS', ok: true },
          { label: 'HMT-SAN-002 · UBO Jurisdiction', result: 'PASS', ok: true },
          { label: 'HMT-SAN-003 · Currency Denomination', result: 'PASS', ok: true },
          { label: 'OFAC-SDN-001 · SDN Name-Match', result: 'BLOCK', ok: false },
          { label: 'HMT-SAN-005 · Large Transaction EDD', result: 'PASS', ok: true },
        ].map((r, i) => (
          <div key={i} className="bg-black border border-border p-3 rounded-lg flex justify-between items-center">
            <span className="font-mono text-xs text-white/50">{r.label}</span>
            <span className={`font-mono text-xs font-bold ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.result}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <BarChart4 className="text-accent w-6 h-6" />,
    title: 'Prudential Capital & Liquidity',
    problem: 'Banks submit daily capital adequacy reports to the PRA/FCA. Current attestations are manual sign-offs — a CFO signature on a spreadsheet. If figures are manipulated, there is no tamper-proof record.',
    enforcement: '10 FCA Consumer Duty rules evaluate capital ratio (≥8%), LCR (≥100%), leverage (≥3%), NSFR, large exposure limits (≤25%), solvency, Tier 1, counter-cyclical buffer, stressed capital, and DORA ICT incident reporting — all in a single deterministic evaluation pass.',
    outcome: 'The institution gets a deterministic record that its prudential checks ran against a defined ruleset and produced a traceable outcome. TEE-attested inputs and ZK verification are possible future upgrades, not assumptions in the current production posture.',
    ruleFiles: ['rules/finance/fca/consumer_duty.arsl.toml'],
    ruleCount: 10,
    visual: (
      <div className="grid grid-cols-2 gap-3">
        {[
          { metric: '≥8%', label: 'Capital Ratio', rule: 'FCA-CD-001' },
          { metric: '≥100%', label: 'LCR', rule: 'FCA-CD-002' },
          { metric: '≥3%', label: 'Leverage', rule: 'FCA-CD-003' },
          { metric: '≥100%', label: 'NSFR', rule: 'FCA-CD-004' },
          { metric: '≤25%', label: 'Large Exposure', rule: 'FCA-CD-005' },
          { metric: '≤4h', label: 'DORA ICT Report', rule: 'DORA-ICT-001' },
        ].map((m, i) => (
          <Card key={i} className="bg-black border-border">
            <CardHeader className="p-4">
              <div className="text-accent font-bold text-lg">{m.metric}</div>
              <p className="text-white/60 text-xs mt-0.5">{m.label}</p>
              <p className="font-mono text-[0.6rem] text-white/30">{m.rule}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    ),
  },
  {
    icon: <Scale className="text-accent w-6 h-6" />,
    title: 'GDPR & EU AI Act Consent',
    problem: 'GDPR Article 5(2) requires accountability — organizations must demonstrate that consent was obtained and that data processing respects erasure requests and retention limits. Traditional database flags lack integrity.',
    enforcement: '5 consent rules: explicit Article 6(1)(a) consent, special category consent (Art. 9), right to erasure gate (Art. 17), data retention period enforcement (≤730 days), and EU AI Act Article 5 prohibited practice gate.',
    outcome: 'A signed evaluation artifact is a stronger accountability record than a plain database flag because it preserves rule context, ordering, and integrity. Zero-knowledge verification remains an optional future assurance path for privacy-sensitive environments.',
    ruleFiles: ['rules/cross_industry/gdpr/consent.arsl.toml'],
    ruleCount: 5,
    visual: (
      <div className="bg-[#09090D] border border-border p-6 rounded-xl font-mono text-sm text-white/70 h-full flex flex-col justify-center">
        <div className="text-accent mb-4 text-xs font-bold uppercase tracking-widest">Consent Check</div>
        <pre className="text-cyan-400 bg-transparent p-0 m-0 leading-relaxed overflow-x-hidden text-[0.8rem]">
{`{
  "gdpr_explicit_consent": true,
  "special_category_consent": true,
  "erasure_request_active": 0,
  "days_since_collection": 180,
  "ai_prohibited_category": 0
}`}
        </pre>
        <div className="mt-5 flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded border border-green-500/20">
          <CheckCircle2 className="w-4 h-4" />
          5/5 PASS — Processing Authorized (1.9ms)
        </div>
      </div>
    ),
  },
  {
    icon: <Heart className="text-accent w-6 h-6" />,
    title: 'Healthcare PHI Access Control',
    problem: 'When AI agents access or process Protected Health Information (PHI), HIPAA requires authorization verification and minimum necessary data scoping. A breach of PHI access rules carries fines up to $1.9M per violation.',
    enforcement: 'AGF enforces HIPAA PHI access authorization (§164.502(a)), the Minimum Necessary Standard (§164.502(b)), FDA SaMD confidence thresholds (≥85%), and 42 CFR Part 2 substance use disorder disclosure consent gates.',
    outcome: 'Every PHI access event can be bound to a signed enforcement record showing that authorization and minimization checks ran before access was released, providing stronger audit evidence than application logs alone.',
    ruleFiles: ['rules/healthcare/hipaa_privacy.arsl.toml', 'rules/healthcare/fda_samd.arsl.toml', 'rules/healthcare/cfr42_part2.arsl.toml'],
    ruleCount: 4,
    visual: (
      <div className="w-full flex flex-col gap-3">
        {[
          { label: 'HIPAA-PRI-001 · PHI Access Auth', result: 'PASS', ok: true },
          { label: 'HIPAA-MIN-001 · Minimum Necessary', result: 'PASS', ok: true },
          { label: 'FDA-SAMD-001 · AI Confidence ≥85%', result: 'PASS', ok: true },
          { label: 'CFR42-SUD-001 · SUD Consent', result: 'PASS', ok: true },
        ].map((r, i) => (
          <div key={i} className="bg-black border border-border p-3 rounded-lg flex justify-between items-center">
            <span className="font-mono text-xs text-white/50">{r.label}</span>
            <span className={`font-mono text-xs font-bold ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.result}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: <Plane className="text-accent w-6 h-6" />,
    title: 'Autonomous Aviation & Safety',
    problem: 'Autonomous UAV and autopilot systems require hard safety guardrails in software. FAA DO-178C mandates that safety-critical decisions (altitude, transponder status) cannot be overridden by AI without constraint.',
    enforcement: 'Two safety rules: minimum safe altitude enforcement (≥1,000ft per FAR §91.119) ensuring no waypoint drops below MSA, and transponder data integrity gate (§91.215) preventing unauthorized transponder deactivation.',
            outcome: 'Safety-critical decisions can be routed through hard pre-execution checks so altitude and transponder constraints are enforced in infrastructure rather than left to model behavior. Stronger assurance (TEE, ZK, formal methods) remains deployment-specific and outside the default signed-audit baseline.',
    ruleFiles: ['rules/aviation/faa_safety.arsl.toml'],
    ruleCount: 2,
    visual: (
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-black border-border">
          <CardHeader className="p-5">
            <CardTitle className="text-base text-white">Minimum Safe Altitude</CardTitle>
            <p className="text-white/50 text-xs mt-1">waypoint_altitude_ft ≥ 1,000</p>
            <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> FAA-MSA-001 PASS
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-black border-border">
          <CardHeader className="p-5">
            <CardTitle className="text-base text-white">Transponder Integrity</CardTitle>
            <p className="text-white/50 text-xs mt-1">transponder_active = true</p>
            <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> FAA-XPNDR-001 PASS
            </div>
          </CardHeader>
        </Card>
      </div>
    ),
  },
  {
    icon: <Zap className="text-accent w-6 h-6" />,
    title: 'Critical Infrastructure (Energy)',
    problem: 'NERC CIP mandates that all remote access to Bulk Electric System cyber assets is authenticated via MFA and routed through an intermediate system — violations carry up to $1M/day penalties.',
    enforcement: 'Two NERC CIP-005-7 rules: MFA verification for interactive remote access sessions (Part 2.2) and intermediate system traversal enforcement (Part 2.1) preventing direct access to BES Cyber Assets.',
    outcome: 'Utility operators hold signed evidence that every evaluated remote access session passed the required checks before the action path was released, improving traceability for NERC examinations.',
    ruleFiles: ['rules/energy/nerc_cip.arsl.toml'],
    ruleCount: 2,
    visual: (
      <div className="grid grid-cols-1 gap-3">
        <Card className="bg-black border-border">
          <CardHeader className="p-5">
            <CardTitle className="text-base text-white">Interactive Remote Access MFA</CardTitle>
            <p className="text-white/50 text-xs mt-1">interactive_access_mfa_verified = true</p>
            <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> NERC-CIP-005-1 PASS
            </div>
          </CardHeader>
        </Card>
        <Card className="bg-black border-border">
          <CardHeader className="p-5">
            <CardTitle className="text-base text-white">Intermediate System Traversal</CardTitle>
            <p className="text-white/50 text-xs mt-1">intermediate_system_used = true</p>
            <div className="mt-3 flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> NERC-CIP-005-2 PASS
            </div>
          </CardHeader>
        </Card>
      </div>
    ),
  },
  {
    icon: <Phone className="text-accent w-6 h-6" />,
    title: 'AI Voice Agent Compliance (Telecom)',
    problem: 'AI-powered telemarketing agents and automated dialers face $500–$1,500 per-call TCPA penalties for contacting numbers on the National Do Not Call Registry or without prior express written consent.',
    enforcement: 'Two TCPA rules: National Do Not Call Registry verification gate (§64.1200(c)) and prior express written consent requirement (§64.1200(a)(2)) for automated or prerecorded voice messages to mobile numbers.',
    outcome: 'Every outbound AI voice call can be gated by explicit consent and DNC checks before initiation, with signed evidence that the pre-call policy path executed.',
    ruleFiles: ['rules/telecom/tcpa_marketing.arsl.toml'],
    ruleCount: 2,
    visual: (
      <div className="w-full flex flex-col gap-3">
        <div className="bg-black border border-border p-3 rounded-lg flex justify-between items-center">
          <span className="font-mono text-xs text-white/50">TCPA-DNC-001 · Do Not Call Registry</span>
          <span className="font-mono text-xs font-bold text-green-400">PASS</span>
        </div>
        <div className="bg-black border border-border p-3 rounded-lg flex justify-between items-center">
          <span className="font-mono text-xs text-white/50">TCPA-CONSENT-001 · Express Written Consent</span>
          <span className="font-mono text-xs font-bold text-green-400">PASS</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded border border-green-500/20">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm">Outbound call authorized (0.8ms)</span>
        </div>
      </div>
    ),
  },
];

export default function UseCasesPage() {
  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-[8rem] pb-[4rem] border-b border-border/50 flex flex-col items-center justify-center overflow-hidden bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[1000px] mx-auto px-6 text-center relative z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Badge variant="outline" className="text-accent bg-surface-card border-border px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-bold">
              Deployment Scenarios
            </Badge>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-6 max-w-[900px] mx-auto"
          >
            Real Rules, Real Sectors
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-[800px] mx-auto mb-8"
          >
            Every use case below is backed by implemented ARSL rules in the `agf-sp1` codebase. They show where the formal kernel fits inside a broader governance stack: operators configure policy and oversight in the control plane, while the kernel enforces pre-execution decisions.
          </motion.p>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="py-12 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { metric: '48+', label: 'ARSL Rules' },
            { metric: '8', label: 'Sectors' },
            { metric: '<10ms', label: 'Kernel Target' },
            { metric: 'Signed', label: 'Audit Trail' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-surface-card border border-border p-6 rounded-xl text-center">
              <div className="text-3xl font-bold text-accent mb-2">{stat.metric}</div>
              <div className="text-sm font-semibold uppercase tracking-widest text-white/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 bg-black px-6">
        <div className="max-w-[1200px] mx-auto space-y-16">
          
          {useCases.map((uc, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <div className="w-full h-px bg-border/50" />}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                className={`flex flex-col ${idx % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-stretch gap-8`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                      {uc.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold text-white m-0">{uc.title}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[0.6rem] px-2 py-0.5 border-accent/30 text-accent">{uc.ruleCount} rules</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="prose prose-invert prose-p:text-white/60">
                    <p><strong>The Problem:</strong> {uc.problem}</p>
                    <p><strong>The Enforcement:</strong> {uc.enforcement}</p>
                    <p><strong>Outcome:</strong> {uc.outcome}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {uc.ruleFiles.map((f, fi) => (
                        <span key={fi} className="font-mono text-[0.65rem] text-white/30 bg-white/5 px-2 py-1 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 w-full relative flex items-center">
                  {uc.visual}
                </div>
              </motion.div>
            </React.Fragment>
          ))}

        </div>
      </section>

      {/* CTA Layer */}
      <section className="py-24 bg-surface px-6 border-t border-border/50">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">See the Framework in Action</h2>
          <p className="text-lg text-ink-secondary mb-10">
            The current rule library demonstrates how a formal kernel can govern real sectors today. Use it as the enforcement layer, then add approvals, identity, reporting, and broader integrations through the control plane.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Button size="lg" asChild className="bg-white text-black hover:bg-white/90 w-full sm:w-auto px-8">
              <Link to="/contact">Request Discussion</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-border hover:bg-surface-card w-full sm:w-auto px-8">
              <Link to="/architecture">Review Architecture</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
