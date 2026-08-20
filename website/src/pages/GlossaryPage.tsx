import { SectionWrapper } from '../components/layout/SectionWrapper';

export default function GlossaryPage() {
  const glossaryItems = [
    { term: 'ARSL', definition: 'AGF Rule Specification Language — a TOML-based domain-specific language for defining compliance rules. Each rule specifies a condition type, field reference, threshold, and enforcement action with metadata linking to source regulation.' },
    { term: 'Basis points (bps)', definition: 'A unit of measure equal to 0.01 percentage points. Used in ARSL to express thresholds with integer arithmetic (e.g., 800 bps = 8.00%).' },
    { term: 'Blake3', definition: 'A cryptographic hash function used by AGF for hashing evaluation results and building the Immutable Audit Log hash chain. Targets 128-bit security. Not yet IETF or NIST standardized.' },
    { term: 'ComplianceBatch', definition: 'A typed intermediate representation of compiled ARSL rules and entity data, produced by the compilation layer. Serves as input to the deterministic evaluation function.' },
    { term: 'Confidential Computing', definition: 'Hardware-based protection of data in use, typically using Trusted Execution Environments. Distinct from container isolation — provides confidentiality, not just isolation.' },
    { term: 'Control plane', definition: 'The management layer for AI governance: agent onboarding, policy publishing workflows, trust and risk signals, human approvals, reporting, and integrations. It configures and observes the system but must not silently override deterministic kernel verdicts.' },
    { term: 'CRR / CRR2', definition: 'Capital Requirements Regulation — EU regulation establishing prudential requirements (capital ratios, leverage, liquidity) for credit institutions.' },
    { term: 'Deterministic evaluation', definition: 'An evaluation where the same inputs always produce the same output. AGF achieves this through a pure function with no I/O, no randomness, and no floating-point arithmetic.' },
    { term: 'Decentralized Identifier (DID)', definition: 'A W3C-standard style identifier for agents and services so actions can be attributed consistently across systems. AGF’s unified architecture assumes DIDs or compatible agent IDs feed the audit trail, even when the verifier is not on-chain.' },
    { term: 'DORA', definition: 'Digital Operational Resilience Act — EU regulation on ICT risk management, including requirements for incident reporting and third-party oversight.' },
    { term: 'Ed25519', definition: 'An Edwards-curve digital signature algorithm specified in RFC 8032. Used by AGF to sign evaluation results. Provides 128-bit security with deterministic nonce generation.' },
    { term: 'Enforcement kernel', definition: 'The policy firewall component that evaluates proposed agent actions before execution, emitting deterministic PASS/BLOCK/HITL outcomes inside an isolated runtime and writing tamper-evident audit records. In the strongest currently validated cluster profile, outbound network access is fail-closed during evaluation.' },
    { term: 'EvaluationResult', definition: 'The output of the evaluation function, containing per-rule compliance status (pass/fail), actual values, and margin-to-threshold in basis points.' },
    { term: 'FCA', definition: 'Financial Conduct Authority — the UK financial services regulator. AGF maps to FCA provisions including SYSC 9 (record-keeping) and SYSC 6.3 (compliance procedures).' },
    { term: 'Formalization risk', definition: 'The risk that the translation from natural-language regulatory text to executable ARSL rules introduces errors, omissions, or oversimplifications.' },
    { term: 'GRC', definition: 'Governance, Risk, and Compliance — a category of enterprise software for managing policies, risks, and compliance status. Distinct from evaluation engines.' },
    { term: 'Hash chain', definition: 'A sequence of hash values where each entry includes the hash of the previous entry, creating tamper-evident sequential dependency.' },
    { term: 'Human-in-the-loop (HITL)', definition: 'A governance pattern where some actions require explicit human approval after policy evaluation marks them as REQUIRE_APPROVAL or equivalent. Satisfies oversight expectations in regulations such as EU AI Act Article 14 when combined with explainable rule results.' },
    { term: 'IAL', definition: 'Immutable Audit Log — AGF\'s Blake3 hash-chained, append-only audit trail that records each evaluation with a proof hash, chain hash, and timestamp.' },
    { term: 'Kata Containers', definition: 'An open-source project providing VM-level isolation for container workloads via QEMU micro-VMs. Used by AGF for defense-in-depth against container-escape attacks.' },
    { term: 'MiCA', definition: 'Markets in Crypto-Assets Regulation — EU regulation establishing requirements for crypto-asset service providers.' },
    { term: 'MLR 2017', definition: 'Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017 — UK regulations requiring customer due diligence and ongoing monitoring.' },
    { term: 'OPA', definition: 'Open Policy Agent — a CNCF project for policy-as-code, using the Rego language. Primarily used for infrastructure authorization.' },
    { term: 'SAMLA 2018', definition: 'Sanctions and Anti-Money Laundering Act 2018 — UK legislation providing the framework for financial sanctions.' },
    { term: 'SP1 zkVM', definition: 'A RISC-V-based zero-knowledge virtual machine developed by Succinct Labs. Used by AGF to demonstrate provability of compliance evaluation.' },
    { term: 'Tamper-evident', definition: 'A property ensuring that modification of recorded data is detectable. AGF\'s hash chain provides tamper evidence — modification is computationally infeasible to perform undetected under standard cryptographic assumptions.' },
    { term: 'TEE', definition: 'Trusted Execution Environment — hardware-enforced isolated execution, such as AMD SEV-SNP or Intel TDX. Provides memory encryption and remote attestation.' },
    { term: 'Zero-knowledge proof', definition: 'A cryptographic proof that a computation was performed correctly, without revealing the inputs. AGF\'s ZK capability is demonstrated in prototype but not deployed in production.' },
    { term: 'zkVM', definition: 'Zero-Knowledge Virtual Machine — a system for proving correct program execution via zero-knowledge proofs. Examples include SP1, RISC Zero, and Jolt.' }
  ];

  return (
    <div className="flex flex-col">
      <SectionWrapper id="glossary-header">
        <div className="reading-width">
          <h1>Glossary</h1>
          <p className="text-xl text-ink-secondary">Definitions of technical terms used throughout the AGF whitepaper and this website.</p>
        </div>
      </SectionWrapper>

      <SectionWrapper id="glossary-table" altTheme className="pb-24">
        <div className="wide-width">
          <div className="overflow-x-auto my-[2rem] border border-border-light rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
            <table className="w-full border-collapse m-0 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light w-[200px] whitespace-nowrap">Term</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light">Definition</th>
                </tr>
              </thead>
              <tbody>
                {glossaryItems.map((item, index) => (
                  <tr key={index} className="hover:bg-surface-alt transition-colors">
                    <td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">
                      {item.term}
                    </td>
                    <td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light leading-relaxed">
                      {item.definition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
