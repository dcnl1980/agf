/**
 * Control plane API. In dev, Vite proxies `/api` to the service on :4000.
 * In production, set `VITE_CONTROL_PLANE_API_BASE` to the API origin, e.g. `https://cp.example.com`
 * (requests go to `https://cp.example.com/api/...`).
 */
const ORIGIN = (import.meta.env.VITE_CONTROL_PLANE_API_BASE as string | undefined)?.replace(/\/$/, "");
const API = ORIGIN ? `${ORIGIN}/api` : "/api";

const JWT_KEY = "agf_control_plane_jwt";
const REFRESH_KEY = "agf_control_plane_rt";

/** Configurable default customer for dev/demo flows. */
export const DEFAULT_CUSTOMER_ID =
  (import.meta.env.VITE_DEFAULT_CUSTOMER_ID as string | undefined)?.trim() || "cust_dev";

function bearerFromStorage(): string | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }
  return sessionStorage.getItem(JWT_KEY) || undefined;
}

export function authHeaders(): HeadersInit {
  const h: Record<string, string> = { accept: "application/json" };
  const jwt = bearerFromStorage();
  const key = import.meta.env.VITE_CONTROL_PLANE_API_KEY as string | undefined;
  if (jwt) {
    h.authorization = `Bearer ${jwt}`;
  } else if (key) {
    h.authorization = `Bearer ${key}`;
  }
  return h;
}

function redirectUnauthorized() {
  if (typeof window === "undefined") {
    return;
  }
  const next = window.location.pathname + window.location.search;
  if (window.location.pathname === "/login") {
    return;
  }
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

function storeTokenPair(
  j: { accessToken?: string; refreshToken?: string; expiresIn?: string; refreshExpiresAt?: string }
) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  if (j.accessToken) {
    sessionStorage.setItem(JWT_KEY, j.accessToken);
  }
  if (j.refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, j.refreshToken);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** Refresh access token using stored refresh token. Returns true if a new access token is stored. */
export async function tryRefreshSession(): Promise<boolean> {
  if (typeof sessionStorage === "undefined") {
    return false;
  }
  const rt = sessionStorage.getItem(REFRESH_KEY);
  if (!rt) {
    return false;
  }
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    const res = await fetch(`${API}/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      return false;
    }
    const j = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    storeTokenPair(j);
    return Boolean(j.accessToken);
  })().then((r) => {
    refreshInFlight = null;
    return r;
  });
  return refreshInFlight;
}

export type PublicConfig = {
  authRequired: boolean;
  passwordLoginEnabled: boolean;
  jwtSigningConfigured: boolean;
  apiKeyConfigured: boolean;
  userAccountCount: number;
  openRegistration: boolean;
  openRegistrationCustomerConfigured?: boolean;
  accessTokenTtl?: string;
  platformAdminsConfigured?: boolean;
};

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await fetch(`${API}/v1/public/config`);
  if (!res.ok) {
    throw new Error(`public config ${res.status}`);
  }
  return res.json() as Promise<PublicConfig>;
}

/** Email + password (multi-tenant users). */
export async function loginWithEmailPassword(email: string, password: string): Promise<void> {
  const res = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `login ${res.status}`);
  }
  const j = (await res.json()) as { accessToken?: string; refreshToken?: string };
  if (!j.accessToken) {
    throw new Error("no accessToken in response");
  }
  storeTokenPair(j);
}

/** @deprecated use `loginWithSharedPassword` */
export const loginWithPassword = loginWithSharedPassword;

/** Shared dashboard password (legacy) when the API is configured for it. */
export async function loginWithSharedPassword(password: string): Promise<void> {
  const res = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `login ${res.status}`);
  }
  const j = (await res.json()) as { accessToken?: string; refreshToken?: string };
  if (!j.accessToken) {
    throw new Error("no accessToken in response");
  }
  storeTokenPair(j);
}

export async function registerOpenAccount(
  email: string,
  password: string
): Promise<void> {
  const res = await fetch(`${API}/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `register ${res.status}`);
  }
  const j = (await res.json()) as { accessToken?: string; refreshToken?: string };
  if (j.accessToken) {
    storeTokenPair(j);
  }
}

export async function fetchRuleFileText(
  path: string,
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ path: string; text: string }> {
  const p = new URLSearchParams();
  p.set("path", path);
  return getJson(`${customerBase(customerId)}/agf/rule-file?${p.toString()}`);
}

