import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Cpu, MoveRight, Layers, FileText, CheckCircle2, Check, Minus, LayoutDashboard, Plug } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import Marquee from '../components/ui/marquee';

export default function HomePage() {
  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      
      {/* Announcement Bar */}
      <div className="w-full bg-accent text-white text-center py-2 text-sm font-medium tracking-wide flex items-center justify-center gap-2 flex-wrap px-4">
        <span>Unified AI governance: operator control plane plus formal compliance kernel.</span>
        <Link to="/research" className="underline hover:text-white/80 transition-colors">Read the Whitepaper &rarr;</Link>
      </div>

      {/* Hero */}
      <section className="relative pt-[8rem] pb-[6rem] text-center bg-black border-b border-border-light/20 flex flex-col items-center justify-center overflow-hidden">
        {/* Subtle background glow effect imitating infrastructure node */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 mb-8 bg-surface-card px-4 py-1.5 rounded-full border border-border"
          >
            <Shield className="w-4 h-4 text-accent" />
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-white/70">
              Unified AI Governance Infrastructure
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-[1000px] mx-auto mb-6 text-4xl md:text-6xl lg:text-7xl leading-[1.1] text-white font-medium tracking-tight"
          >
            AI Governance Control Plane <br/>
            <span className="italic font-serif font-normal text-white/90">with a Formal Compliance Kernel.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 max-w-[720px] mx-auto mb-12 leading-relaxed"
          >
            An Agentic AI Trust Platform that lets enterprises register, govern, approve, and audit AI agents, with AGF as the deterministic enforcement kernel that decides what agents are allowed to do before execution. Every decision lands in a tamper-evident, signed audit chain.
          </motion.p>
          
          {/* Quick Stats Bar (Nextvise Style) */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-12 mb-12 text-left max-w-[900px] w-full"
          >
            <div className="flex-1 md:border-l md:border-white/10 md:pl-6 text-center md:text-left">
              <div className="text-2xl font-bold text-white mb-1">100%</div>
              <div className="text-sm font-medium text-white/80 mb-1">Deterministic Verdicts</div>
              <div className="text-xs text-white/50 leading-relaxed max-w-[200px] mx-auto md:mx-0">Same action context plus same ruleset yields the same kernel decision every time.</div>
            </div>
            <div className="flex-1 md:border-l md:border-white/10 md:pl-6 text-center md:text-left">
              <div className="text-2xl font-bold text-white mb-1">Zero</div>
              <div className="text-sm font-medium text-white/80 mb-1">Data Egress</div>
              <div className="text-xs text-white/50 leading-relaxed max-w-[200px] mx-auto md:mx-0">The evaluator makes no outbound calls while judging; stronger confidentiality comes from deployment posture and future TEE upgrades.</div>
            </div>
            <div className="flex-1 md:border-l md:border-white/10 md:pl-6 text-center md:text-left">
              <div className="text-2xl font-bold text-white mb-1">Signed</div>
              <div className="text-sm font-medium text-white/80 mb-1">Audit Chain</div>
              <div className="text-xs text-white/50 leading-relaxed max-w-[200px] mx-auto md:mx-0">Hash-chained and signed verdict records for independent verification and audit export.</div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Button asChild className="bg-white text-black hover:bg-white/90 rounded-md px-8 h-12 font-medium">
              <Link to="/contact">Request Briefing</Link>
            </Button>
            <Button asChild className="bg-black border border-white/20 text-white hover:bg-white/10 rounded-md px-8 h-12 font-medium transition-colors">
              <Link to="/research" className="flex items-center gap-2">Explore Infrastructure <MoveRight className="w-4 h-4" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Compliance Marquee */}
      <section className="border-b border-border-light/10 bg-black/50 py-6 overflow-hidden flex flex-col items-center">
        <p className="text-xs uppercase tracking-widest text-ink-muted mb-6 font-bold">Trusted Infrastructure For Enforcing</p>
        <Marquee className="max-w-[1200px] w-full" repeat={6} style={{ "--duration": "30s" } as any}>
          <div className="flex justify-around items-center gap-16 px-8 text-xl font-heading font-black text-white/30 whitespace-nowrap">
            <span>HIPAA</span>
            <span>EU AI ACT</span>
            <span>GDPR</span>
            <span>FEDRAMP</span>
            <span>NIST 800-171</span>
            <span>KYC / AML</span>
            <span>ISO 27001</span>
          </div>
        </Marquee>
      </section>

      {/* Feature Grid: Problem Space & Solutions */}
      <section className="py-24 bg-surface px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center md:text-left max-w-[800px] mb-16">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              Formal rules first. Operator-friendly control on top. <br/>
              <span className="text-accent-light text-accent">No bypass through the model.</span>
            </h2>
            <p className="text-lg text-ink-secondary">
              The Agentic Governance Framework (AGF) pairs a pre-execution enforcement kernel with a management layer you would expect from a modern AI trust platform: dashboards, approvals, identities, and SDK-style hooks. Trust scores and workflows inform policy context — they do not replace deterministic PASS/BLOCK/HITL decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Policy Firewall (Kernel)",
                desc: "Every proposed agent action is evaluated off-model before it runs. Integer-safe rules (ARSL today; OPA/Rego-compatible paths for adoption) yield reproducible outcomes — no probabilistic veto."
              },
              {
                icon: LayoutDashboard,
                title: "Governance Control Plane",
                desc: "Register agents, coordinate teams and roles, manage identities, tune risk profiles, route human approvals, and export evidence for auditors — separate from evaluation so operators cannot silently change verdict math."
              },
              {
                icon: FileText,
                title: "Policy-as-Code",
                desc: "Regulations and internal policy become versioned, reviewable artifacts. Start with pragmatic policy DSLs; graduate to stricter formalization where jurisdictions demand it."
              },
              {
                icon: Lock,
                title: "Zero Trust Execution",
                desc: "Evaluations run in isolated Kata QEMU micro-VMs. In the hardened gpu-scoped profile, outbound network access is fail-closed during evaluation so the kernel cannot phone home while judging an action."
              },
              {
                icon: Layers,
                title: "Attested Audit Trail",
                desc: "Blake3 hash chaining plus Ed25519 signatures bind verdicts, rulesets, and ordering. Session-level attestations can be verified independently of your application database."
              },
              {
                icon: Plug,
                title: "Integration Layer",
                desc: "Meet agents where they run: APIs and SDK-style adapters for orchestrators and frameworks (e.g. Temporal first, additional stacks on the roadmap) without rewriting core agent logic."
              }
            ].map((feat, idx) => (
              <div key={idx} className="bg-surface-card border border-border p-8 rounded-2xl hover:border-white/20 transition-colors group">
                <feat.icon className="w-8 h-8 text-accent mb-6 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                <p className="text-ink-secondary leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Visual Component (Nextvise white-background style) */}
      <section className="py-24 bg-white text-black px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-16 items-center">
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-black">
              Five Steps.<br/>
              One Defensible Record.
            </h2>
            <p className="text-lg text-black/70 mb-8 max-w-[500px]">
              Control plane staff configure rules, identities, and workflows. The enforcement kernel alone executes evaluation — producing an unbroken chain of custody from rule version to signed verdict, including explicit ALLOW, BLOCK, or HITL paths.
            </p>
            <ol className="relative border-l border-black/10 ml-4 space-y-8">
              {[
                { title: 'Rule Definition (ARSL / policy-as-code)', desc: 'Regulations and enterprise policy authored in strict, reviewable artifacts.' },
                { title: 'Compilation', desc: 'Rules and action context compiled into a type-safe ComplianceBatch.' },
                { title: 'Deterministic Evaluation', desc: 'Pure functions emit PASS/BLOCK/HITL with identical results on any platform.' },
                { title: 'Cryptographic Audit', hash: 'Blake3 + Ed25519', desc: 'Each verdict is hash-chained and signed; optional ZK proving remains a roadmap path for offline assurance.' },
                { title: 'Isolated Execution', desc: 'Sealed boundary on your Kubernetes infrastructure — with a validated gpu-scoped profile that blocks outbound network access during evaluation.' },
              ].map((step, idx) => (
                <li key={idx} className="pl-8 relative">
                  <div className="absolute w-6 h-6 bg-accent rounded-full -left-3 top-0 border-4 border-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                  <h4 className="text-lg font-bold text-black mb-1 flex items-center gap-3">
                    {step.title}
                    {step.hash && <span className="bg-black/5 text-black/60 text-xs px-2 py-0.5 rounded font-mono border border-black/10">{step.hash}</span>}
                  </h4>
                  <p className="text-black/60 m-0">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
          
          <div className="flex-1 w-full relative">
            <div className="aspect-square w-full max-w-[500px] mx-auto bg-black/5 rounded-3xl border border-black/10 flex items-center justify-center p-8 relative overflow-hidden">
             {/* Mock visual interface for the pipeline */}
             <div className="w-full flex flex-col gap-4 z-10">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-black/5 flex items-center gap-4">
                  <Cpu className="text-accent w-6 h-6" />
                  <div>
                    <div className="text-sm font-bold">Rule Evaluation</div>
                    <div className="text-xs text-black/50">Execution completed in 2.7ms</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-black/5 flex items-center gap-4">
                  <Layers className="text-accent w-6 h-6" />
                  <div>
                    <div className="text-sm font-bold">Runtime Posture</div>
                    <div className="text-xs text-black/50">Kata VM isolation confirmed for the active profile</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-black/5 flex flex-col gap-2 relative">
                  <div className="flex items-center gap-4">
                    <Lock className="text-accent w-6 h-6" />
                    <div>
                      <div className="text-sm font-bold">Cryptographic Chain</div>
                      <div className="text-[0.65rem] text-black/40 font-mono mt-1 w-48 truncate">
                        e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                      </div>
                    </div>
                  </div>
                </div>
             </div>
             
             {/* Abstract background shapes */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-accent/5 blur-3xl pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* The AGF Standard Matrix (NextVise comparison style) */}
      <section className="py-24 bg-surface px-6 border-t border-border/50">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">The Engineering Difference</h2>
            <p className="text-ink-secondary text-lg max-w-[600px] mx-auto">
              How a unified governance stack — formal kernel plus operator control plane — compares to prompt-only guardrails and legacy GRC dashboards.
            </p>
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden flex flex-col gap-4">
            {[
              { label: "Primary enforcement", agf: "Deterministic rules (pre-execution)", standard: "Scores / prompts (probabilistic)" },
              { label: "Operator experience", agf: "Dashboards, HITL, identities, SDK hooks", standard: "Tickets, spreadsheets, manual gates" },
              { label: "Evaluation engine", agf: "Pure Rust evaluator (ARSL; OPA path for adoption)", standard: "System prompts / ad-hoc scripts" },
              { label: "Audit trail", agf: "Hash-chained, signed immutable log", standard: "Mutable DB logs" },
              { label: "Isolation environment", agf: "Kata Micro-VM (Zero-Egress)", standard: "Shared container / open APIs" },
              { label: "Decision latency", agf: "< 6ms kernel eval (ZK off hot path)", standard: "Seconds / inconsistent review" },
              { label: "What cryptography proves", agf: "Integrity of verdict process & ordering", standard: "Often no independent proof" },
            ].map((feature, idx) => (
              <div key={idx} className="bg-surface-card border border-border p-5 rounded-xl shadow-lg">
                <h4 className="font-bold text-white mb-4 border-b border-border/50 pb-3">{feature.label}</h4>
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[0.65rem] font-bold text-accent uppercase tracking-widest block mb-1">Unified AGF Stack</span>
                    <div className="flex items-center gap-2 text-white text-sm"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> {feature.agf}</div>
                  </div>
                  <div>
                    <span className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest block mb-1">Prompts / Legacy GRC</span>
                    <div className="flex items-center gap-2 text-white/60 text-sm"><Minus className="w-4 h-4 opacity-50" /> {feature.standard}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:block border border-border rounded-2xl overflow-hidden bg-black/20 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="w-1/3 p-6 bg-surface-card border-b border-r border-border text-white/50 font-semibold text-sm">
                      {/* Empty top-left */}
                    </th>
                    <th className="w-1/3 p-6 bg-accent text-white border-b border-border font-bold text-base shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)]">
                      Unified AGF Stack
                    </th>
                    <th className="w-1/3 p-6 bg-surface-card border-b border-l border-border text-white/50 font-semibold text-sm">
                      Prompts / Legacy GRC
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Primary enforcement</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Deterministic rules (pre-execution)</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Scores / prompts (probabilistic)</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Operator experience</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Dashboards, HITL, identities, SDK hooks</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Tickets, spreadsheets, manual gates</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Evaluation engine</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Pure Rust (ARSL; OPA path for adoption)</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> System prompts / ad-hoc scripts</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Audit trail</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Hash-chained, signed immutable log</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Mutable DB logs</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Isolation environment</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Kata Micro-VM (Zero-Egress)</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Shared container / open APIs</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">Decision latency</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> &lt; 6ms kernel eval (ZK off hot path)</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Seconds / inconsistent review</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group">
                    <td className="p-6 font-medium text-white/90 border-r border-border bg-surface-card group-hover:bg-transparent transition-colors">What cryptography proves</td>
                    <td className="p-6 text-white align-middle">
                      <span className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" strokeWidth={3} /> Integrity of verdict process &amp; ordering</span>
                    </td>
                    <td className="p-6 text-white/50 border-l border-border align-middle">
                      <span className="flex items-center gap-2"><Minus className="w-4 h-4 opacity-50" /> Often no independent proof</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ / Limitations as Questions */}
      <section className="py-24 bg-surface px-6 border-t border-border/50">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Governance FAQ</h2>
            <p className="text-ink-secondary text-lg">Clear answers on our enterprise architecture, capabilities, and strict enforcement boundaries.</p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "What does AGF determinism guarantee?",
                a: "The enforcement kernel guarantees that a specific structured action context, evaluated against a specific versioned ruleset, always yields the same PASS/BLOCK/HITL outcome on any platform. Integer-safe arithmetic and zero external I/O during evaluation make the verdict reproducible — trust scores and UI state never override that math."
              },
              {
                q: "How do trust scores relate to deterministic rules?",
                a: "Trust and risk signals are inputs and orchestration cues: they help prioritize review, tune thresholds, and route approvals. They are not a substitute for formal allow/deny logic. High-risk actions still require explicit rule outcomes (and often human approval) rather than a probabilistic score alone."
              },
              {
                q: "Does AGF automatically make me legally compliant?",
                a: "No. AGF provides the cryptographic infrastructure and deterministic evaluation layer to prove what your system did at a specific time. Legal compliance depends on the accuracy of rule formalization and interpretation by your local regulatory supervisors."
              },
              {
                q: "Why use Kata Containers + QEMU instead of standard Docker?",
                a: "Standard containers share a kernel with the host OS, which expands the blast radius of a workload compromise. Kata Containers run each evaluation inside a lightweight VM boundary and pair that with zero network egress during evaluation. This materially improves isolation, but it is not the same as a hardware TEE with memory confidentiality."
              },
              {
                q: "Is AGF considered a Zero-Knowledge Proof (ZKP) system?",
                a: "In our default production posture, no. We use a deterministic evaluator and Ed25519 signing on a hash-chained audit log. ZK proving has been demonstrated on SP1 zkVM (conformance prototypes only) and may suit specific high-assurance, off-hot-path or batch workflows — see the whitepaper, Verification page, and Limitations for scope and latency."
              },
              {
                q: "What is the implementation time?",
                a: "Kubernetes-native deployment and SDK-style adapters let teams start with a focused policy pack and one integration (for example Temporal) in days, then expand frameworks and control-plane features as adoption grows — rather than multi-quarter rewrites."
              }
            ].map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
                <AccordionTrigger className="text-left text-lg font-medium hover:text-accent hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-ink-secondary text-base leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-black border-t border-border/50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        <div className="max-w-[800px] mx-auto text-center px-6 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Stop guess-work. Enforce it.</h2>
          <p className="text-xl text-ink-secondary mb-10 max-w-[600px] mx-auto">
            Bring mathematical certainty to your compliance pipeline. Contact our implementation engineering team to build a No-Bypass architecture.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="bg-white text-black hover:bg-white/90 w-full sm:w-auto px-8 h-12 text-base font-semibold">
              <Link to="/contact">Request Technical Briefing</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-border hover:bg-surface-card w-full sm:w-auto px-8 h-12 text-base font-semibold">
              <Link to="/architecture">View Documentation</Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
