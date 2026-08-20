import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SectionWrapper } from "../components/layout/SectionWrapper";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  clearSession,
  fetchPublicConfig,
  loginWithEmailPassword,
  loginWithSharedPassword,
  registerOpenAccount,
} from "../lib/controlPlaneApi";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reg, setReg] = useState(false);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof fetchPublicConfig>> | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    void fetchPublicConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!password) {
      setErr("Password is required");
      return;
    }
    setLoading(true);
    try {
      if (reg && config?.openRegistration) {
        await registerOpenAccount(email.trim(), password);
        navigate(next, { replace: true });
        return;
      }
      if (email.trim()) {
        await loginWithEmailPassword(email.trim(), password);
      } else {
        await loginWithSharedPassword(password);
      }
      navigate(next, { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-navy text-ink flex flex-col">
      <section className="pt-24 pb-16 border-b border-border/50 bg-black">
        <div className="max-w-md mx-auto px-6">
          <h1 className="text-2xl font-bold text-white m-0">Control plane sign-in</h1>
          <p className="text-ink-secondary text-sm mt-2 m-0">
            Use <strong>email + password</strong> for org-scoped accounts (set{" "}
            <code className="text-white/80">CONTROL_PLANE_JWT_SECRET</code>, bootstrap or invite users), or leave email empty and
            use a single <strong>shared password</strong> if{" "}
            <code className="text-white/80">CONTROL_PLANE_DASHBOARD_PASSWORD</code> is set.
          </p>
        </div>
      </section>
      <SectionWrapper>
        <form onSubmit={(e) => void onSubmit(e)} className="max-w-md mx-auto space-y-4">
          {err && <p className="text-sm text-rose-400 m-0 break-words">{err}</p>}
          {config && (
            <p className="text-xs text-ink-muted m-0">
              Accounts: {config.userAccountCount}. Open registration: {config.openRegistration ? "on" : "off"}.
            </p>
          )}
          <div>
            <Label htmlFor="cp-email">Email (optional for legacy shared-password login)</Label>
            <Input
              id="cp-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              placeholder="you@org.com"
            />
          </div>
          <div>
            <Label htmlFor="cp-pw">Password</Label>
            <Input
              id="cp-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading || !password}>
              {loading ? "Signing in…" : reg && config?.openRegistration ? "Register" : "Sign in"}
            </Button>
            {config?.openRegistration && (
              <Button type="button" variant="secondary" onClick={() => setReg((r) => !r)} disabled={loading}>
                {reg ? "Use sign-in" : "Register (open)"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                clearSession();
                setErr(null);
              }}
            >
              Clear session
            </Button>
          </div>
          <p className="text-sm text-ink-muted m-0">
            <Link to="/dashboard" className="text-accent underline">
              Back to dashboard
            </Link>
          </p>
        </form>
      </SectionWrapper>
    </div>
  );
}