export async function validateRuleFiles(
  ruleFiles: string[],
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ ok: true; paths: string[] } | { ok: false; file?: string; message: string }> {
  const res = await withAuthFetch(`${customerBase(customerId)}/bundles/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruleFiles }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (res.status === 400) {
    return (await res.json()) as { ok: false; file?: string; message: string };
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "validate");
  }
  return (await res.json()) as { ok: true; paths: string[] };
}

export function clearSession() {
  sessionStorage.removeItem(JWT_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

const customerBase = (customerId: string) => `${API}/v1/customers/${customerId}`;

async function withAuthFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...authHeaders(), ...init.headers } as HeadersInit;
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401 && (await tryRefreshSession())) {
    res = await fetch(url, { ...init, headers: { ...authHeaders(), ...init.headers } as HeadersInit });
  }
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await withAuthFetch(path, { method: "GET" });
  if (res.status === 401) {
    redirectUnauthorized();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type MeResponse =
  | { kind: "anonymous"; authNotRequired: true }
  | { kind: "apikey" }
  | { kind: "legacy"; roles: string[] }
  | {
      id: string;
      email: string;
      kind: "user";
      memberships: { customerId: string; role: string; createdAt: string }[];
    };

export async function fetchMe(): Promise<MeResponse> {
  return getJson(`${API}/v1/auth/me`);
}

/**
 * Current session without redirecting to /login. Returns null if unauthenticated (401).
 * Use on public pages (e.g. marketplace) where anonymous browsing must stay on-page.
 */
export async function fetchMeSession(): Promise<MeResponse | null> {
  const res = await fetch(`${API}/v1/auth/me`, { headers: authHeaders() });
  if (res.status === 401) {
    if (await tryRefreshSession()) {
      const res2 = await fetch(`${API}/v1/auth/me`, { headers: authHeaders() });
      if (res2.status === 200) {
        return res2.json() as Promise<MeResponse>;
      }
    }
    return null;
  }
  if (res.status !== 200) {
    return null;
  }
  return res.json() as Promise<MeResponse>;
}

export type PublishPolicyBundleResult = {
  publicBundleId: string;
  bundleVersion: string;
  digest: string;
  state?: string;
  publishedBy?: string | null;
  deduped?: boolean;
};

/** POST /bundles (direct publish, no ruleset workflow). Requires policy_author or admin (or API key). */
export async function publishPolicyBundle(
  body: { publicBundleId: string; bundleVersion: string; ruleFiles: string[] },
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<PublishPolicyBundleResult> {
  const res = await withAuthFetch(`${customerBase(customerId)}/bundles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (res.status === 400) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "bundle publish rejected");
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `publish bundle ${res.status}`);
  }
  return res.json() as Promise<PublishPolicyBundleResult>;
}

export function canPublishPolicyBundle(
  me: MeResponse | null,
  customerId: string,
  options?: { authRequired?: boolean }
): boolean {
  if (options?.authRequired === false) {
    return true;
  }
  if (!me) {
    return false;
  }
  if (me.kind === "anonymous") {
    return false;
  }
  if (me.kind === "apikey") {
    return true;
  }
  if (me.kind === "legacy") {
    return me.roles.includes("admin") || me.roles.includes("policy_author");
  }
  if (me.kind === "user") {
    const m = me.memberships.find((x) => x.customerId === customerId);
    return m?.role === "admin" || m?.role === "policy_author";
  }
  return false;
}

export async function logoutControlPlaneApi(): Promise<void> {
  const rt = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(REFRESH_KEY) : null;
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  const bt = bearerFromStorage();
  if (bt) {
    headers.authorization = `Bearer ${bt}`;
  }
  try {
    await fetch(`${API}/v1/auth/logout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken: rt || "" }),
    });
  } finally {
    clearSession();
  }
}

export async function changePasswordCurrent(currentPassword: string, newPassword: string): Promise<void> {
  const res = await withAuthFetch(`${API}/v1/auth/change-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "change password");
  }
  const j = (await res.json()) as { accessToken?: string; refreshToken?: string };
  storeTokenPair(j);
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; resetToken?: string }> {
  const res = await fetch(`${API}/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "forgot");
  }
  return (await res.json()) as { ok: boolean; resetToken?: string };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API}/v1/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "reset");
  }
  await res.json();
}

export async function acceptOrgInvite(
  token: string,
  password: string
): Promise<{ userId: string; accessToken?: string }> {
  const res = await fetch(`${API}/v1/auth/accept-invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "accept");
  }
  const j = (await res.json()) as { userId: string; accessToken?: string; refreshToken?: string };
  storeTokenPair(j);
  return j;
}

