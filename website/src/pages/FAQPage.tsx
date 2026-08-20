import { SectionWrapper } from '../components/layout/SectionWrapper';

export default function FAQPage() {
  return (
    <div className="flex flex-col">
      <SectionWrapper id="faq-header">
        <div className="reading-width">
          <h1>Frequently Asked Questions</h1>
          <p className="text-xl text-ink-secondary">Direct answers to the questions a skeptical regulator, engineer, or compliance officer would ask about AGF.</p>
        </div>
      </SectionWrapper>

      <SectionWrapper id="faq-list" altTheme className="pb-24">
        <div className="reading-width">
          <div className="space-y-6">
            
            {/* FAQ 1 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Does AGF prove legal compliance?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">No. AGF evaluates whether structured entity data satisfies formalized rules. Legal compliance depends on the correctness of rule formalization, the accuracy of input data, jurisdictional interpretation, and supervisory acceptance — none of which AGF guarantees. The system produces a verifiable record that a defined set of rules was evaluated correctly, which is an ingredient of compliance assurance, not compliance itself.</p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Can third parties verify results without seeing private data?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">Currently, a third party can verify the Ed25519 signature and hash-chain integrity of a result — confirming that the artifact was produced by the holder of the signing key and has not been modified. This verification does not require access to the entity's raw data, but it also does not confirm that the data was correct or complete. Full privacy-preserving verification — where the verifier can confirm correct computation without any access to inputs — is a zero-knowledge proof capability that has been demonstrated in prototype but is not deployed in production.</p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">What role do trusted execution environments play?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">The current system uses Kata Containers (QEMU micro-VMs) for VM-level isolation, which provides defense against container-escape attacks. The strongest live cluster proof today is a gpu-scoped Kata deployment with fail-closed outbound blocking, not confidential computing. Without hardware TEE support (AMD SEV-SNP, Intel TDX), the cluster administrator can still inspect pod memory. The system includes a TEE attestation stub, not a hardware-rooted attestation. Upgrading to Confidential Containers with hardware TEE remains a roadmap item.</p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">How is this different from a signed PDF or audit report?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">A signed PDF attests that a document was produced by a particular person or system and has not been modified. AGF's audit log goes further in several ways: (1) the evaluation is deterministic, so the result can be independently reproduced by any party with the same inputs and rules; (2) the hash chain creates a sequential dependency between evaluations, preventing reordering or selective deletion; and (3) the signature binds the result to both its content and its position in the audit log. However, like a signed PDF, AGF does not validate the accuracy of the underlying data.</p>
            </div>

            {/* FAQ 5 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Does hashing data preserve privacy automatically?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">No. Hashing provides obfuscation, not formal privacy guarantees. The signed evaluation result includes the decision (PASS/BLOCK), rule pass/fail counts, entity ID, and timing information. The combination of these metadata fields may be sufficient to infer sensitive information in some contexts. A rigorous privacy analysis would be needed for deployments handling sensitive personal data, potentially leveraging differential privacy or zero-knowledge proofs to reduce artifact metadata.</p>
            </div>

            {/* FAQ 6 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Does deterministic evaluation remove the need for human oversight?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">No. Determinism supports the interpretability dimension — rules are transparent, version-controlled, and produce explainable per-rule results. But human oversight, as required by regulations like the EU AI Act Article 14, also demands provision for human intervention, override capability, and awareness of automation bias. AGF automates the mechanical, evaluable portion of compliance checks; it does not replace the judgment, discretion, and supervisory functions that human oversight provides.</p>
            </div>

            {/* FAQ 7 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">What happens if the input data is wrong?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">The system evaluates data as provided and signs the result. If the data is wrong, the evaluation result will be correspondingly unreliable. A cryptographically signed incorrect result is still incorrect. AGF provides integrity guarantees over the evaluation process, not over the truth of the inputs. Upstream data-quality controls, source-of-truth validation, and data-lineage tracking are necessary complements.</p>
            </div>

            {/* FAQ 8 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Are zero-knowledge proofs live in production?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">No. Zero-knowledge proving has been demonstrated in a prototype: 19 conformance test cases were compiled to RISC-V and proven using SP1 zkVM v6.0.2. However, ZK proving is not part of the current production evaluation pipeline. All production evaluations use direct execution with Ed25519 signing. Proving latency (15–270 seconds) and cost make ZK proofs impractical for high-volume real-time evaluation at this stage.</p>
            </div>

            {/* FAQ 9 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">How does this compare to existing GRC, AI trust platforms, and policy-as-code tools?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">GRC suites excel at obligation tracking and workflow, but rarely bind each agent action to a reproducible, signed verdict. Modern AI trust platforms emphasize dashboards, risk scoring, and fast SDK integrations — valuable for adoption, yet risky if scores replace formal allow/deny logic. OPA/Rego delivers deterministic policy evaluation for many domains, yet often without the tamper-evident audit chain AGF targets for regulated workloads. AGF intentionally combines operator-friendly control-plane patterns with a narrow enforcement kernel so trust signals orchestrate people and process while rules and cryptography prove what was decided. Incumbent tools still lead on ecosystem breadth and supervisory familiarity; AGF leads on cryptographic reproducibility and pre-execution enforcement — meet us on the limitations page for honest gaps.</p>
            </div>

            {/* FAQ 10 */}
            <div className="bg-white border border-border-light p-6 rounded-xl hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold mt-0 border-b border-border-light pb-4 mb-4 text-ink-light">Why use Blake3 instead of SHA-256?</h3>
              <p className="text-sm md:text-base text-ink-sec-light leading-normal md:leading-relaxed mb-0">Blake3 was selected for its high performance and suitability for hash-chaining applications. It targets 128-bit security and avoids length-extension attacks. However, Blake3 has not achieved formal IETF or NIST standardization (an IETF Internet-Draft exists but has expired). For contexts requiring regulatory-endorsed hash functions, SHA-256 or SHA-3 may be preferred. The AGF architecture is designed to permit substitution of the hash function.</p>
            </div>

          </div>
        </div>
      </SectionWrapper>
    </div>
  );
}
