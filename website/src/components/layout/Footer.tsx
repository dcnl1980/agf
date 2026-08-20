import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-16 bg-black mt-auto text-ink">
      <div className="container-page max-w-[1200px] mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start flex-wrap gap-12 md:gap-24">
          <div className="max-w-[300px]">
            <Link to="/" className="flex items-center gap-2 text-white font-bold font-heading text-xl tracking-tight mb-4 hover:text-white/80 transition-colors">
              AGF <span className="text-white/40 font-medium font-body text-xs tracking-widest uppercase">/ NeuroCluster</span>
            </Link>
            <p className="text-sm text-ink-muted leading-relaxed mb-6">
              Agentic Governance Framework — unified AI governance control plane with a formal compliance kernel, signed audit records, and operator-ready workflows.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-white/30 uppercase tracking-widest">
              <Shield className="w-4 h-4 text-accent/50" />
              Secured by NeuroCluster
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-12 sm:gap-24 w-full md:w-auto">
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest mt-0 mb-6 text-white/50">Infrastructure</h4>
              <ul className="list-none p-0 m-0 space-y-4">
                <li><Link to="/architecture" className="text-sm text-ink-secondary hover:text-white transition-colors">Architecture</Link></li>
                <li><Link to="/verification" className="text-sm text-ink-secondary hover:text-white transition-colors">Verification Model</Link></li>
                <li><Link to="/use-cases" className="text-sm text-ink-secondary hover:text-white transition-colors">Deployment Models</Link></li>
                <li><Link to="/marketplace" className="text-sm text-ink-secondary hover:text-white transition-colors">Ruleset Marketplace</Link></li>
              </ul>
            </div>
            
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest mt-0 mb-6 text-white/50">Governance</h4>
              <ul className="list-none p-0 m-0 space-y-4">
                <li><Link to="/regulatory" className="text-sm text-ink-secondary hover:text-white transition-colors">Regulatory Mapping</Link></li>
                <li><Link to="/limitations" className="text-sm text-ink-secondary hover:text-white transition-colors">Limitations Matrix</Link></li>
                <li><Link to="/benchmarks" className="text-sm text-ink-secondary hover:text-white transition-colors">System Benchmarks</Link></li>
              </ul>
            </div>
            
            <div className="flex flex-col">
              <h4 className="text-xs font-bold uppercase tracking-widest mt-0 mb-6 text-white/50">Company</h4>
              <ul className="list-none p-0 m-0 space-y-4">
                <li><Link to="/research" className="text-sm text-ink-secondary hover:text-white transition-colors">Whitepaper v1.0</Link></li>
                <li><Link to="/about" className="text-sm text-ink-secondary hover:text-white transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-sm text-ink-secondary hover:text-white transition-colors">Request Briefing</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="w-full mt-12 pt-8 border-t border-white/10 text-xs text-white/30 leading-relaxed font-mono">
            <p className="m-0 max-w-[800px]">
              © 2026 NeuroCluster. This framework is an applied research implementation for formal policy enforcement and cryptographic auditability. The documentation does not constitute legal advice. Organizations should use independent legal counsel to align local regulatory interpretations with executable rule systems and operational controls.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