export type CustomerRow = { id: string; name: string; createdAt: string; metadataJson?: string | null };

export async function fetchCustomers(): Promise<{ items: CustomerRow[] }> {
  return getJson(`${API}/v1/customers`);
}

export type DashboardSummary = {
  totalDecisions: number;
  allowCount: number;
  blockCount: number;
  passRateBps: number;
  pendingApprovals: number;
};

export type DecisionRow = {
  id: string;
  entityId: string;
  decision: string;
  bundleId: string;
  createdAt: string;
  proofHash: string;
  chainHash?: string;
  signature?: string;
};

export type ApprovalRow = {
  id: string;
  title: string;
  agentId: string;
  status: string;
  createdAt: string;
  decisionRef?: string;
};

export type KernelHealth = {
  reachable: boolean;
  agfBaseUrl: string;
  agf?: { status?: string; version?: string };
  error?: string;
};

export async function fetchDashboardSummary(
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<DashboardSummary> {
  return getJson(`${customerBase(customerId)}/dashboard/summary`);
}

export async function fetchDecisions(
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ items: DecisionRow[] }> {
  return getJson(`${customerBase(customerId)}/decisions?limit=50`);
}

export async function fetchApprovals(
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ items: ApprovalRow[] }> {
  return getJson(`${customerBase(customerId)}/approvals`);
}

export type AgentRow = {
  agentId: string;
  customerId: string;
  name: string;
  status: string;
  orgId: string | null;
  channels: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function fetchAgents(
  customerId: string = DEFAULT_CUSTOMER_ID,
  opts: { includeInactive?: boolean } = {}
): Promise<{ items: AgentRow[] }> {
  const q = opts.includeInactive ? "?includeInactive=1" : "";
  return getJson(`${customerBase(customerId)}/agents${q}`);
}

export async function registerAgent(
  input: {
    agent_name: string;
    org_id?: string;
    channels?: string[];
    metadata?: Record<string, unknown>;
  },
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ agent_id: string; status: string; agent: AgentRow }> {
  const res = await withAuthFetch(`${customerBase(customerId)}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `register agent failed: ${res.status}`);
  }
  return res.json() as Promise<{ agent_id: string; status: string; agent: AgentRow }>;
}

export async function deactivateAgent(
  agentId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ agent_id: string; status: string }> {
  const res = await withAuthFetch(`${customerBase(customerId)}/agents/${encodeURIComponent(agentId)}/deactivate`, {
    method: "POST",
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `deactivate failed: ${res.status}`);
  }
  return res.json() as Promise<{ agent_id: string; status: string }>;
}

export async function fetchKernelHealth(): Promise<KernelHealth> {
  return getJson(`${API}/v1/kernel/health`);
}

export async function resolveApproval(
  id: string,
  resolution: "approved" | "rejected",
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<{ id: string; status: string; resolvedAt: string }> {
  const res = await withAuthFetch(`${customerBase(customerId)}/approvals/${id}/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resolution }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    throw new Error(`resolve failed: ${res.status}`);
  }
  return res.json() as Promise<{ id: string; status: string; resolvedAt: string }>;
}

export type EvaluatePayload = {
  publicBundleId: string;
  entityId: number;
  entityName?: string;
  data: Record<string, number>;
  /** When set, creates a pending approval + optional `approval.created` webhook after evaluate. */
  hitl?: { title: string; agentId?: string };
};

export async function runEvaluate(
  body: EvaluatePayload,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await withAuthFetch(`${customerBase(customerId)}/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      publicBundleId: body.publicBundleId,
      entityId: body.entityId,
      entityName: body.entityName,
      data: body.data,
      hitl: body.hitl,
    }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `evaluate ${res.status}`);
  }
  return res.json() as Promise<{
    decisionId: string;
    platformDecision: string;
    agf: unknown;
  }>;
}

/** URL path for evidence JSON export. */
export function getEvidenceExportUrl(
  customerId: string = DEFAULT_CUSTOMER_ID,
  from?: string,
  to?: string
): string {
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const q = p.toString();
  return `${customerBase(customerId)}/evidence/export${q ? `?${q}` : ""}`;
}

export async function downloadEvidenceExport(
  customerId: string = DEFAULT_CUSTOMER_ID,
  from?: string,
  to?: string
) {
  const res = await withAuthFetch(getEvidenceExportUrl(customerId, from, to), { method: "GET" });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    throw new Error(`export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `agf-evidence-${customerId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export type ExportJobListItem = {
  id: string;
  status: string;
  fromTs: string | null;
  toTs: string | null;
  errorText: string | null;
  createdAt: string;
  completedAt: string | null;
};

export async function fetchEvidenceExportJobs(
  customerId: string = DEFAULT_CUSTOMER_ID,
  limit = 15
): Promise<{ items: ExportJobListItem[] }> {
  return getJson(`${customerBase(customerId)}/evidence/exports?limit=${limit}`);
}

export async function startAsyncEvidenceExport(
  customerId: string = DEFAULT_CUSTOMER_ID,
  from?: string,
  to?: string
): Promise<{ jobId: string; status: string; downloadPath: string; completedAt?: string }> {
  const res = await withAuthFetch(`${customerBase(customerId)}/evidence/exports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from: from ?? null, to: to ?? null }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "export job");
  }
  return res.json() as Promise<{
    jobId: string;
    status: string;
    downloadPath: string;
    completedAt?: string;
  }>;
}

