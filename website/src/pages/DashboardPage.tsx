import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  LayoutDashboard,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { SectionWrapper } from "../components/layout/SectionWrapper";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  DEFAULT_CUSTOMER_ID,
  downloadEvidenceExport,
  downloadEvidenceExportByJobId,
  fetchApprovals,
  fetchDashboardSummary,
  fetchDecisions,
  fetchEvidenceExportJobs,
  fetchKernelHealth,
  resolveApproval,
  runEvaluate,
  startAsyncEvidenceExport,
  type ApprovalRow,
  type DecisionRow,
  type ExportJobListItem,
  type KernelHealth,
} from "../lib/controlPlaneApi";
import { DEMO_ACME_ENTITY_DATA } from "../lib/demoEntityData";

function formatBps(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [kernel, setKernel] = useState<KernelHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalHint, setEvalHint] = useState<string | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportJobListItem[]>([]);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [s, d, a, k, ex] = await Promise.all([
        fetchDashboardSummary(),
        fetchDecisions(),
        fetchApprovals(),
        fetchKernelHealth().catch((): KernelHealth => ({
          reachable: false,
          agfBaseUrl: "",
          error: "unavailable",
        })),
        fetchEvidenceExportJobs().catch((): { items: ExportJobListItem[] } => ({ items: [] })),
      ]);
      setSummary(s);
      setDecisions(d.items);
      setApprovals(a.items.filter((x) => x.status === "pending"));
      setKernel(k);
      setExportJobs(ex.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onResolve = async (id: string, resolution: "approved" | "rejected") => {
    setResolving(id);
    try {
      await resolveApproval(id, resolution, DEFAULT_CUSTOMER_ID);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(null);
    }
  };

  const onRunDemoEvaluate = async () => {
    setEvalHint(null);
    setEvalLoading(true);
    try {
      const out = await runEvaluate(
        {
          publicBundleId: "rb_dev_default",
          entityId: 9001,
          entityName: "Acme Financial Ltd",
          data: DEMO_ACME_ENTITY_DATA,
        },
        DEFAULT_CUSTOMER_ID
      );
      setEvalHint(`Recorded ${out.platformDecision} → ${out.decisionId}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Evaluation failed (is AGF running on :3000?)");
    } finally {
      setEvalLoading(false);
    }
  };

  const onExportEvidence = async () => {
    setEvalHint(null);
    try {
      await downloadEvidenceExport(DEFAULT_CUSTOMER_ID);
      setEvalHint("Downloaded evidence export (JSON, v1 envelope).");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    }
  };

  const onAsyncExport = async () => {
    setEvalHint(null);
    setExportBusy(true);
    try {
      const out = await startAsyncEvidenceExport();
      setEvalHint(`Async export job ${out.jobId} — ${out.status}. Use the list below to download.`);
      const ex = await fetchEvidenceExportJobs();
      setExportJobs(ex.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Async export failed");
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      <section className="relative pt-24 pb-10 border-b border-border/50 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LayoutDashboard className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                  Dev control plane
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white m-0">Operator dashboard</h1>
              <p className="text-ink-secondary mt-2 max-w-2xl m-0">
                Recent verdicts, human-in-the-loop queue, and kernel health. Start the control-plane API and optionally AGF; see{" "}
                <Link to="/architecture" className="text-accent underline">
                  architecture
                </Link>{" "}
                and <code className="text-white/80">docs/DASHBOARD_IMPLEMENTATION_TASKS.md</code>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" size="sm" asChild>
                <Link to="/dashboard/rulesets">Rulesets & publish</Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onRunDemoEvaluate()}
                disabled={evalLoading || !kernel?.reachable}
              >
                {evalLoading ? "Evaluating…" : "Run demo evaluate"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void onExportEvidence()}>
                Export evidence (sync)
              </Button>
              <Button variant="secondary" size="sm" disabled={exportBusy} onClick={() => void onAsyncExport()}>
                {exportBusy ? "Starting job…" : "Start async export job"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
          {evalHint && <p className="text-sm text-emerald-400/90 mt-3 m-0 max-w-2xl">{evalHint}</p>}
        </div>
      </section>

      {err && (
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg px-4 py-3 text-amber-200 text-sm flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-100">API unreachable.</strong> Run <code>npm install &amp;&amp; npm start</code> in{" "}
              <code>control-plane/</code> (port 4000) and <code>npm run dev</code> in <code>website/</code> so <code>/api</code> proxies
              correctly. Delete <code>control-plane/data/</code> to re-seed the default published bundle.
              <div className="text-amber-200/80 mt-1">Detail: {err}</div>
            </div>
          </div>
        </div>
      )}

      <SectionWrapper>
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-surface-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink-secondary flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" />
                  Decisions (sample)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white m-0">{summary?.totalDecisions ?? "—"}</p>
                <p className="text-xs text-ink-muted m-0 mt-1">SQLite + Phase B/D wiring</p>
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink-secondary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Allow rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white m-0">
                  {summary != null ? formatBps(summary.passRateBps) : "—"}
                </p>
                <p className="text-xs text-ink-muted m-0 mt-1">
                  ALLOW / (ALLOW+BLOCK) in current sample
                </p>
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink-secondary flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Pending approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white m-0">{summary?.pendingApprovals ?? "—"}</p>
                <p className="text-xs text-ink-muted m-0 mt-1">HITL queue (dev)</p>
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink-secondary flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" />
                  AGF kernel
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kernel?.reachable ? (
                  <p className="text-lg font-semibold text-emerald-400 m-0">Reachable</p>
                ) : (
                  <p className="text-lg font-semibold text-amber-400 m-0">Not connected</p>
                )}
                <p className="text-xs text-ink-muted m-0 mt-1 font-mono truncate" title={kernel?.agfBaseUrl}>
                  {kernel?.agfBaseUrl || "set AGF_KERNEL_URL / run agf-server"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-surface-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-white">Recent decisions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading && !decisions.length ? (
                  <p className="text-ink-secondary text-sm m-0">Loading…</p>
                ) : (
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-sm m-0">
                      <thead>
                        <tr className="border-b border-border text-left text-ink-muted">
                          <th className="p-2 font-medium">Time</th>
                          <th className="p-2 font-medium">Entity</th>
                          <th className="p-2 font-medium">Verdict</th>
                          <th className="p-2 font-medium">Bundle</th>
                          <th className="p-2 font-medium hidden md:table-cell">Proof</th>
                        </tr>
                      </thead>
                      <tbody>
                        {decisions.map((r) => (
                          <tr key={r.id} className="border-b border-border/50">
                            <td className="p-2 text-ink-secondary whitespace-nowrap text-xs">
                              {r.createdAt?.includes("T") ? `${r.createdAt.slice(0, 19)}Z` : r.createdAt}
                            </td>
                            <td className="p-2 font-mono text-xs">{r.entityId}</td>
                            <td className="p-2">
                              <span
                                className={
                                  r.decision === "BLOCK"
                                    ? "text-rose-400"
                                    : r.decision === "REQUIRE_APPROVAL"
                                      ? "text-amber-300"
                                      : "text-emerald-400"
                                }
                              >
                                {r.decision}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-xs text-ink-secondary">{r.bundleId}</td>
                            <td className="p-2 font-mono text-[10px] text-ink-muted max-w-[140px] truncate hidden md:table-cell" title={r.proofHash}>
                              {r.proofHash || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-white">Approvals queue</CardTitle>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <p className="text-ink-secondary text-sm m-0">No pending items.</p>
                ) : (
                  <ul className="space-y-3 m-0 p-0 list-none">
                    {approvals.map((a) => (
                      <li
                        key={a.id}
                        className="border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div>
                          <p className="text-white font-medium m-0">{a.title}</p>
                          <p className="text-xs text-ink-muted m-0">
                            {a.agentId} · {a.id}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={resolving === a.id}
                            onClick={() => void onResolve(a.id, "approved")}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resolving === a.id}
                            onClick={() => void onResolve(a.id, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-surface-card border-border mt-6 max-w-6xl mx-auto w-full">
            <CardHeader>
              <CardTitle className="text-lg text-white">Evidence export jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-secondary m-0 mb-3">
                Exports use the v1 envelope (<code>export_contract</code>, <code>decision_records</code>, <code>manifest_hash</code>).
                Async jobs write to <code>data/exports/</code> on the control-plane host. Webhook deliveries use the outbox (retries
                with backoff; see API <code>GET .../webhooks/outbox</code> for admins).
              </p>
              {exportJobs.length === 0 ? (
                <p className="text-ink-secondary text-sm m-0">No jobs yet. Run &quot;Start async export job&quot; or use sync export.</p>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm m-0">
                    <thead>
                      <tr className="border-b border-border text-left text-ink-muted">
                        <th className="p-2 font-medium">Job</th>
                        <th className="p-2 font-medium">Status</th>
                        <th className="p-2 font-medium">Created</th>
                        <th className="p-2 font-medium w-32">Download</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportJobs.slice(0, 8).map((j) => (
                        <tr key={j.id} className="border-b border-border/50">
                          <td className="p-2 font-mono text-xs">{j.id}</td>
                          <td className="p-2">
                            {j.status}
                            {j.errorText ? (
                              <span className="text-rose-400 text-xs block truncate max-w-[200px]" title={j.errorText}>
                                {j.errorText}
                              </span>
                            ) : null}
                          </td>
                          <td className="p-2 text-ink-secondary text-xs whitespace-nowrap">
                            {j.createdAt?.includes("T") ? j.createdAt.slice(0, 19) : j.createdAt}
                          </td>
                          <td className="p-2">
                            {j.status === "completed" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void (async () => {
                                    setErr(null);
                                    try {
                                      await downloadEvidenceExportByJobId(j.id);
                                    } catch (e) {
                                      setErr(e instanceof Error ? e.message : "Download failed");
                                    }
                                  })()
                                }
                              >
                                JSON
                              </Button>
                            ) : (
                              <span className="text-ink-muted text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-ink-muted mt-8 m-0 text-center">
            Optional: set <code>CONTROL_PLANE_API_KEY</code> and <code>VITE_CONTROL_PLANE_API_KEY</code> to lock the API. See{" "}
            <code>docs/DASHBOARD_IMPLEMENTATION_TASKS.md</code> for the remaining backlog.
          </p>
        </div>
      </SectionWrapper>
    </div>
  );
}
