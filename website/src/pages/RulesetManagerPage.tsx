import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { diffLines } from "diff";
import { AlertCircle, BookOpen, GitBranch, Package, RefreshCw } from "lucide-react";
import { SectionWrapper } from "../components/layout/SectionWrapper";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  DEFAULT_CUSTOMER_ID,
  approveRulesetReview,
  createRulesetApi,
  createRulesetVersionApi,
  deprecateRulesetVersion,
  fetchCustomers,
  fetchRulesetVersionDetail,
  fetchRulesetVersions,
  fetchRulesets,
  fetchRuleFileText,
  publishRulesetVersion,
  retireRulesetVersion,
  submitRulesetReview,
  validateRuleFiles,
  type CustomerRow,
  type RulesetListItem,
  type RulesetVersionDetail,
  type RulesetVersionRow,
} from "../lib/controlPlaneApi";

const RULESET_ORG_KEY = "agf_ruleset_customer_id";

const DEMO_PATHS = `rules/finance/kyc/standard_onboarding.arsl.toml
rules/finance/sanctions/hmt.arsl.toml
rules/finance/fca/consumer_duty.arsl.toml
rules/cross_industry/gdpr/consent.arsl.toml`;

function stateColor(state: string) {
  switch (state) {
    case "PUBLISHED":
      return "text-emerald-400 border-emerald-500/50";
    case "APPROVED":
    case "IN_REVIEW":
      return "text-amber-400 border-amber-500/50";
    case "DEPRECATED":
    case "RETIRED":
      return "text-zinc-400 border-zinc-500/50";
    default:
      return "text-sky-400 border-sky-500/50";
  }
}

