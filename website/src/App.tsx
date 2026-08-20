import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

const HomePage = lazy(() => import('./pages/HomePage'));
const UseCasesPage = lazy(() => import('./pages/UseCasesPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));
const ArchitecturePage = lazy(() => import('./pages/ArchitecturePage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const RegulatoryPage = lazy(() => import('./pages/RegulatoryPage'));
const BenchmarksPage = lazy(() => import('./pages/BenchmarksPage'));
const LimitationsPage = lazy(() => import('./pages/LimitationsPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const GlossaryPage = lazy(() => import('./pages/GlossaryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RulesetManagerPage = lazy(() => import('./pages/RulesetManagerPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="rounded-full border border-border/60 bg-surface-card px-4 py-2 text-sm text-ink-muted">
        Loading page…
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/use-cases" element={<UseCasesPage />} />
            <Route path="/research" element={<ResearchPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="/verification" element={<VerificationPage />} />
            <Route path="/regulatory" element={<RegulatoryPage />} />
            <Route path="/benchmarks" element={<BenchmarksPage />} />
            <Route path="/limitations" element={<LimitationsPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/glossary" element={<GlossaryPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/marketplace/:entryId" element={<MarketplacePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard/rulesets" element={<RulesetManagerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default App;
