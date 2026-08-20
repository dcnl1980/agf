import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Command } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ListItem = React.forwardRef<
  React.ElementRef<typeof Link>,
  React.ComponentPropsWithoutRef<typeof Link> & { title: string }
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent/10 hover:text-accent focus:bg-accent/10 focus:text-accent",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none text-foreground mb-2">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

/* ── Mobile accordion section is now handled directly via Accordion ── */

function MobileLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      to={to}
      className="py-2.5 px-3 text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 rounded-md transition-colors"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const closeMobile = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 md:px-8 flex h-14 max-w-screen-2xl items-center">

        {/* ── Mobile: hamburger + logo ── */}
        <div className="flex items-center md:hidden">
          <button 
            className="p-2 -ml-2 text-foreground hover:text-foreground/80 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="ml-2 flex items-center space-x-2" onClick={closeMobile}>
            <div className="bg-foreground text-background w-4 h-4 rounded-sm flex items-center justify-center">
              <Command className="w-3 h-3" />
            </div>
            <span className="font-bold text-sm">AGF</span>
          </Link>
        </div>

        {/* ── Desktop: logo + nav ── */}
        <div className="mr-4 hidden md:flex items-center">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <div className="bg-foreground text-background w-4 h-4 rounded-sm flex items-center justify-center">
              <Command className="w-3 h-3" />
            </div>
            <span className="hidden font-bold sm:inline-block">
              NeuroCluster AGF
            </span>
          </Link>
          
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <span className="inline-flex items-center gap-3">
              <Link
                to="/dashboard"
                className="text-foreground/60 hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/dashboard/rulesets"
                className="text-foreground/60 hover:text-foreground transition-colors"
              >
                Rulesets
              </Link>
            </span>
            <NavigationMenu>
              <NavigationMenuList className="gap-6">
                
                {/* Infrastructure */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-auto p-0 bg-transparent text-foreground/60 transition-colors hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground focus:bg-transparent">
                    Infrastructure
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr] bg-card border-border">
                      <li className="row-span-3">
                        <NavigationMenuLink asChild>
                          <Link
                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-primary/20 to-card p-6 no-underline outline-none focus:shadow-md border border-border/50 relative overflow-hidden group"
                            to="/architecture"
                          >
                            <div className="absolute top-4 right-4 opacity-10 group-hover:scale-110 transition-transform">
                               <Command className="w-24 h-24" />
                            </div>
                            <div className="mb-2 mt-4 text-lg font-bold text-foreground">
                              Architecture
                            </div>
                            <p className="text-sm leading-tight text-muted-foreground z-10">
                              Control plane vs enforcement kernel: deterministic evaluation, integrations, and audit boundaries.
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <ListItem to="/verification" title="Verification">
                        What Ed25519 signatures prove; ZK prototype context
                      </ListItem>
                      <ListItem to="/benchmarks" title="Benchmarks">
                        Latency and execution metrics
                      </ListItem>
                      <ListItem to="/marketplace" title="Ruleset marketplace">
                        Discover and pin community policy bundles
                      </ListItem>
                      <ListItem to="/use-cases" title="Use Cases">
                        Industry deployment scenarios
                      </ListItem>
                      <ListItem to="/dashboard" title="Operator dashboard">
                        Dev control plane: verdicts, approvals, kernel health
                      </ListItem>
                      <ListItem to="/dashboard/rulesets" title="Rulesets & publish">
                        Lifecycle, ARSL validate-on-publish, bundle pins
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Governance */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-auto p-0 bg-transparent text-foreground/60 transition-colors hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground focus:bg-transparent">
                    Governance
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid w-[400px] gap-6 p-6 md:w-[600px] md:grid-cols-2 bg-card border-border">
                      <div className="flex flex-col justify-center gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground mb-2 border-b border-border/50 pb-2">Framework</h4>
                          <ul className="flex flex-col gap-1">
                            <ListItem title="Regulatory Mapping" to="/regulatory">
                              Compare AGF rules against global standards.
                            </ListItem>
                            <ListItem title="Limitations" to="/limitations">
                              Honest platform engineering bounds.
                            </ListItem>
                          </ul>
                        </div>
                      </div>
                      {/* The Mapping Guide Card */}
                      <div className="flex flex-col h-full">
                         <NavigationMenuLink asChild>
                           <Link
                             to="/regulatory"
                             className="flex flex-col h-full w-full select-none rounded-xl bg-gradient-to-br from-black/80 to-black p-6 no-underline outline-none border border-white/10 relative overflow-hidden group shadow-xl"
                           >
                             <div className="absolute -bottom-8 left-4 right-4 h-32 bg-white/5 border border-white/10 rounded-t-xl transition-transform group-hover:-translate-y-2" />
                             <div className="absolute -bottom-10 left-8 right-8 h-32 bg-white/5 border border-white/10 rounded-t-xl transition-transform group-hover:-translate-y-4 delay-75" />
                             
                             <div className="relative z-10">
                                <h5 className="text-white font-bold text-lg mb-1">Mapping Guide</h5>
                                <p className="text-white/60 text-sm">
                                  Review translated rules for HIPAA, GDPR, ISO 27001
                                </p>
                             </div>
                           </Link>
                         </NavigationMenuLink>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Company */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-auto p-0 bg-transparent text-foreground/60 transition-colors hover:text-foreground hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-foreground focus:bg-transparent">
                    Company
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 bg-card border-border">
                      <ListItem title="About NeuroCluster" to="/about">
                        The engineering team behind AGF
                      </ListItem>
                      <ListItem title="Research & Whitepaper" to="/research">
                        Read the technical documentation
                      </ListItem>
                      <ListItem title="FAQ" to="/faq">
                        Answers to common implementation queries
                      </ListItem>
                      <ListItem title="Glossary" to="/glossary">
                        Key terms and definitions
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

              </NavigationMenuList>
            </NavigationMenu>
          </nav>
        </div>

        {/* Spacer on mobile */}
        <div className="flex-1" />

        {/* Right Side Actions */}
        <nav className="flex items-center gap-2">
          <Link 
            target="_blank" 
            rel="noreferrer" 
            to="https://github.com/neurocluster"
          >
            <div
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 w-9"
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              <span className="sr-only">GitHub</span>
            </div>
          </Link>
          
          <div className="hidden md:flex">
            <Button asChild size="sm" className="h-8 shadow-sm">
              <Link to="/contact">Request Briefing</Link>
            </Button>
          </div>
        </nav>
      </div>

      {/* ── Mobile Navigation Overlay ── */}
      {isOpen && (
        <div className="fixed inset-0 top-14 z-[99] md:hidden">
          {/* Opaque background */}
          <div className="absolute inset-0 bg-background" />
          {/* Content */}
          <div className="relative h-full overflow-y-auto px-6 py-4 flex flex-col gap-1">
            <MobileLink to="/dashboard" onClick={closeMobile}>Dashboard</MobileLink>
            <MobileLink to="/dashboard/rulesets" onClick={closeMobile}>Rulesets</MobileLink>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="infrastructure" className="border-border/30">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:no-underline py-4">Infrastructure</AccordionTrigger>
                <AccordionContent className="flex flex-col gap-1 pb-4 pl-1">
                  <MobileLink to="/architecture" onClick={closeMobile}>Architecture</MobileLink>
                  <MobileLink to="/verification" onClick={closeMobile}>Verification</MobileLink>
                  <MobileLink to="/benchmarks" onClick={closeMobile}>Benchmarks</MobileLink>
                  <MobileLink to="/marketplace" onClick={closeMobile}>Ruleset Marketplace</MobileLink>
                  <MobileLink to="/use-cases" onClick={closeMobile}>Use Cases</MobileLink>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="governance" className="border-border/30">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:no-underline py-4">Governance</AccordionTrigger>
                <AccordionContent className="flex flex-col gap-1 pb-4 pl-1">
                  <MobileLink to="/regulatory" onClick={closeMobile}>Regulatory Mapping</MobileLink>
                  <MobileLink to="/limitations" onClick={closeMobile}>Limitations</MobileLink>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="company" className="border-border/30">
                <AccordionTrigger className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:no-underline py-4">Company</AccordionTrigger>
                <AccordionContent className="flex flex-col gap-1 pb-4 pl-1">
                  <MobileLink to="/about" onClick={closeMobile}>About NeuroCluster</MobileLink>
                  <MobileLink to="/research" onClick={closeMobile}>Research & Whitepaper</MobileLink>
                  <MobileLink to="/faq" onClick={closeMobile}>FAQ</MobileLink>
                  <MobileLink to="/glossary" onClick={closeMobile}>Glossary</MobileLink>
                  <MobileLink to="/contact" onClick={closeMobile}>Contact</MobileLink>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-6 pt-4 border-t border-border/30">
              <Button asChild className="w-full h-11 text-base">
                <Link to="/contact" onClick={closeMobile}>Request Briefing</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