export function getEvidenceExportJobDownloadUrl(
  jobId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
): string {
  return `${customerBase(customerId)}/evidence/exports/${jobId}/download`;
}

export async function downloadEvidenceExportByJobId(
  jobId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
): Promise<void> {
  const res = await withAuthFetch(getEvidenceExportJobDownloadUrl(jobId, customerId), { method: "GET" });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    throw new Error(`export download ${res.status}`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `agf-evidence-${jobId}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- rulesets ---

export type RulesetListItem = { id: string; name: string; createdAt: string };
export type RulesetVersionRow = {
  id: string;
  versionLabel: string;
  state: string;
  createdAt: string;
  publishedBundleFk: string | null;
};

export type PublishedBundleInfo = {
  id: string;
  publicBundleId: string;
  bundleVersion: string;
  digest: string;
  publishedAt: string;
  rulesetVersionId: string | null;
  ruleFiles: string[] | null;
};

export type RulesetVersionDetail = {
  id: string;
  rulesetId: string;
  versionLabel: string;
  state: string;
  createdAt: string;
  publishedBundle: PublishedBundleInfo | null;
};

export async function fetchRulesetVersionDetail(
  rulesetId: string,
  versionId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  return getJson<RulesetVersionDetail>(`${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}`);
}

export async function fetchRulesets(customerId: string = DEFAULT_CUSTOMER_ID) {
  return getJson<{ items: RulesetListItem[] }>(`${customerBase(customerId)}/rulesets`);
}

export async function createRulesetApi(name: string, customerId: string = DEFAULT_CUSTOMER_ID) {
  const res = await withAuthFetch(`${customerBase(customerId)}/rulesets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "create ruleset");
  }
  return res.json() as Promise<{ id: string; name: string }>;
}

export async function fetchRulesetVersions(rulesetId: string, customerId: string = DEFAULT_CUSTOMER_ID) {
  return getJson<{ items: RulesetVersionRow[] }>(`${customerBase(customerId)}/rulesets/${rulesetId}/versions`);
}

export async function createRulesetVersionApi(
  rulesetId: string,
  versionLabel: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await withAuthFetch(`${customerBase(customerId)}/rulesets/${rulesetId}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ versionLabel }),
  });
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "create version");
  }
  return res.json() as Promise<RulesetVersionRow>;
}

function postNoBody(url: string) {
  return withAuthFetch(url, { method: "POST", headers: { "content-type": "application/json" } });
}

export async function submitRulesetReview(
  rulesetId: string,
  versionId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await postNoBody(
    `${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}/submit-review`
  );
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "submit");
  }
  return res.json();
}

export async function approveRulesetReview(
  rulesetId: string,
  versionId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await postNoBody(
    `${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}/approve-review`
  );
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "approve");
  }
  return res.json();
}

export async function publishRulesetVersion(
  rulesetId: string,
  versionId: string,
  body: { publicBundleId: string; bundleVersion: string; ruleFiles: string[] },
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await withAuthFetch(
    `${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}/publish`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "publish");
  }
  return res.json();
}

export async function deprecateRulesetVersion(
  rulesetId: string,
  versionId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await postNoBody(
    `${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}/deprecate`
  );
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "deprecate");
  }
  return res.json();
}

export async function retireRulesetVersion(
  rulesetId: string,
  versionId: string,
  customerId: string = DEFAULT_CUSTOMER_ID
) {
  const res = await postNoBody(
    `${customerBase(customerId)}/rulesets/${rulesetId}/versions/${versionId}/retire`
  );
  if (res.status === 401) {
    redirectUnauthorized();
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "retire");
  }
  return res.json();
}