export default function RulesetManagerPage() {
  const [orgId, setOrgId] = useState(() => {
    if (typeof sessionStorage === "undefined") {
      return DEFAULT_CUSTOMER_ID;
    }
    return sessionStorage.getItem(RULESET_ORG_KEY) || DEFAULT_CUSTOMER_ID;
  });
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [rulesets, setRulesets] = useState<RulesetListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<RulesetVersionRow[]>([]);
  const [versionDetail, setVersionDetail] = useState<RulesetVersionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newVersionLabel, setNewVersionLabel] = useState("2026.04.0");

  const [pubId, setPubId] = useState("rb_new_bundle");
  const [pubVer, setPubVer] = useState("2026.04.0");
  const [pathText, setPathText] = useState(DEMO_PATHS);
  const [selVersion, setSelVersion] = useState<string | null>(null);

  const [diffPathA, setDiffPathA] = useState("rules/finance/kyc/standard_onboarding.arsl.toml");
  const [diffPathB, setDiffPathB] = useState("");
  const [diffLeft, setDiffLeft] = useState("");
  const [diffRight, setDiffRight] = useState("");
  const [validateHint, setValidateHint] = useState<string | null>(null);

  const diffParts = useMemo(() => diffLines(diffLeft, diffRight), [diffLeft, diffRight]);

  const loadRulesets = useCallback(async (cid: string) => {
    setErr(null);
    const r = await fetchRulesets(cid);
    setRulesets(r.items);
    setSelectedId((prev) => {
      if (prev && r.items.some((x) => x.id === prev)) {
        return prev;
      }
      return r.items[0]?.id ?? null;
    });
  }, []);

  const loadVersions = useCallback(async (rid: string, cid: string) => {
    setErr(null);
    const v = await fetchRulesetVersions(rid, cid);
    setVersions(v.items);
    if (v.items.length) {
      setSelVersion((s) => (s && v.items.some((x) => x.id === s) ? s : v.items[0].id));
    } else {
      setSelVersion(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { items: orgs } = await fetchCustomers();
        setCustomers(orgs);
        let cid = orgId;
        if (orgs.length > 0 && !orgs.some((o) => o.id === cid)) {
          cid = orgs[0].id;
          setOrgId(cid);
        }
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(RULESET_ORG_KEY, cid);
        }
        await loadRulesets(cid);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
        await loadRulesets(orgId).catch(() => {
          /* single-org dev */
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, loadRulesets]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    void loadVersions(selectedId, orgId).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [selectedId, orgId, loadVersions]);

  useEffect(() => {
    if (!selectedId || !selVersion) {
      setVersionDetail(null);
      return;
    }
    let cancel = false;
    void (async () => {
      try {
        const d = await fetchRulesetVersionDetail(selectedId, selVersion, orgId);
        if (!cancel) {
          setVersionDetail(d);
        }
      } catch {
        if (!cancel) {
          setVersionDetail(null);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedId, selVersion, orgId]);

  const setOrg = (id: string) => {
    setOrgId(id);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(RULESET_ORG_KEY, id);
    }
    setSelectedId(null);
    setSelVersion(null);
    setVersionDetail(null);
  };

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setActionKey(key);
    setErr(null);
    try {
      await fn();
      await loadRulesets(orgId);
      if (selectedId) {
        await loadVersions(selectedId, orgId);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setActionKey(null);
    }
  };

  const selectedVersion = versions.find((v) => v.id === selVersion);

  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      <section className="relative pt-24 pb-10 border-b border-border/50 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-accent" />
                <Badge variant="outline" className="text-sky-400 border-sky-500/50">
                  Ruleset lifecycle
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white m-0">Policy bundles &amp; review</h1>
              <p className="text-ink-secondary mt-2 max-w-2xl m-0">
                Authoring is in-repo under <code className="text-white/80">agf-sp1/rules/**</code>. This UI drives{" "}
                <strong>review states</strong> and <strong>publish</strong> (ARSL is validated on the server before the bundle is
                recorded). <strong>Submit review / publish</strong> need policy author (or admin); <strong>Approve</strong> needs
                approver (or admin). For full ARSL editing, use your editor; use this page to move versions through review and pin
                bundles.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="secondary" size="sm" asChild>
                <Link to="/dashboard">Operator dashboard</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadRulesets(orgId).then(() => selectedId && loadVersions(selectedId, orgId))}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg px-4 py-3 text-amber-200 text-sm flex gap-2 items-start">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="m-0">{err}</div>
          </div>
        </div>
      )}

      {customers.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pt-2 flex flex-wrap items-center gap-3">
          <Label htmlFor="org-sel" className="text-sm text-ink-secondary shrink-0 m-0">
            Organization
          </Label>
          <select
            id="org-sel"
            className="bg-surface-card border border-border rounded-md px-3 py-1.5 text-sm text-white max-w-md"
            value={orgId}
            onChange={(e) => setOrg(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      )}

      <SectionWrapper>
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-surface-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                Rulesets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-none p-0 m-0 space-y-2 max-h-48 overflow-y-auto">
                {rulesets.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left rounded-md px-3 py-2 text-sm border ${
                        selectedId === r.id ? "bg-white/10 border-accent/50" : "border-border/60 hover:bg-white/5"
                      }`}
                    >
                      <span className="font-medium text-white">{r.name}</span>
                      <span className="block text-ink-muted text-xs mt-0.5 font-mono">{r.id}</span>
                    </button>
                  </li>
                ))}
                {rulesets.length === 0 && <p className="text-ink-muted text-sm m-0">No rulesets yet.</p>}
              </ul>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="new-rs">New ruleset name</Label>
                  <Input id="new-rs" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. EU retail" />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!newName.trim() || actionKey === "new-rs"}
                  onClick={() =>
                    void run("new-rs", async () => {
                      await createRulesetApi(newName.trim(), orgId);
                      setNewName("");
                    })
                  }
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-accent" />
                Versions (metadata &amp; actions)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedId ? (
                <p className="text-ink-muted text-sm m-0">Select a ruleset.</p>
              ) : (
                <>
                  <ul className="list-none p-0 m-0 space-y-2 max-h-40 overflow-y-auto">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelVersion(v.id)}
                          className={`w-full text-left rounded-md px-3 py-2 text-sm border ${
                            selVersion === v.id ? "bg-white/10 border-accent/50" : "border-border/60 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-white font-medium">{v.versionLabel}</span>
                            <Badge variant="outline" className={stateColor(v.state)}>
                              {v.state}
                            </Badge>
                          </div>
                          <span className="text-ink-muted text-xs font-mono block mt-0.5">{v.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor="vlabel">New version label</Label>
                      <Input id="vlabel" value={newVersionLabel} onChange={(e) => setNewVersionLabel(e.target.value)} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newVersionLabel.trim() || actionKey === "new-ver"}
                      onClick={() =>
                        void run("new-ver", async () => {
                          await createRulesetVersionApi(selectedId, newVersionLabel.trim(), orgId);
                        })
                      }
                    >
                      Add version
                    </Button>
                  </div>

                  {selectedVersion && (
                    <div className="border border-border/60 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-ink-muted m-0">
                        <strong className="text-ink">Diff (lightweight):</strong> compare labels and states in the list above. Full
                        ARSL text diff belongs in code review; paths below must exist under <code>agf-sp1</code> on the control-plane
                        host.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedVersion.state === "DRAFT" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={actionKey === "sr"}
                            onClick={() =>
                              void run("sr", () => submitRulesetReview(selectedId, selectedVersion.id, orgId))
                            }
                          >
                            Submit review
                          </Button>
                        )}
                        {selectedVersion.state === "IN_REVIEW" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={actionKey === "ar"}
                            onClick={() =>
                              void run("ar", () => approveRulesetReview(selectedId, selectedVersion.id, orgId))
                            }
                          >
                            Approve (review)
                          </Button>
                        )}
                        {selectedVersion.state === "PUBLISHED" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionKey === "de"}
                            onClick={() =>
                              void run("de", () => deprecateRulesetVersion(selectedId, selectedVersion.id, orgId))
                            }
                          >
                            Deprecate
                          </Button>
                        )}
                        {selectedVersion.state === "DEPRECATED" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionKey === "rt"}
                            onClick={() =>
                              void run("rt", () => retireRulesetVersion(selectedId, selectedVersion.id, orgId))
                            }
                          >
                            Retire
                          </Button>
                        )}
                      </div>
                      {versionDetail?.publishedBundle && (
                        <div className="mt-3 p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1.5">
                          <p className="m-0 font-medium text-emerald-200/90">Published bundle (immutable pin)</p>
                          <p className="m-0 font-mono text-white/90 break-all">
                            public_bundle_id: {versionDetail.publishedBundle.publicBundleId}
                          </p>
                          <p className="m-0 font-mono text-white/80 break-all">digest: {versionDetail.publishedBundle.digest}</p>
                          <p className="m-0 text-ink-muted">
                            bundle_version {versionDetail.publishedBundle.bundleVersion} ·{" "}
                            {versionDetail.publishedBundle.publishedAt}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface-card border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">ARSL view &amp; line diff (read-only from <code className="text-xs">agf-sp1</code>)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink-muted m-0">
                Load file contents from the control-plane host&apos;s <code>AGF_SP1_ROOT</code>, or paste a proposed variant on the
                right. The unified diff is computed in the browser; publishing still runs <code>arsl-validate</code> on the server.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dpa">Path A (left)</Label>
                  <Input
                    id="dpa"
                    className="mt-1 font-mono text-xs"
                    value={diffPathA}
                    onChange={(e) => setDiffPathA(e.target.value)}
                    placeholder="rules/.../file.arsl.toml"
                  />
                  <Button
                    type="button"
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void (async () => {
                        setErr(null);
                        try {
                          const r = await fetchRuleFileText(diffPathA.trim(), orgId);
                          setDiffLeft(r.text);
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "load failed");
                        }
                      })()
                    }
                  >
                    Load A from disk
                  </Button>
                </div>
                <div>
                  <Label htmlFor="dpb">Path B (optional, right)</Label>
                  <Input
                    id="dpb"
                    className="mt-1 font-mono text-xs"
                    value={diffPathB}
                    onChange={(e) => setDiffPathB(e.target.value)}
                    placeholder="leave empty; paste on the right only"
                  />
                  <Button
                    type="button"
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    disabled={!diffPathB.trim()}
                    onClick={() =>
                      void (async () => {
                        setErr(null);
                        try {
                          const r = await fetchRuleFileText(diffPathB.trim(), orgId);
                          setDiffRight(r.text);
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "load failed");
                        }
                      })()
                    }
                  >
                    Load B from disk
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Left (A)</Label>
                  <Textarea
                    className="mt-1 min-h-[180px] font-mono text-xs"
                    value={diffLeft}
                    onChange={(e) => setDiffLeft(e.target.value)}
                    placeholder="ARSL TOML or load from path"
                  />
                </div>
                <div>
                  <Label>Right (B) — proposed / alternate</Label>
                  <Textarea
                    className="mt-1 min-h-[180px] font-mono text-xs"
                    value={diffRight}
                    onChange={(e) => setDiffRight(e.target.value)}
                    placeholder="paste edited ARSL, or load path B"
                  />
                </div>
              </div>
              <div>
                <Label>Unified line diff</Label>
                <pre className="mt-1 p-3 rounded-md border border-border/60 bg-black/40 text-xs overflow-x-auto max-h-56 overflow-y-auto m-0 whitespace-pre-wrap">
                  {diffParts.length === 0 ? (
                    <span className="text-ink-muted">No diff (both sides empty or identical)</span>
                  ) : (
                    diffParts.map((part, i) => (
                      <span
                        key={i}
                        className={
                          part.added
                            ? "bg-emerald-500/20 text-emerald-200"
                            : part.removed
                              ? "bg-rose-500/20 text-rose-200"
                              : "text-ink/90"
                        }
                      >
                        {part.added ? "+ " : part.removed ? "- " : "  "}
                        {part.value}
                      </span>
                    ))
                  )}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Publish immutable bundle (validates ARSL on server)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink-muted m-0">
                If <code>CONTROL_PLANE_STRICT_RULESET=1</code> is set on the API, the version must be <strong>APPROVED</strong> before
                publish. Otherwise you can publish from earlier states in dev. Each path is one line, relative to <code>agf-sp1</code>{" "}
                (see <code>AGF_SP1_ROOT</code>).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pbi">public_bundle_id</Label>
                  <Input id="pbi" className="mt-1" value={pubId} onChange={(e) => setPubId(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pbv">bundle_version</Label>
                  <Input id="pbv" className="mt-1" value={pubVer} onChange={(e) => setPubVer(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="rpaths">Rule file paths (one per line)</Label>
                <Textarea
                  id="rpaths"
                  className="mt-1 min-h-[140px] font-mono text-xs"
                  value={pathText}
                  onChange={(e) => setPathText(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionKey === "val"}
                  onClick={() =>
                    void (async () => {
                      setValidateHint(null);
                      setActionKey("val");
                      setErr(null);
                      try {
                        const paths = pathText
                          .split("\n")
                          .map((l) => l.trim())
                          .filter(Boolean);
                        if (!paths.length) {
                          throw new Error("at least one path required");
                        }
                        const v = await validateRuleFiles(paths, orgId);
                        if (v.ok) {
                          setValidateHint(`OK — ${v.paths.length} file(s) passed arsl-validate.`);
                        } else {
                          setErr(`Validate failed: ${v.file || "?"} — ${v.message}`);
                        }
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "validate failed");
                      } finally {
                        setActionKey(null);
                      }
                    })()
                  }
                >
                  Validate paths only
                </Button>
                {validateHint && <span className="text-sm text-emerald-400/90">{validateHint}</span>}
              </div>
              <Button
                type="button"
                disabled={!selectedId || !selVersion || actionKey === "pub"}
                onClick={() =>
                  void run("pub", async () => {
                    const paths = pathText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                    if (!paths.length) {
                      throw new Error("at least one path required");
                    }
                    await publishRulesetVersion(
                      selectedId!,
                      selVersion!,
                      { publicBundleId: pubId.trim(), bundleVersion: pubVer.trim(), ruleFiles: paths },
                      orgId
                    );
                  })
                }
              >
                Publish bundle for selected version
              </Button>
            </CardContent>
          </Card>
        </div>
      </SectionWrapper>
    </div>
  );
}
