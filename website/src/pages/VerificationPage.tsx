import { SectionWrapper } from '../components/layout/SectionWrapper';
import { Badge } from '../components/ui/badge';

export default function VerificationPage() {
  return (
    <div className="flex flex-col">
      <SectionWrapper id="verification-header">
        <div className="reading-width">
          <h1>Verification Model</h1>
          <p className="text-xl text-ink-secondary">A precise account of what AGF's cryptographic signatures prove, what hash-chaining guarantees, what third parties can verify, and what still requires trust.</p>
        </div>
      </SectionWrapper>

      {/* What Is Signed */}
      <SectionWrapper id="what-is-signed">
        <div className="reading-width">
          <h2>What Is Signed</h2>
          <p>Each evaluation result is signed with Ed25519. The canonical signing message binds three components:</p>
          <div className="mb-4">
            <pre className="bg-surface-navy border border-border text-white p-4 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto"><code className="text-white">AGF-EVAL-V1:{'{proof_hash}'}:{'{chain_hash}'}:{'{timestamp_utc}'}</code></pre>
            <p className="text-sm text-ink-muted mt-2 italic">Canonical signing message format. The signature covers the evaluation content (proof hash), audit-log position (chain hash), and time of evaluation.</p>
          </div>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-ink-secondary">
            <li><strong className="text-ink">Proof hash</strong> — Blake3 hash of the evaluation input parameters (rule file, entity ID, pass/block counts). This binds the signature to the specific evaluation.</li>
            <li><strong className="text-ink">Chain hash</strong> — Blake3 hash of <code>previous_chain_hash || current_entry</code>, creating a sequential dependency. This prevents reordering or substitution of signed results.</li>
            <li><strong className="text-ink">Timestamp</strong> — RFC 3339 timestamp of the evaluation. This provides temporal ordering.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* What Is Hash-Chained */}
      <SectionWrapper id="hash-chain" altTheme>
        <div className="reading-width">
          <h2>What Is Hash-Chained</h2>
          <p>The Immutable Audit Log (IAL) is an in-memory, append-only log where each entry depends on the hash of the previous entry. This creates a chain: modifying any historical entry changes its hash, which breaks the chain for all subsequent entries.</p>
          <p>The chain hash structure provides <strong className="text-ink-light">tamper evidence</strong>: it is computationally infeasible to alter a historical record without detection, under standard assumptions about the preimage resistance of Blake3.</p>

          <h3 className="text-xl mt-8 mb-4 font-bold text-ink-light">IAL Entry Structure</h3>
          <div className="overflow-x-auto my-[2rem] border border-border-light rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
            <table className="w-full border-collapse m-0 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Field</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Type</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light border-b border-border-light font-mono text-xs"><code>log_id</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light font-mono text-xs"><code>u64</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">Monotonically increasing sequence number</td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light border-b border-border-light font-mono text-xs"><code>proof_hash</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light font-mono text-xs"><code>String</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">Blake3 hash of evaluation input parameters</td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light border-b border-border-light font-mono text-xs"><code>chain_hash</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light font-mono text-xs"><code>String</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">Blake3 hash of previous chain hash + current entry</td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light border-b border-transparent font-mono text-xs"><code>timestamp_utc</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent font-mono text-xs"><code>String</code></td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent">RFC 3339 timestamp</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionWrapper>

      {/* Third-Party Verification */}
      <SectionWrapper id="third-party">
        <div className="reading-width">
          <h2>What Third Parties Can Verify</h2>
          <p>A third party can verify a signed evaluation result by:</p>
          <ol className="list-decimal pl-6 space-y-2 my-4 text-ink-secondary">
            <li>Obtaining the server's public key from the <code className="bg-surface-card px-1.5 py-0.5 rounded text-xs text-ink font-mono border border-border">GET /public-key</code> endpoint.</li>
            <li>Reconstructing the canonical signing message from the result's proof hash, chain hash, and timestamp.</li>
            <li>Verifying the Ed25519 signature using the <code className="bg-surface-card px-1.5 py-0.5 rounded text-xs text-ink font-mono border border-border">agf-verify</code> CLI tool.</li>
          </ol>
          <p>Successful verification confirms:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-ink-secondary">
            <li>The result was produced by the holder of the corresponding private key.</li>
            <li>The proof hash and chain hash have not been altered since signing.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* What Requires Trust */}
      <SectionWrapper id="trust-requirements" altTheme>
        <div className="reading-width">
          <h2>What Requires Trust</h2>
          <div className="border border-caution-border bg-[#fff8e6] p-5 md:p-6 rounded-xl my-6">
            <span className="block font-heading font-bold text-xs uppercase tracking-[0.1em] mb-4 text-[#a97b00]">Critical Distinction</span>
            <p className="text-caution-text mb-0">Verification confirms the <em>integrity of the signed artifact</em>. It does <strong className="text-[#a97b00]">not</strong> confirm that the input data was correct, that the rules were correctly formalized, or that the evaluation logic is sound. Cryptographic integrity of the record is a necessary but not sufficient condition for the reliability of the compliance assessment.</p>
          </div>

          <p>The following elements remain trust-dependent:</p>
          <ul className="list-disc pl-6 space-y-3 mt-4 text-ink-sec-light">
            <li><strong className="text-ink-light">Input data accuracy.</strong> AGF evaluates data as provided. If the data is incorrect, incomplete, or fabricated, the signed result will reflect that — accurately recording an evaluation of inaccurate data.</li>
            <li><strong className="text-ink-light">Rule formalization correctness.</strong> ARSL rules are engineering interpretations of regulatory text. The correctness of this translation depends on the skill and diligence of the rule authors.</li>
            <li><strong className="text-ink-light">Signing key integrity.</strong> The trust model depends on the security of the Ed25519 private key. A compromised key allows the holder to produce arbitrary signed results.</li>
            <li><strong className="text-ink-light">Execution environment integrity.</strong> Without hardware TEE attestation, the verifier must trust that the evaluation actually ran in the claimed environment.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* What ZK Would Change */}
      <SectionWrapper id="zk-future">
        <div className="reading-width">
          <h2>What Zero-Knowledge Proofs Would Change</h2>
          <div className="border border-roadmap-border bg-roadmap-bg p-5 md:p-6 rounded-xl my-6">
            <span className="block font-heading font-bold text-xs uppercase tracking-[0.1em] mb-4 text-[#CBA4FF]">Roadmap Capability</span>
            <p className="text-ink-secondary mb-0">Zero-knowledge proving is a demonstrated prototype capability (19 conformance cases proven on SP1 zkVM v6.0.2) — not a deployed production feature.</p>
          </div>

          <p>A zero-knowledge proof of compliance evaluation would enable a verifier to confirm that the evaluation was performed correctly <em>without re-executing it and without access to the input data</em>. This would address two limitations of the current model:</p>
          <ol className="list-decimal pl-6 space-y-3 my-4 text-ink-secondary">
            <li><strong className="text-ink">Computation correctness without re-execution.</strong> Currently, verifying that the evaluation logic ran correctly requires re-executing the evaluation. A ZK proof would provide a cryptographic guarantee of correct execution.</li>
            <li><strong className="text-ink">Privacy preservation.</strong> Currently, verification requires access to enough information to reconstruct the signing message. A ZK proof could enable verification without revealing entity data.</li>
          </ol>

          <p className="mt-6 mb-2">However, ZK proofs would <strong className="text-ink">not</strong> address:</p>
          <ul className="list-disc pl-6 space-y-2 text-ink-secondary">
            <li>Data integrity — a ZK proof confirms the function was computed correctly on <em>some</em> inputs, not that those inputs were truthful.</li>
            <li>Rule correctness — a ZK proof says nothing about whether the rules are correct formalizations of regulatory intent.</li>
          </ul>
        </div>
      </SectionWrapper>

      {/* Five-Layer Distinction */}
      <SectionWrapper id="five-layers" altTheme>
        <div className="reading-width">
          <h2>Five Layers of Verification Scope</h2>
          <p>The following table explicitly distinguishes what AGF verifies at each layer and what remains outside verification scope.</p>

          <div className="overflow-x-auto my-[2rem] border border-border-light rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
            <table className="w-full border-collapse m-0 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Layer</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">What It Addresses</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Integrity of result artifacts</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">The signed evaluation record has not been modified after signing</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light"><Badge variant="live">Live</Badge></td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Integrity of audit sequence</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">The hash chain detects insertion, deletion, or reordering of log entries</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light"><Badge variant="live">Live</Badge></td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Correctness of computation</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">The evaluation function produced the correct output for the given inputs</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light"><Badge variant="prototype">Prototype (ZK)</Badge></td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Integrity of execution environment</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">The evaluation ran in the claimed isolated environment</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light"><Badge variant="roadmap">Roadmap (TEE)</Badge></td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Correctness of input data</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">The entity data was accurate, complete, and current</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light"><Badge variant="default">Out of Scope</Badge></td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-transparent">Legal validity of rules</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent">The ARSL rules correctly formalize the regulatory intent</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent"><Badge variant="default">Out of Scope</Badge></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </SectionWrapper>

      {/* Verification Flow Diagram */}
      <SectionWrapper id="verification-flow">
        <div className="reading-width">
          <h2>Verification Flow</h2>
          <div className="mb-12">
            <pre className="bg-surface-navy border border-border text-white p-6 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto text-green-400"><code className="text-green-400">{`┌─────────────────┐    POST /evaluate-entity    ┌───────────────────┐
│  Client / Demo  │ ──────────────────────────→ │  AGF Server       │
│                 │                              │  ┌─ Parse ARSL    │
│                 │                              │  ├─ Compile       │
│                 │                              │  ├─ Evaluate (pure)│
│                 │                              │  ├─ Hash (Blake3) │
│                 │                              │  ├─ Chain (IAL)   │
│                 │                              │  └─ Sign (Ed25519)│
│                 │ ←──────────────────────────  │                   │
│  Result + Sig   │    JSON response             └───────────────────┘
│                 │
│  ┌──────────────┤
│  │ agf-verify   │    GET /public-key
│  │              │ ──────────────────────────→  Server
│  │              │ ←──────────────────────────  Public key
│  │              │
│  │ Reconstruct  │    AGF-EVAL-V1:{proof}:{chain}:{ts}
│  │ signing msg  │
│  │              │
│  │ Ed25519.     │
│  │ verify()     │ → ✅ Execution integrity confirmed
│  └──────────────┘   (Data integrity NOT confirmed)`}</code></pre>
            <p className="text-sm text-ink-secondary mt-3 italic">End-to-end verification flow. The client submits entity data, receives a signed result, and independently verifies the signature using the server's public key. Verification confirms execution integrity but not data integrity.</p>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
