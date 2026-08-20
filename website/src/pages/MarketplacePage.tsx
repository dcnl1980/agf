import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Copy, Search, Store } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { catalogHttpPath } from "../lib/catalogApi";
import {
  DEFAULT_CUSTOMER_ID,
  canPublishPolicyBundle,
  fetchCustomers,
  fetchMeSession,
  fetchPublicConfig,
  publishPolicyBundle,
  type MeResponse,
  type PublishPolicyBundleResult,
} from "../lib/controlPlaneApi";
import { communityCatalog } from "../lib/marketplaceCatalog";
import type { CatalogEntry, CatalogVersion } from "../lib/marketplaceTypes";

function latestVersion(entry: CatalogEntry): CatalogVersion | null {
  return entry.versions[0] ?? null;
}

function installPayload(entry: CatalogEntry, version: CatalogVersion) {
  return {
    publicBundleId: entry.id,
    bundleVersion: version.version,
    ruleFiles: version.ruleFiles,
  };
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // no-op; button remains useful as visible text fallback
  }
}

export default function MarketplacePage() {
  const { entryId: entryIdParam } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(communityCatalog.entries[0]?.id ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null | undefined>(undefined);
  const [authRequired, setAuthRequired] = useState(true);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [importCustomerId, setImportCustomerId] = useState(DEFAULT_CUSTOMER_ID);
  const [importLoading, setImportLoading] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<PublishPolicyBundleResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [session, cfg] = await Promise.all([fetchMeSession(), fetchPublicConfig()]);
        setMe(session);
        setAuthRequired(cfg.authRequired);
        if (session?.kind === "user" && cfg.authRequired) {
          try {
            const { items } = await fetchCustomers();
            setCustomerNames(Object.fromEntries(items.map((c) => [c.id, c.name])));
          } catch {
            setCustomerNames({});
          }
        }
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return communityCatalog.entries;
    }
    return communityCatalog.entries.filter((entry) => {
      const blob = [
        entry.id,
        entry.summary,
        entry.maintainer,
        entry.license,
        ...(entry.tags ?? []),
        ...(entry.jurisdiction ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [query]);

  const selected = useMemo(() => {
    if (entryIdParam) {
      return communityCatalog.entries.find((e) => e.id === entryIdParam) ?? null;
    }
    return filtered.find((x) => x.id === selectedId) ?? filtered[0] ?? null;
  }, [entryIdParam, selectedId, filtered]);

  const version = selected ? latestVersion(selected) : null;

  const copy = async (key: string, text: string) => {
    await copyToClipboard(text);
    setCopied(key);
    window.setTimeout(() => setCopied((v) => (v === key ? null : v)), 1200);
  };

  const installJson =
    selected && version
      ? JSON.stringify(installPayload(selected, version), null, 2)
      : "";

  const curlSnippet =
    selected && version
      ? [
          "curl -X POST \"${CONTROL_PLANE_BASE}/api/v1/customers/${CUSTOMER_ID}/bundles\" \\",
          "  -H \"Authorization: Bearer ${TOKEN}\" \\",
          "  -H \"Content-Type: application/json\" \\",
          `  -d '${JSON.stringify(installPayload(selected, version))}'`,
        ].join("\n")
      : "";

  const importOptions = useMemo(() => {
    if (!authRequired) {
      return [{ id: DEFAULT_CUSTOMER_ID, label: `${DEFAULT_CUSTOMER_ID} (API auth disabled)` }];
    }
    if (!me || me.kind === "anonymous") {
      return [];
    }
    if (me.kind === "apikey") {
      return [{ id: DEFAULT_CUSTOMER_ID, label: DEFAULT_CUSTOMER_ID }];
    }
    if (me.kind === "legacy") {
      if (me.roles.includes("admin") || me.roles.includes("policy_author")) {
        return [{ id: DEFAULT_CUSTOMER_ID, label: DEFAULT_CUSTOMER_ID }];
      }
      return [];
    }
    if (me.kind === "user") {
      return me.memberships
        .filter((m) => m.role === "admin" || m.role === "policy_author")
        .map((m) => ({
          id: m.customerId,
          label: customerNames[m.customerId] ? `${customerNames[m.customerId]} (${m.customerId})` : m.customerId,
        }));
    }
    return [];
  }, [me, authRequired, customerNames]);

  useEffect(() => {
    if (importOptions.length > 0 && !importOptions.some((o) => o.id === importCustomerId)) {
      setImportCustomerId(importOptions[0].id);
    }
  }, [importOptions, importCustomerId]);

  const sessionReady = me !== undefined;
  const canImport =
    sessionReady &&
    Boolean(selected && version) &&
    importOptions.length > 0 &&
    canPublishPolicyBundle(me ?? null, importCustomerId, { authRequired });

  const loginNext =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search || ""}`
      : "/marketplace";

  const catalogListUrl =
    typeof window !== "undefined" ? `${window.location.origin}${catalogHttpPath("/v1/entries")}` : catalogHttpPath("/v1/entries");

  return (
    <div className="flex flex-col bg-surface-navy w-full text-ink min-h-screen">
      <section className="relative pt-24 pb-10 border-b border-border/50 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5 text-accent" />
            <Badge variant="outline" className="text-sky-400 border-sky-500/50">
              Marketplace
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white m-0">Community ruleset catalog</h1>
          <p className="text-ink-secondary mt-2 max-w-3xl m-0">
            Discover ARSL bundle listings, pin versions, and copy import snippets for your own organization.
            Catalog entries are community metadata, not legal certification.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-6 w-full">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by id, tags, maintainer, jurisdiction..."
            className="pl-9 bg-surface-card border-border text-white"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="bg-surface-card border-border">
            <CardHeader>
              <CardTitle className="text-white text-lg">Listings ({filtered.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-ink-secondary m-0">No catalog entries match your search.</p>
              ) : (
                filtered.map((entry) => {
                  const isActive = selected?.id === entry.id;
                  const latest = latestVersion(entry);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(entry.id);
                        navigate(`/marketplace/${encodeURIComponent(entry.id)}`);
                      }}
                      className={`w-full text-left rounded-lg border p-4 transition ${
                        isActive
                          ? "border-sky-500/70 bg-sky-500/10"
                          : "border-border hover:border-sky-500/40 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white m-0 break-all">{entry.id}</p>
                        {latest ? (
                          <Badge variant="outline" className="text-emerald-300 border-emerald-500/50">
                            {latest.version}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-ink-secondary mt-2 mb-0">{entry.summary}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(entry.tags ?? []).slice(0, 4).map((tag) => (
                          <Badge key={`${entry.id}-${tag}`} variant="outline" className="text-xs border-border text-ink-secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-surface-card border-border">
            <CardHeader>
              <CardTitle className="text-white text-lg">Listing detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entryIdParam && !selected ? (
                <p className="text-sm text-amber-200 m-0">
                  No catalog entry matches this link.{" "}
                  <button type="button" className="underline" onClick={() => navigate("/marketplace")}>
                    Back to catalog
                  </button>
                </p>
              ) : !selected || !version ? (
                <p className="text-sm text-ink-secondary m-0">Select a listing to inspect version and install details.</p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-ink-muted mb-1">ID</p>
                      <p className="text-sm text-white break-all m-0">{selected.id}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      onClick={() => {
                        const url = `${window.location.origin}/marketplace/${encodeURIComponent(selected.id)}`;
                        void copy("link", url);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      {copied === "link" ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-ink-muted mb-1">Latest version</p>
                      <p className="text-white m-0">{version.version}</p>
                    </div>
                    <div>
                      <p className="text-ink-muted mb-1">Maintainer</p>
                      <p className="text-white m-0">{selected.maintainer}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-ink-muted text-sm mb-1">Digest</p>
                    <code className="text-xs text-sky-200 break-all">{version.digest}</code>
                  </div>
                  <div>
                    <p className="text-ink-muted text-sm mb-1">Rule files</p>
                    <ul className="text-xs text-white/90 space-y-1 pl-4">
                      {version.ruleFiles.map((rf) => (
                        <li key={rf}>
                          <code>{rf}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-ink-muted text-sm mb-1">Source URL</p>
                    <a href={version.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-300 hover:underline break-all">
                      {version.sourceUrl}
                    </a>
                  </div>

                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-100 text-xs flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="m-0">
                      Marketplace metadata does not certify legal compliance. Always validate and pin by digest before using
                      bundles in production.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-black/30 p-3 space-y-2">
                    <p className="text-sm text-ink-muted m-0 font-medium">Catalog HTTP API (Phase B)</p>
                    <p className="text-xs text-ink-secondary m-0">
                      Read-only index: <code className="text-sky-200/90">{catalogHttpPath("/v1/entries")}</code> (same origin when
                      the catalog service is deployed behind the site).{" "}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-sky-300"
                        onClick={() => void copy("caturl", catalogListUrl)}
                      >
                        {copied === "caturl" ? "Copied" : "Copy full URL"}
                      </Button>
                    </p>
                  </div>

                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-3">
                    <p className="text-sm text-white m-0 font-medium">Import into your control plane</p>
                    {!sessionReady ? (
                      <p className="text-xs text-ink-muted m-0">Checking session…</p>
                    ) : authRequired && (me === null || me.kind === "anonymous") ? (
                      <p className="text-xs text-ink-secondary m-0">
                        Sign in with an account that has <strong className="text-ink">policy author</strong> or{" "}
                        <strong className="text-ink">admin</strong> on an organization to publish this bundle.{" "}
                        <Link to={`/login?next=${encodeURIComponent(loginNext)}`} className="text-sky-300 hover:underline">
                          Log in
                        </Link>
                      </p>
                    ) : authRequired && importOptions.length === 0 ? (
                      <p className="text-xs text-amber-100/90 m-0">
                        Your account does not have publish access (policy author or admin) on any organization.
                      </p>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="import-org" className="text-ink-muted text-xs">
                            Customer / org
                          </Label>
                          <Select
                            id="import-org"
                            className="mt-1"
                            value={importCustomerId}
                            onChange={(e) => setImportCustomerId(e.target.value)}
                          >
                            {importOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          type="button"
                          disabled={!canImport || importLoading}
                          onClick={() =>
                            void (async () => {
                              if (!selected || !version) {
                                return;
                              }
                              setImportErr(null);
                              setImportOk(null);
                              setImportLoading(true);
                              try {
                                const out = await publishPolicyBundle(installPayload(selected, version), importCustomerId);
                                setImportOk(out);
                              } catch (e) {
                                setImportErr(e instanceof Error ? e.message : "import failed");
                              } finally {
                                setImportLoading(false);
                              }
                            })()
                          }
                        >
                          {importLoading ? "Publishing…" : "Publish bundle to org"}
                        </Button>
                        {importErr ? (
                          <p className="text-xs text-rose-300 m-0">{importErr}</p>
                        ) : null}
                        {importOk ? (
                          <p className="text-xs text-emerald-300/90 m-0">
                            Published. Digest <code className="text-emerald-200">{importOk.digest}</code> — matches catalog when
                            files are unchanged.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink-muted m-0">Import payload (JSON)</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => void copy("json", installJson)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        {copied === "json" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="text-xs bg-black/60 border border-border rounded-md p-3 overflow-x-auto text-white m-0">
{installJson}
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-ink-muted m-0">Install snippet (curl)</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => void copy("curl", curlSnippet)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        {copied === "curl" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <pre className="text-xs bg-black/60 border border-border rounded-md p-3 overflow-x-auto text-white m-0">
{curlSnippet}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
