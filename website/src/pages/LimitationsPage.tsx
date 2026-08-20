import { Link } from 'react-router-dom';
import { SectionWrapper } from '../components/layout/SectionWrapper';

export default function LimitationsPage() {
  return (
    <div className="flex flex-col">
      <SectionWrapper id="limitations-header">
        <div className="reading-width">
          <h1>Limitations &amp; Risks</h1>
          <p className="text-xl text-ink-secondary">A complete account of the constraints, assumptions, and open questions that bound AGF's applicability. This page is mandatory reading for anyone evaluating or relying on the framework.</p>
        </div>
      </SectionWrapper>

      {/* Data Integrity */}
      <SectionWrapper id="data-integrity" altTheme>
        <div className="reading-width">
          <h2>1. Data Integrity</h2>
          <p>AGF evaluates data as provided. If input data is incorrect, incomplete, fabricated, or stale, the evaluation result will be correspondingly unreliable — regardless of the cryptographic integrity of the audit trail.</p>

          <div className="border border-caution-border bg-[#fff8e6] p-5 md:p-6 rounded-xl my-6">
            <span className="block font-heading font-bold text-xs uppercase tracking-[0.1em] mb-4 text-[#a97b00]">Key Principle</span>
            <p className="text-caution-text mb-0"><strong className="text-caution-text">A cryptographically signed incorrect result is still incorrect.</strong> Upstream data-quality controls, source-of-truth validation, and data-lineage tracking are necessary complements that AGF does not provide.</p>
          </div>
        </div>
      </SectionWrapper>

      {/* Rule Formalization */}
      <SectionWrapper id="formalization-risk">
        <div className="reading-width">
          <h2>2. Rule Formalization Risk</h2>
          <p>The translation from natural-language regulation to ARSL rules is an interpretive act performed by engineers and subject-matter experts. This translation may introduce errors, omissions, or oversimplifications.</p>
          <ul className="list-disc pl-6 space-y-2 mt-4 mb-6 text-ink-secondary">
            <li>Different firms or jurisdictions may interpret the same regulation differently.</li>
            <li>Regulatory text may contain ambiguities, exceptions, or judgment-dependent qualifications that cannot be captured by the current ARSL condition types.</li>
            <li>A threshold expressed in basis points may not account for transitional provisions or supervisory buffers.</li>
            <li>Boolean conditions may oversimplify requirements that have exceptions or qualifications in the source regulation.</li>
          </ul>
          <p>Legal review of rule definitions and formal change-control processes are essential for the credibility of ARSL-based evaluation.</p>
        </div>
      </SectionWrapper>

      {/* Jurisdictional Interpretation */}
      <SectionWrapper id="jurisdictional" altTheme>
        <div className="reading-width">
          <h2>3. Jurisdictional Interpretation</h2>
          <p className="mb-4">The prototype rules reference UK (FCA, HMT), EU (ECB, ESMA, ICO), and US (OFAC) regulations. Regulatory requirements are not static: thresholds change, new rules are introduced, and supervisory expectations evolve through guidance and enforcement actions.</p>
          <p>A production system requires continuous monitoring of regulatory updates and timely revision of ARSL rule files — a significant operational obligation.</p>
        </div>
      </SectionWrapper>

      {/* Key Management */}
      <SectionWrapper id="key-management">
        <div className="reading-width">
          <h2>4. Key Management</h2>
          <p>The security of the Ed25519 signing model depends entirely on the confidentiality and integrity of the private key. The current prototype has known limitations:</p>
          <ul className="list-disc pl-6 space-y-3 mt-4 mb-6 text-ink-secondary">
            <li><strong className="text-ink">Key storage.</strong> The prototype loads the key from an environment variable provisioned as a Kubernetes Secret. Kubernetes Secrets are base64-encoded, not encrypted at rest by default.</li>
            <li><strong className="text-ink">No rotation mechanism.</strong> Rotating the key requires manual reprovisioning.</li>
            <li><strong className="text-ink">No revocation protocol.</strong> If the key is compromised, previously signed results cannot be distinguished from fraudulently signed ones without additional context.</li>
          </ul>
          <p>A production deployment should use a hardware security module (HSM) or cloud KMS for key storage, implement automated key rotation, and publish key-validity periods alongside signatures.</p>
        </div>
      </SectionWrapper>

      {/* TEE Limitations */}
      <SectionWrapper id="tee-limitations" altTheme>
        <div className="reading-width">
          <h2>5. TEE and Attestation Limitations</h2>
          <p className="mb-4">The current system uses Kata Containers for VM-level isolation but does not include hardware-based attestation. The strongest live deployment proof today is a gpu-scoped Kata profile with pod-local fail-closed egress; the TEE attestation report in the current implementation is still a <em>stub</em> rather than a hardware-rooted measurement.</p>
          <p>Without AMD SEV-SNP, Intel TDX, or equivalent technology, the system does not provide guarantees against a malicious host operator or compromised hypervisor. The threat model therefore still assumes a trusted cluster administrator and infrastructure operator.</p>
        </div>
      </SectionWrapper>

      {/* ZK Limitations */}
      <SectionWrapper id="zk-maturity">
        <div className="reading-width">
          <h2>6. Zero-Knowledge Proof Maturity</h2>
          <p>ZK proving has been demonstrated on SP1 zkVM but is not deployed in the production evaluation pipeline. Key constraints:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-ink-secondary">
            <li><strong className="text-ink">Proving latency.</strong> 15–270 seconds per evaluation is orders of magnitude slower than direct evaluation (~3 ms).</li>
            <li><strong className="text-ink">Cost.</strong> GPU compute time for proving is non-trivial. Cost-effective proving at scale requires further optimization.</li>
            <li><strong className="text-ink">Novelty.</strong> The application of ZK proofs to compliance evaluation is novel and has no established production precedent outside blockchain validation.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* Privacy */}
      <SectionWrapper id="privacy" altTheme>
        <div className="reading-width">
          <h2>7. Privacy and Metadata Leakage</h2>
          <p className="mb-4">The signed evaluation result includes the decision (PASS/BLOCK), rule pass/fail counts, entity ID, and timing information. While entity data fields are not directly included in the signed artifact, the combination of entity ID, decision outcome, per-vertical decision, and timestamp may constitute information that raises privacy concerns.</p>
          <p>The hash-based field encoding used internally (e.g., country hashes, name hashes) provides obfuscation but not formal privacy guarantees. A rigorous privacy analysis — potentially leveraging differential privacy or the ZK proof path — would be needed for deployments handling sensitive personal data.</p>
        </div>
      </SectionWrapper>

      {/* Benchmark Realism */}
      <SectionWrapper id="benchmark-realism">
        <div className="reading-width">
          <h2>8. Benchmark Realism</h2>
          <p className="mb-4 text-ink-secondary">The reported performance figures reflect a prototype implementation with 26 simple rules on a single hardware configuration. Whether these figures scale to production workloads with thousands of rules, complex conditions, and high concurrency is unknown.</p>
          <p className="text-ink-secondary">The reported figures should be treated as demonstration metrics, not production SLA commitments. See the <Link to="/benchmarks" className="text-accent hover:underline">Benchmarks &amp; Methodology</Link> page for detailed interpretation caveats.</p>
        </div>
      </SectionWrapper>

      {/* Product scope */}
      <SectionWrapper id="product-scope-roadmap" altTheme>
        <div className="reading-width">
          <h2>9. Product Scope and Roadmap Honesty</h2>
          <p className="mb-4">This documentation describes a unified architecture: a governance control plane (dashboards, identities, trust signals, human approvals, integrations) paired with a deterministic enforcement kernel. Not every control-plane capability is implemented in every deployment yet — for example broad multi-framework SDK coverage, production-grade DID registries, or turnkey HSM/KMS integrations may trail the kernel in maturity.</p>
          <p className="mb-4">Trust scores and similar heuristics are intentionally subordinate to formal rule outcomes. Treating scores as a primary enforcement mechanism reintroduces the probabilistic failure modes the kernel is meant to eliminate.</p>
          <p className="mb-0">Zero-knowledge proving remains optional and off the real-time evaluation path until latency, cost, and regulatory acceptance justify turning it on for specific workloads.</p>
        </div>
      </SectionWrapper>

      {/* Regulatory Acceptance */}
      <SectionWrapper id="regulatory-acceptance">
        <div className="reading-width">
          <h2>10. Regulatory Acceptance</h2>
          <p className="mb-4">No regulatory authority has, to our knowledge, endorsed or evaluated AGF or any comparable cryptographic compliance engine. The FCA Innovation Hub and equivalent sandbox programs in other jurisdictions provide pathways for exploratory engagement.</p>
          <p className="mb-8">The adoption of cryptographic audit artifacts as a substitute for or supplement to traditional compliance records will require regulatory dialogue, legal analysis, and potentially supervisory guidance or policy change.</p>

          <div className="flex gap-4 mt-8 pb-12">
            <Link to="/research" className="inline-flex items-center justify-center font-heading font-semibold text-base whitespace-nowrap rounded-[100px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 bg-white/5 border border-border-light text-ink shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:bg-white/50 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] px-[28px] py-[14px]">Read the Whitepaper →</Link>
            <Link to="/faq" className="inline-flex items-center justify-center font-heading font-semibold text-base whitespace-nowrap rounded-[100px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 bg-white/5 border border-border-light text-ink shadow-[0_4px_14px_rgba(0,0,0,0.05)] hover:bg-white/50 hover:-translate-y-[1px] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] px-[28px] py-[14px]">Read the FAQ →</Link>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
