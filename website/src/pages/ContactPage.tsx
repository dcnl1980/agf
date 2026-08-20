import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Shield, Clock, Lock } from 'lucide-react';
import React from 'react';

export default function ContactPage() {
  return (
    <div className="flex flex-col bg-surface w-full text-ink min-h-screen">
      {/* Split Layout Header */}
      <section className="relative pt-[10rem] pb-[6rem] border-b border-border/50 overflow-hidden bg-black flex-1 flex flex-col justify-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-full opacity-20 bg-hero-glow pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto px-6 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
            
            {/* Left Box: Value Prop */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="pt-4"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-white font-bold leading-tight mb-6">
                Request a <span className="text-accent">Briefing</span>
              </h1>
              <p className="text-lg text-white/60 mb-12 max-w-[500px]">
                Schedule a technical discussion with our engineers to review governance architecture, implementation sequencing, and the boundary between what the control plane manages and what the formal kernel enforces.
              </p>
              
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <Shield className="w-6 h-6 text-accent mt-1" />
                  <div>
                    <h4 className="text-white font-bold text-lg">Engineering, not Sales</h4>
                    <p className="text-white/50 text-sm mt-1">Discuss cryptographic auditability, isolation posture, policy rollout, and deployment into your own clusters.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <Lock className="w-6 h-6 text-accent mt-1" />
                  <div>
                    <h4 className="text-white font-bold text-lg">Regulatory Mapping</h4>
                    <p className="text-white/50 text-sm mt-1">We'll review your operational risk boundaries, applicable policy packs, and where human approvals belong in the flow.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Clock className="w-6 h-6 text-accent mt-1" />
                  <div>
                    <h4 className="text-white font-bold text-lg">Phased Implementation</h4>
                    <p className="text-white/50 text-sm mt-1">Review the integration pathway: start with one workflow and one framework, then expand policy coverage, approvals, and evidence exports in stages.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Box: Setup Form */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="bg-surface-card border border-border p-8 rounded-2xl shadow-2xl relative">
                {/* Decorative dots */}
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-50">
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <div className="w-2 h-2 rounded-full bg-border" />
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-6">Let's talk tech</h3>
                
                <form className="flex flex-col gap-5" action="#" method="POST">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2 relative">
                      <Label htmlFor="firstName" className="text-white/70">First Name</Label>
                      <Input type="text" id="firstName" name="firstName" required className="bg-black/50 border-white/10 text-white px-4 py-6" />
                    </div>
                    <div className="flex flex-col gap-2 relative">
                      <Label htmlFor="lastName" className="text-white/70">Last Name</Label>
                      <Input type="text" id="lastName" name="lastName" required className="bg-black/50 border-white/10 text-white px-4 py-6" />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 relative">
                    <Label htmlFor="workEmail" className="text-white/70">Work Email</Label>
                    <Input type="email" id="workEmail" name="workEmail" required className="bg-black/50 border-white/10 text-white px-4 py-6" />
                  </div>
                  
                  <div className="flex flex-col gap-2 relative">
                    <Label htmlFor="organization" className="text-white/70">Company Name</Label>
                    <Input type="text" id="organization" name="organization" className="bg-black/50 border-white/10 text-white px-4 py-6" />
                  </div>
                  
                  <div className="flex flex-col gap-2 relative">
                    <Label htmlFor="inquiry-type" className="text-white/70">Primary Use Case</Label>
                    <Select id="inquiry-type" name="inquiry_type" className="bg-black/50 border-white/10 text-white">
                      <option value="architectural_governance">LLM / AI Governance</option>
                      <option value="regulatory">Regulatory Reporting (Capital / KYC)</option>
                      <option value="defi">DeFi / On-chain Compliance</option>
                      <option value="other">Other infrastructure inquiry</option>
                    </Select>
                  </div>
                  
                  <div className="flex flex-col gap-2 relative">
                    <Label htmlFor="message" className="text-white/70">Additional Context</Label>
                    <Textarea 
                      id="message" 
                      name="message" 
                      placeholder="What compliance environment are you trying to secure?" 
                      className="bg-black/50 border-white/10 text-white min-h-[100px]"
                    />
                  </div>
                  
                  <Button type="submit" size="lg" className="w-full mt-4 text-base font-semibold py-6 bg-accent hover:bg-accent-hover text-white">
                    Submit Request
                  </Button>
                </form>
                
                <p className="text-center text-white/40 text-xs mt-6">
                  By submitting this form, you agree to our <Link to="/glossary" className="underline hover:text-white">Privacy Policy</Link>.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
