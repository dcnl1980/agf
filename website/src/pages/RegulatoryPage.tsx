import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  Shield, FileText, Globe, Activity, EyeOff, Scale, Landmark, Heart, 
  Plane, Zap, Phone, Lock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import React from 'react';

/* ── Data derived from agf-sp1/rules/ codebase ── */

interface RegulationCard {
  icon: React.ReactNode;
  title: string;
  jurisdiction: string;
  subtitle: string;
  description: string;
  ruleCount: number;
  ruleIds: string[];
  status: 'implemented' | 'roadmap';
}

const sectors: { name: string; regulations: RegulationCard[] }[] = [
  {
    name: 'Finance',
    regulations: [
      {
        icon: <FileText className="w-7 h-7 text-accent" />,
        title: 'FCA Consumer Duty / CRR',
        jurisdiction: 'UK',
        subtitle: 'Capital Adequacy & Prudential',
        description: 'Ten rules enforcing capital ratio (≥8%), LCR (≥100%), leverage (≥3%), NSFR, large exposure limits (≤25%), solvency, Tier 1 capital, counter-cyclical buffer, stressed capital, and DORA ICT incident reporting (≤4h).',
        ruleCount: 10,
        ruleIds: ['FCA-CD-001 → 009', 'DORA-ICT-001'],
        status: 'implemented',
      },
      {
        icon: <Globe className="w-7 h-7 text-accent" />,
        title: 'KYC Standard Onboarding',
        jurisdiction: 'UK',
        subtitle: 'MLR 2017 / FCA SYSC 6.3',
        description: 'Six-rule eligibility gate: minimum age (≥18), AML risk score (≤24), government ID verification, FATF high-risk jurisdiction exclusion, PEP status check, and HMT/OFAC sanctions name matching.',
        ruleCount: 6,
        ruleIds: ['KYC-AGE-001', 'KYC-AML-001', 'KYC-IDV-001', 'KYC-JUR-001', 'KYC-PEP-001', 'KYC-SAN-001'],
        status: 'implemented',
      },
      {
        icon: <Shield className="w-7 h-7 text-accent" />,
        title: 'HMT Financial Sanctions',
        jurisdiction: 'UK',
        subtitle: 'SAMLA 2018',
        description: 'Five sanctions screening rules: counterparty and UBO jurisdiction checks against the HMT consolidated list, sanctioned currency denomination gate, OFAC SDN name-match, and large transaction (>£10k) EDD trigger.',
        ruleCount: 5,
        ruleIds: ['HMT-SAN-001 → 003', 'OFAC-SDN-001', 'HMT-SAN-005'],
        status: 'implemented',
      },
      {
        icon: <Activity className="w-7 h-7 text-accent" />,
        title: 'MiFID II',
        jurisdiction: 'EU',
        subtitle: 'Directive 2014/65/EU',
        description: 'Algorithmic trading governance: order-to-trade ratio cap (≤100:1 per RTS 9) and circuit breaker price band gate (≤5% deviation per Article 48(5)).',
        ruleCount: 2,
        ruleIds: ['MIFID2-OTR-001', 'MIFID2-CB-001'],
        status: 'implemented',
      },
      {
        icon: <Lock className="w-7 h-7 text-accent" />,
        title: 'PSD2 SCA',
        jurisdiction: 'EU',
        subtitle: 'Directive (EU) 2015/2366',
        description: 'Strong Customer Authentication gate enforcing multi-factor authentication for electronic payment transactions per Article 97(1)(b).',
        ruleCount: 1,
        ruleIds: ['PSD2-SCA-001'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Cross-Industry',
    regulations: [
      {
        icon: <EyeOff className="w-7 h-7 text-accent" />,
        title: 'GDPR / EU AI Act',
        jurisdiction: 'EU',
        subtitle: 'GDPR 2016/679 + AI Act 2024/1689',
        description: 'Five consent and data protection rules: explicit Article 6(1)(a) consent, special category consent (Art. 9), right to erasure gate (Art. 17), data retention period enforcement (≤730 days), and EU AI Act Article 5 prohibited practice gate.',
        ruleCount: 5,
        ruleIds: ['GDPR-CON-001 → 002', 'GDPR-ERA-001', 'GDPR-RET-001', 'EUAI-ART5-001'],
        status: 'implemented',
      },
      {
        icon: <Scale className="w-7 h-7 text-accent" />,
        title: 'CCPA / CPRA',
        jurisdiction: 'US-CA',
        subtitle: 'Cal. Civ. Code § 1798.100',
        description: '"Do Not Sell" opt-out enforcement gate — blocks the sale or sharing of consumer personal information when the consumer has exercised their opt-out right under Section 1798.120(a).',
        ruleCount: 1,
        ruleIds: ['CCPA-DNS-001'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Healthcare',
    regulations: [
      {
        icon: <Heart className="w-7 h-7 text-accent" />,
        title: 'HIPAA Privacy Rule',
        jurisdiction: 'US',
        subtitle: '45 CFR Part 164',
        description: 'PHI access authorization gate (§164.502(a)) ensuring entities have authorized access before touching protected health information, plus the Minimum Necessary Standard (§164.502(b)) limiting PHI scope.',
        ruleCount: 2,
        ruleIds: ['HIPAA-PRI-001', 'HIPAA-MIN-001'],
        status: 'implemented',
      },
      {
        icon: <Heart className="w-7 h-7 text-accent" />,
        title: 'FDA SaMD Framework',
        jurisdiction: 'US',
        subtitle: '21 CFR Part 820',
        description: 'Algorithm confidence threshold gate for diagnostic AI models — requires ≥85% clinical confidence score before outputting a recommendation per IMDRF SaMD N41 Section 6.2.',
        ruleCount: 1,
        ruleIds: ['FDA-SAMD-001'],
        status: 'implemented',
      },
      {
        icon: <Heart className="w-7 h-7 text-accent" />,
        title: '42 CFR Part 2',
        jurisdiction: 'US',
        subtitle: 'SUD Record Confidentiality',
        description: 'Substance use disorder record disclosure consent gate — requires explicit written consent before any disclosure of SUD treatment records per §2.31.',
        ruleCount: 1,
        ruleIds: ['CFR42-SUD-001'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Government & Security',
    regulations: [
      {
        icon: <Landmark className="w-7 h-7 text-accent" />,
        title: 'FedRAMP',
        jurisdiction: 'US',
        subtitle: 'NIST SP 800-53',
        description: 'FIPS 140-2 validated encryption gate (SC-13) — ensures information systems implement FIPS-validated cryptographic modules for protecting confidentiality and integrity.',
        ruleCount: 1,
        ruleIds: ['FEDRAMP-SC-013'],
        status: 'implemented',
      },
      {
        icon: <Landmark className="w-7 h-7 text-accent" />,
        title: 'NIST SP 800-171 Rev. 3',
        jurisdiction: 'US',
        subtitle: 'DFARS 252.204-7012',
        description: 'CUI access control gate verifying security clearance (3.1.1) and session lock timeout enforcement (≤15 min inactivity) for defense contractor systems.',
        ruleCount: 2,
        ruleIds: ['NIST-AC-001', 'NIST-AC-002'],
        status: 'implemented',
      },
      {
        icon: <Landmark className="w-7 h-7 text-accent" />,
        title: 'ISO/IEC 27001:2022',
        jurisdiction: 'Global',
        subtitle: 'Annex A Access Control',
        description: 'Access control policy gate (A.5.15) — enforces that access to information and application function is restricted per the documented access control policy.',
        ruleCount: 1,
        ruleIds: ['ISO27001-A9-001'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Insurance',
    regulations: [
      {
        icon: <Shield className="w-7 h-7 text-accent" />,
        title: 'Solvency II',
        jurisdiction: 'EU',
        subtitle: 'Directive 2009/138/EC',
        description: 'Two capital adequacy gates: SCR ratio (≥100% per Article 100) ensuring eligible own funds cover the Solvency Capital Requirement, and MCR baseline (≥100% per Article 128).',
        ruleCount: 2,
        ruleIds: ['SOLVII-SCR-001', 'SOLVII-MCR-001'],
        status: 'implemented',
      },
      {
        icon: <Shield className="w-7 h-7 text-accent" />,
        title: 'IDD',
        jurisdiction: 'EU',
        subtitle: 'Directive (EU) 2016/97',
        description: 'Product governance: target market alignment verification (Art. 25(1)) and demands-and-needs test (Art. 20(1)) ensuring insurance products match customer profiles.',
        ruleCount: 2,
        ruleIds: ['IDD-POG-001', 'IDD-DNT-001'],
        status: 'implemented',
      },
      {
        icon: <Shield className="w-7 h-7 text-accent" />,
        title: 'NAIC MDL-668',
        jurisdiction: 'US',
        subtitle: 'Insurance Data Security',
        description: 'Two cybersecurity controls: encryption of nonpublic information at rest (Section 4(D)(2)(h)) and multi-factor authentication for nonpublic information access (Section 4(D)(2)(g)).',
        ruleCount: 2,
        ruleIds: ['NAIC-SEC-001', 'NAIC-SEC-002'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Aviation',
    regulations: [
      {
        icon: <Plane className="w-7 h-7 text-accent" />,
        title: 'FAA DO-178C',
        jurisdiction: 'US',
        subtitle: 'RTCA DO-178C / FAR Part 91',
        description: 'Autonomous navigation guardrails: minimum safe altitude enforcement (≥1,000ft per §91.119) and transponder data integrity gate (§91.215) preventing unauthorized deactivation.',
        ruleCount: 2,
        ruleIds: ['FAA-MSA-001', 'FAA-XPNDR-001'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Energy',
    regulations: [
      {
        icon: <Zap className="w-7 h-7 text-accent" />,
        title: 'NERC CIP-005-7',
        jurisdiction: 'North America',
        subtitle: 'Critical Infrastructure Protection',
        description: 'Two cyber security rules: MFA for interactive remote access to critical cyber assets (Part 2.2) and intermediate system traversal enforcement (Part 2.1) preventing direct BES Cyber Asset access.',
        ruleCount: 2,
        ruleIds: ['NERC-CIP-005-1', 'NERC-CIP-005-2'],
        status: 'implemented',
      },
    ],
  },
  {
    name: 'Telecom',
    regulations: [
      {
        icon: <Phone className="w-7 h-7 text-accent" />,
        title: 'TCPA',
        jurisdiction: 'US',
        subtitle: '47 U.S.C. § 227',
        description: 'AI voice agent marketing controls: National Do Not Call Registry verification gate (§64.1200(c)) blocking solicitation to registered numbers, and prior express written consent requirement for automated dialing (§64.1200(a)(2)).',
        ruleCount: 2,
        ruleIds: ['TCPA-DNC-001', 'TCPA-CONSENT-001'],
        status: 'implemented',
      },
    ],
  },
];

const totalRules = sectors.reduce((acc, s) => acc + s.regulations.reduce((a, r) => a + r.ruleCount, 0), 0);
const totalRegulations = sectors.reduce((acc, s) => acc + s.regulations.length, 0);

export default function RegulatoryPage() {
  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-[8rem] pb-[4rem] border-b border-border-light/20 flex flex-col items-center justify-center overflow-hidden bg-black">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[1200px] mx-auto px-6 text-center relative z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <Badge variant="outline" className="text-accent bg-surface-card border-border px-4 py-1.5 rounded-full uppercase tracking-widest text-xs font-bold">
              Infrastructure Enforcement
            </Badge>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-6 max-w-[900px] mx-auto"
          >
            The Agentic Compliance Matrix
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-[700px] mx-auto mb-8"
          >
            Regulatory text becomes executable policy for the enforcement kernel — the deterministic path teams can audit — while the control plane maps those rules to ownership, approvals, and reporting. Every rule below is represented in the current codebase; production assurance still depends on correct formalization, source data quality, and deployment posture.
          </motion.p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-10 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { metric: String(totalRules), label: 'ARSL Rules' },
            { metric: String(totalRegulations), label: 'Regulations' },
            { metric: String(sectors.length), label: 'Sectors' },
            { metric: '19', label: 'Conformance Tests' },
          ].map((stat, idx) => (
            <div key={idx} className="bg-surface-card border border-border p-6 rounded-xl text-center">
              <div className="text-3xl font-bold text-accent mb-2">{stat.metric}</div>
              <div className="text-sm font-semibold uppercase tracking-widest text-white/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Live Governance Visualizer */}
      <section className="py-20 bg-surface px-6 border-b border-border/50">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-4">No-Bypass Architecture</h2>
            <p className="text-lg text-ink-secondary mb-6">
              In the target architecture, high-risk agent actions should not directly modify clinical, financial, or government systems. They are routed through policy evaluation first, then either allowed, blocked, or escalated for review.
            </p>
            <ul className="space-y-4 text-ink-secondary border-l border-border pl-4">
              <li><strong className="text-white">Request Context:</strong> Analyzing incoming data payload.</li>
              <li><strong className="text-white">Policy Check:</strong> Correlating payload to sector-specific rules (e.g. HIPAA, MiFID II, NERC CIP).</li>
                <li><strong className="text-white">Crypto Signature:</strong> Emitting signed audit artifacts bound to the evaluated result and its position in the audit chain.</li>
            </ul>
          </div>
          
          <div className="flex-1 w-full relative">
            <div className="bg-[#0D0D12] border border-border p-6 rounded-xl font-mono text-xs text-white/70 shadow-2xl overflow-hidden h-[300px] flex flex-col">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-4 text-white/40 uppercase tracking-widest text-[0.65rem]">agf-runtime-v1.0.2</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 opacity-90 pr-2 custom-scrollbar">
                <div className="flex gap-4"><span className="text-green-400">09:41:03</span><span>[INFO] Received intent: <span className="text-white">initiate_transfer</span></span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:03</span><span>[EVAL] Loading rule files: <span className="text-cyan-400">KYC + HMT + FCA</span></span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:03</span><span>[CHECK] Rule <span className="text-purple-400">KYC-AGE-001</span>: PASSED</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:03</span><span>[CHECK] Rule <span className="text-purple-400">KYC-PEP-001</span>: PASSED</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:04</span><span>[CHECK] Rule <span className="text-purple-400">HMT-SAN-001</span>: PASSED</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:04</span><span>[CHECK] Rule <span className="text-purple-400">FCA-CD-001</span>: PASSED</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:04</span><span>[EVAL] Result: <span className="text-green-500 bg-green-500/10 px-1">COMPLIANT — 26/26 PASS</span></span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:05</span><span className="text-blue-400">[ATTEST] Generating Blake3 Hash...</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:05</span><span className="text-white/40">Hash: 8a92b3c4...d91</span></div>
                <div className="flex gap-4"><span className="text-green-400">09:41:05</span><span className="text-yellow-400">[FWD] Payload released to downstream systems.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance Grid — by Sector */}
      {sectors.map((sector, sectorIdx) => (
        <section key={sectorIdx} className={`py-20 px-6 ${sectorIdx % 2 === 0 ? 'bg-black' : 'bg-surface'}`}>
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-center gap-4 mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">{sector.name}</h2>
              <Badge variant="outline" className="text-white/60 border-border uppercase tracking-widest text-xs">
                {sector.regulations.reduce((a, r) => a + r.ruleCount, 0)} rules
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sector.regulations.map((reg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={`bg-surface-card border-border hover:border-white/20 transition-colors h-full ${reg.status === 'roadmap' ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between mb-3">
                        {reg.icon}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5 border-border text-white/50">{reg.jurisdiction}</Badge>
                          {reg.status === 'implemented' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-roadmap-text" />
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg leading-snug">{reg.title}</CardTitle>
                      <p className="text-ink-secondary mt-1 text-sm">{reg.subtitle}</p>
                    </CardHeader>
                    <CardContent className="text-sm text-ink-secondary leading-relaxed space-y-3">
                      <p>{reg.description}</p>
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <span className="text-accent font-bold text-xs">{reg.ruleCount} {reg.ruleCount === 1 ? 'rule' : 'rules'}</span>
                        <span className="text-white/30 text-xs">·</span>
                        <span className="font-mono text-[0.65rem] text-white/40 truncate">{reg.ruleIds.join(', ')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Disclaimers & Action */}
      <section className="py-16 bg-surface px-6 border-t border-border/50">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex-1 max-w-[700px]">
             <div className="border border-caution-border bg-caution-bg/20 p-5 rounded-lg flex items-start gap-4">
               <Shield className="w-6 h-6 text-caution-text shrink-0 mt-1" />
               <div>
                 <h4 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">Important Disclaimer</h4>
                 <p className="text-sm text-ink-secondary m-0">
                   The mappings above are engineering assessments of capability, not legal conclusions. The rules are implemented as executable policy artifacts, but regulatory compliance still requires supervisory interpretation, legal review, and reliable source data. Prototype SP1 proving does not mean every production deployment uses ZK in the hot path.
                 </p>
               </div>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}
