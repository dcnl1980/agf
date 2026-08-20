import { SectionWrapper } from '../components/layout/SectionWrapper';
import { LatencyChart } from '../components/ui/LatencyChart';
import { motion } from 'framer-motion';

export default function BenchmarksPage() {
  return (
    <div className="flex flex-col">
      <SectionWrapper id="benchmarks-header">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="reading-width"
        >
          <h1>Benchmarks &amp; Methodology</h1>
          <p className="text-xl text-ink-secondary">Prototype performance data reported responsibly, with explicit interpretation caveats and a recommended methodology for future external benchmarking.</p>
        </motion.div>
      </SectionWrapper>

      {/* Prototype Performance */}
      <SectionWrapper id="prototype-results" altTheme>
        <div className="reading-width">
          <h2>Prototype Performance</h2>
          <p>The following measurements were obtained on the AGF prototype. They are internal measurements on a single hardware configuration and should not be extrapolated to general production performance.</p>

          <div className="overflow-x-auto my-[2rem] border border-border-light rounded-xl bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
            <table className="w-full border-collapse m-0 text-sm">
              <thead>
                <tr>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Metric</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Value</th>
                  <th className="text-left font-heading font-bold px-6 py-4 bg-surface-alt border-b border-border-light text-ink-light whitespace-nowrap">Conditions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">26-rule multi-vertical evaluation (evaluate only)</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light whitespace-nowrap">&lt; 0.01 ms</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">Pure function execution, M-series Apple Silicon</td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-border-light">Full pipeline (parse + compile + evaluate + sign + audit)</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light whitespace-nowrap">2.77 ms</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-border-light">Including ARSL parsing, Blake3 hashing, Ed25519 signing</td></tr>
                <tr className="hover:bg-surface-alt transition-colors"><td className="px-6 py-4 align-top text-ink-light font-bold border-b border-transparent">Server startup to first request</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent whitespace-nowrap">&lt; 100 ms</td><td className="px-6 py-4 align-top text-ink-sec-light border-b border-transparent">Release build, no I/O-bound initialization</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-bold mt-12 mb-4">ZK Proving Performance</h3>
          <div className="border border-roadmap-border bg-roadmap-bg p-8 rounded-xl my-6">
            <span className="block font-heading font-bold text-xs uppercase tracking-[0.1em] mb-4 text-[#CBA4FF]">Prototype Capability — Not Production</span>
            <p className="text-ink-secondary mb-0">ZK proving is a demonstrated capability, not a deployed production feature. The following figures reflect prototype proving on SP1 zkVM v6.0.2.</p>
          </div>

          <LatencyChart />
        </div>
      </SectionWrapper>

      {/* Caveats */}
      <SectionWrapper id="caveats">
        <div className="reading-width">
          <h2>Interpretation Caveats</h2>
          <p>The reported figures must be understood in context. The following limitations apply:</p>

          <ul className="list-disc pl-6 space-y-3 mt-4 text-ink-secondary mb-8">
            <li><strong className="text-ink">Rule complexity.</strong> The current ARSL condition types are comparatively simple (threshold comparisons, set membership). Rules involving complex cross-field calculations, historical lookups, or large blocked-values lists would increase evaluation time.</li>
            <li><strong className="text-ink">Scale.</strong> Performance has been measured with 26 rules. Behavior at 10,000+ rules per evaluation, or under concurrent request load, has not been benchmarked.</li>
            <li><strong className="text-ink">Data volume.</strong> Entity data is currently passed as a flat <code className="bg-surface-card border border-border px-1 py-0.5 rounded text-xs font-mono">HashMap&lt;String, u64&gt;</code>. Large or nested data structures would require architectural changes.</li>
            <li><strong className="text-ink">Production environment.</strong> Measurements were taken outside the Kata VM. Virtualization overhead (typically 5–15% for Kata Containers) has not been factored in.</li>
            <li><strong className="text-ink">Comparison baseline.</strong> The "2–6 weeks" estimate for manual compliance review reflects industry practice for complex assessments. Simple checks within those assessments may already be automated in some institutions. A like-for-like comparison requires benchmarking against specific incumbent processes.</li>
          </ul>

          <div className="border border-caution-border bg-[#fff8e6] p-8 rounded-xl my-8">
            <span className="block font-heading font-bold text-xs uppercase tracking-[0.1em] mb-4 text-[#a97b00]">Important</span>
            <p className="text-[#a97b00]/90 mb-0">These figures should be treated as <strong className="text-[#a97b00]">demonstration metrics</strong>, not production SLA commitments. Demo latency is not the same as production latency.</p>
          </div>
        </div>
      </SectionWrapper>

      {/* ZK Proving Cost */}
      <SectionWrapper id="zk-costs" altTheme>
        <div className="reading-width">
          <h2>ZK Proving Cost Considerations</h2>
          <p>Zero-knowledge proving imposes significant computational overhead relative to direct evaluation:</p>
          <ul className="list-disc pl-6 space-y-2 my-4 text-ink-sec-light">
            <li>Proving latency of 15–270 seconds is orders of magnitude slower than direct evaluation (~3 ms).</li>
            <li>Cost-effective proving at scale likely requires GPU proving clusters and further algorithmic optimization.</li>
            <li>At current SP1 pricing, proving 26 rules costs significantly more than direct evaluation.</li>
          </ul>
          <p className="mt-4 text-ink-sec-light">These costs are expected to decrease as ZK proof systems mature and hardware acceleration improves, but they currently make proving impractical for high-volume, real-time evaluation scenarios.</p>
        </div>
      </SectionWrapper>

      {/* Recommended Benchmark Methodology */}
      <SectionWrapper id="methodology">
        <div className="reading-width">
          <h2>Recommended Benchmark Methodology</h2>
          <p>For future external benchmarking, the whitepaper recommends the following approach:</p>
          <ol className="list-decimal pl-6 space-y-2 mt-4 mb-6 text-ink-secondary">
            <li>Define a standard benchmark suite of rule sets at varying complexity levels (10, 100, 1,000, 10,000 rules).</li>
            <li>Measure under controlled concurrent load (1, 10, 100 requests/second).</li>
            <li>Include Kata VM overhead in measurements.</li>
            <li>Separate parse/compile latency from evaluation latency.</li>
            <li>Report P50, P95, and P99 latencies, not only means.</li>
          </ol>
          <p className="text-ink-secondary">AGF has not yet undergone external benchmarking. The prototype measurements reported above are internal results that should be independently validated before drawing performance conclusions.</p>
        </div>
      </SectionWrapper>
    </div>
  );
}
