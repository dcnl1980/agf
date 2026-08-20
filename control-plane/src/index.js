/**
 * AGF control plane — SQLite-backed API for dashboard, bundles, and AGF proxy evaluation.
 * @see docs/DASHBOARD_IMPLEMENTATION_TASKS.md
 */
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import {
  openDb,
  getDb,
  getSummary,
  listDecisions,
  listApprovals,
  insertDecision,
  insertPendingApproval,
  resolveApprovalRow,
  getBundleByPublicId,
  listBundles,
  publishBundle,
  listRulesets,
  createRuleset,
  getRuleset,
  createRulesetVersion,
  getRulesetVersions,
  getRulesetVersion,
  getRulesetVersionDetail,
  setRulesetVersionState,
  createExportJobAndFile,
  getExportJob,
  getExportFilePathForDownload,
  upsertWebhook,
  getWebhookForCustomer,
  listCustomersForScope,
  createCustomer,
  getCustomerById,
  enqueueWebhookOutbox,
  getMembershipsForUser,
  countUsers,
  listUsersForCustomer,
  getUserById,
  createSessionRow,
  hashOpaqueToken,
  newRefreshToken,
  getActiveSessionByRefreshToken,
  revokeSession,
  revokeAllSessionsForUser,
  createPasswordResetRow,
  getPasswordResetByRawToken,
  markPasswordResetUsed,
  createOrgInviteRow,
  updateUserPasswordHash,
  deleteOrgMembership,
  insertAuditLog,
  listAuditForCustomer,
  listExportJobsForCustomer,
  listWebhookOutboxForCustomer,
  upsertOrgMembership,
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deactivateAgent,
  DEFAULT_CUSTOMER_ID,
} from "./db.js";
import { buildEvidenceExportPayload } from "./evidenceExport.js";
import { postEvaluateEntity, mapKernelToPlatform, fetchKernelHealth } from "./agfClient.js";
import { readAgfFileUnderRoot, resolveRuleFiles } from "./paths.js";
import { validateArslFiles } from "./arslValidate.js";
import {
  hasAnyRole,
  verifyBearerJwt,
  getApiKey,
  needsStrictAuth,
  verifyDashboardPassword,
  signDashboardJwt,
  signUserJwt,
  isDashboardPasswordConfigured,
  isJwtSecretConfigured,
  setUsersExistCheck,
  isPlatformAdminEmail,
} from "./auth.js";
import {
  verifyUserPassword,
  tryBootstrapUserFromEnv,
  createUserInOrg,
  completeOrgInvite,
  hashPassword,
  verifyPassword,
  getUserByEmail,
} from "./userAuth.js";
import { startOutboxWorker } from "./webhookOutbox.js";
import { buildRateLimitMiddlewareFromEnv } from "./rateLimit.js";
import { structuredRequestLog } from "./requestLog.js";

const PORT = Number(process.env.PORT) || 4000;

const ACCESS_TTL = process.env.CONTROL_PLANE_ACCESS_JWT_TTL || process.env.CONTROL_PLANE_JWT_TTL || "15m";
const REFRESH_MS = (() => {
  const d = Number(process.env.CONTROL_PLANE_REFRESH_DAYS);
  if (Number.isFinite(d) && d > 0) {
    return d * 24 * 60 * 60 * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
})();
const PASSWORD_RESET_MS = (() => {
  const h = Number(process.env.CONTROL_PLANE_PASSWORD_RESET_HOURS);
  if (Number.isFinite(h) && h > 0) {
    return h * 60 * 60 * 1000;
  }
  return 60 * 60 * 1000;
})();
const INVITE_MS = (() => {
  const d = Number(process.env.CONTROL_PLANE_INVITE_DAYS);
  if (Number.isFinite(d) && d > 0) {
    return d * 24 * 60 * 60 * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
})();

/**
 * @param {string} userId
 */
async function issueTokensForUser(userId) {
  const u = getUserById(userId);
  if (!u) {
    throw new Error("user not found");
  }
  const mem = getMembershipsForUser(userId);
  const access = await signUserJwt(
    {
      sub: u.id,
      email: u.email,
      memberships: mem.map((m) => ({ customerId: m.customerId, role: m.role, createdAt: m.createdAt })),
    },
    { expiresIn: ACCESS_TTL }
  );
  const raw = newRefreshToken();
  const exp = new Date(Date.now() + REFRESH_MS).toISOString();
  createSessionRow(u.id, hashOpaqueToken(raw), exp);
  return {
    accessToken: access,
    refreshToken: raw,
    tokenType: "Bearer",
    expiresIn: ACCESS_TTL,
    refreshExpiresAt: exp,
  };
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authMiddleware(req, res, next) {
  void (async () => {
    try {
      if (!needsStrictAuth()) {
        return next();
      }
      const auth = req.headers.authorization;
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      const apiKey = getApiKey();
      if (apiKey && token === apiKey) {
        req.user = { viaApiKey: true, kind: "apikey" };
        return next();
      }
      const j = await verifyBearerJwt(token || undefined);
      if (j) {
        if (j.kind === "user") {
          req.user = {
            kind: "user",
            sub: j.sub,
            email: j.email,
            memberships: j.memberships,
            roles: [],
          };
        } else {
          req.user = { kind: "legacy", roles: j.roles, memberships: [] };
        }
        return next();
      }
      return res.status(401).json({ error: "unauthorized" });
    } catch (e) {
      next(e);
    }
  })();
}

/**
 * @param {string[]} roles
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!needsStrictAuth()) {
      return next();
    }
    const scope = getAccessScopeCustomerId(req);
    if (hasAnyRole(req.user, roles, scope)) {
      return next();
    }
    return res.status(403).json({ error: "forbidden" });
  };
}

/**
 * customer id from route/query only (no default) — for RBAC scope
 * @param {import("express").Request} req
 */
function getAccessScopeCustomerId(req) {
  if (req.params && req.params.customerId) {
    return req.params.customerId;
  }
  if (req.query && req.query.customerId != null) {
    return String(req.query.customerId);
  }
  return null;
}

/**
 * @param {import("express").Request} req
 */
function getCustomerId(req) {
  return req.params.customerId || req.query.customerId || DEFAULT_CUSTOMER_ID;
}

function getOpenRegistrationCustomerId() {
  return (
    process.env.CONTROL_PLANE_OPEN_REGISTRATION_CUSTOMER ||
    process.env.CONTROL_PLANE_BOOTSTRAP_CUSTOMER ||
    ""
  ).trim();
}

function parseCorsOrigins() {
  return (process.env.CONTROL_PLANE_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isProductionLike() {
  return process.env.NODE_ENV === "production";
}

function looksWeakSecret(value, disallowed = []) {
  const lower = String(value || "").trim().toLowerCase();
  if (!lower) {
    return true;
  }
  if (lower.length < 16) {
    return true;
  }
  const weak = new Set([
    "changeme",
    "change-me",
    "secret",
    "default",
    "password",
    "password123",
    "test",
    "dev",
    "development",
    "minioadmin",
    ...disallowed.map((x) => String(x).trim().toLowerCase()),
  ]);
  return weak.has(lower);
}

export function validateStartupConfig() {
  const apiKey = getApiKey();
  const jwtSecret = process.env.CONTROL_PLANE_JWT_SECRET || "";
  const dashboardPassword = process.env.CONTROL_PLANE_DASHBOARD_PASSWORD || "";
  const corsOrigins = parseCorsOrigins();
  const errors = [];

  if (isProductionLike() && (process.env.CONTROL_PLANE_ALLOW_INSECURE_NO_AUTH === "1" || process.env.CONTROL_PLANE_REQUIRE_AUTH === "0")) {
    errors.push("Refusing to start with authentication disabled in production");
  }
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      errors.push("CONTROL_PLANE_JWT_SECRET must be at least 32 characters");
    } else if (
      isProductionLike() &&
      looksWeakSecret(jwtSecret, ["dev-docker-compose-change-in-prod-32ch"])
    ) {
      errors.push("CONTROL_PLANE_JWT_SECRET must not use a default or weak value in production");
    }
  } else if (!apiKey) {
    errors.push("Set CONTROL_PLANE_JWT_SECRET or CONTROL_PLANE_API_KEY before starting the control plane");
  }
  if (apiKey && (apiKey.length < 24 || looksWeakSecret(apiKey))) {
    errors.push("CONTROL_PLANE_API_KEY must be at least 24 characters and not use a weak value");
  }
  if (dashboardPassword && (dashboardPassword.length < 16 || looksWeakSecret(dashboardPassword))) {
    errors.push("CONTROL_PLANE_DASHBOARD_PASSWORD must be at least 16 characters and not use a weak value");
  }
  if (isProductionLike() && process.env.CONTROL_PLANE_SKIP_ARSL_VALIDATE === "1") {
    errors.push("Refusing to start in production with CONTROL_PLANE_SKIP_ARSL_VALIDATE=1");
  }
  if (process.env.CONTROL_PLANE_OPEN_REGISTRATION === "1" && !getOpenRegistrationCustomerId()) {
    errors.push("CONTROL_PLANE_OPEN_REGISTRATION requires CONTROL_PLANE_OPEN_REGISTRATION_CUSTOMER or CONTROL_PLANE_BOOTSTRAP_CUSTOMER");
  }
  if (isProductionLike() && corsOrigins.includes("*")) {
    errors.push("Wildcard CONTROL_PLANE_CORS_ORIGINS is not allowed in production");
  }
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
}

function buildCorsMiddleware() {
  const origins = parseCorsOrigins();
  if (origins.length === 0) {
    return (_req, _res, next) => next();
  }
  const allowAll = origins.includes("*");
  return cors({
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept"],
    origin(origin, cb) {
      if (!origin) {
        return cb(null, true);
      }
      if (allowAll || origins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    optionsSuccessStatus: 204,
  });
}

/**
 * @param {import("express").Request} req
 * @param {string} customerId
 * @param {string} action
 * @param {string} rulesetId
 * @param {string | null} versionId
 * @param {Record<string, unknown>} [extra]
 */
function auditRulesetLifecycle(req, customerId, action, rulesetId, versionId, extra = {}) {
  let actorType = "system";
  /** @type {string | null} */
  let actorId = null;
  if (req.user && "viaApiKey" in req.user && req.user.viaApiKey) {
    actorType = "apikey";
  } else if (req.user && req.user.kind === "user" && req.user.sub) {
    actorType = "user";
    actorId = req.user.sub;
  }
  insertAuditLog({
    actorType,
    actorId,
    action,
    customerId,
    targetType: "ruleset_version",
    targetId: versionId || rulesetId,
    detail: { rulesetId, versionId, ...extra },
  });
}

/**
 * @param {import("express").Request["user"]} u
 * @returns {string[] | null} null = all orgs
 */
function listCustomerIdsForUser(u) {
  if (!u || u.viaApiKey) {
    return null;
  }
  if (u.kind === "user" && typeof u.email === "string" && isPlatformAdminEmail(u.email)) {
    return null;
  }
  if (u.kind === "legacy" || (u.kind !== "user" && u.roles && u.roles.length)) {
    return null;
  }
  if (u.kind === "user" && u.memberships && u.memberships.length) {
    return u.memberships.map((m) => m.customerId);
  }
  return [];
}

/**
 * @param {string} customerId
 * @param {Awaited<ReturnType<typeof resolveApprovalRow>> extends null ? never : object} row
 */
/**
 * @param {string} customerId
 * @param {string} eventType
 * @param {Record<string, unknown>} row
 */
function dispatchApprovalWebhook(customerId, eventType, row) {
  const dbWh = getWebhookForCustomer(customerId);
  const url = dbWh?.url || process.env.CONTROL_PLANE_WEBHOOK_URL;
  if (!url) {
    return;
  }
  const secret = dbWh?.secret ?? process.env.CONTROL_PLANE_WEBHOOK_SECRET ?? null;
  const idempotencyKey = `${eventType}:${customerId}:${row.id}`;
  const payload = {
    customerId,
    approvalId: row.id,
    status: row.status,
    title: row.title,
    agentId: row.agentId,
  };
  try {
    enqueueWebhookOutbox({ customerId, eventType, url, secret: secret || null, idempotencyKey, payload });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[webhook enqueue]", e instanceof Error ? e.message : e);
  }
}

function strictRulesetGate(rulesetId, versionId, customerId) {
  if (process.env.CONTROL_PLANE_STRICT_RULESET !== "1" || !versionId) {
    return true;
  }
  const v = getRulesetVersion(rulesetId, versionId, customerId);
  if (!v || v.state !== "APPROVED") {
    return false;
  }
  return true;
}

/**
 * Optional enterprise extension hook.
 * If AGF_ENTERPRISE_MODULE is unset, the control plane runs in OSS mode.
 * @param {import("express").Express} app
 */
async function loadEnterpriseExtensions(app) {
  const modulePath = process.env.AGF_ENTERPRISE_MODULE;
  if (!modulePath) {
    return { loaded: false };
  }
  const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
  let mod;
  try {
    mod = await import(pathToFileURL(resolved).href);
  } catch (e) {
    throw new Error(
      `failed to import AGF_ENTERPRISE_MODULE (${resolved}): ${e instanceof Error ? e.message : String(e)}`
    );
  }
  const register = mod?.registerControlPlaneExtensions || mod?.default;
  if (typeof register !== "function") {
    throw new Error(
      "AGF_ENTERPRISE_MODULE must export default(ctx) or registerControlPlaneExtensions(ctx)"
    );
  }
  await register({ app, express, getDb, env: process.env });
  return { loaded: true, resolved };
}

async function main() {
  const { app, enterprise } = await createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`agf-control-plane (sqlite) on http://127.0.0.1:${PORT}`);
    if (getApiKey()) {
      // eslint-disable-next-line no-console
      console.log("CONTROL_PLANE_API_KEY is set: Bearer or JWT required for /api/*");
    }
    if (isDashboardPasswordConfigured()) {
      // eslint-disable-next-line no-console
      console.log("CONTROL_PLANE_DASHBOARD_PASSWORD is set: use POST /api/v1/auth/login for JWT");
    }
    if (enterprise.loaded) {
      // eslint-disable-next-line no-console
      console.log(`AGF_ENTERPRISE_MODULE loaded from ${enterprise.resolved}`);
    } else {
      // eslint-disable-next-line no-console
      console.log("AGF_ENTERPRISE_MODULE not set: running OSS-only control plane");
    }
    startOutboxWorker(2500);
  });
}

export async function createApp() {
  validateStartupConfig();
  openDb();
  setUsersExistCheck(() => countUsers() > 0);
  tryBootstrapUserFromEnv();
  const app = express();
  app.use(buildCorsMiddleware());
  app.use(express.json({ limit: "2mb" }));
  app.use(structuredRequestLog);
  const rateLimits = buildRateLimitMiddlewareFromEnv();

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "agf-control-plane",
      storage: "sqlite",
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  app.get("/ready", (_req, res) => {
    try {
      getDb().prepare("SELECT 1").get();
      return res.json({ status: "ready", service: "agf-control-plane" });
    } catch (e) {
      return res.status(503).json({
        status: "not_ready",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // Auth endpoints use a stricter bucket; other /api routes use the general bucket.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/v1/auth")) {
      return rateLimits.auth(req, res, next);
    }
    if (req.path.startsWith("/api")) {
      return rateLimits.api(req, res, next);
    }
    return next();
  });

  app.post("/api/v1/auth/login", async (req, res) => {
    if (!isJwtSecretConfigured()) {
      return res.status(503).json({ error: "jwt_secret_not_configured" });
    }
    const email = req.body?.email;
    const password = req.body?.password;
    if (email != null && password != null && typeof email === "string") {
      const e = String(email).trim();
      if (!e || typeof password !== "string") {
        return res.status(400).json({ error: "email and password required" });
      }
      const u = verifyUserPassword(e, password);
      if (!u) {
        return res.status(401).json({ error: "invalid_credentials" });
      }
      try {
        const out = await issueTokensForUser(u.id);
        return res.json(out);
      } catch (e2) {
        return res.status(500).json({ error: e2 instanceof Error ? e2.message : "sign_failed" });
      }
    }
    if (isDashboardPasswordConfigured() && password != null && typeof password === "string") {
      if (!verifyDashboardPassword(password)) {
        return res.status(401).json({ error: "invalid_credentials" });
      }
      try {
        const token = await signDashboardJwt();
        return res.json({ accessToken: token, tokenType: "Bearer", expiresIn: process.env.CONTROL_PLANE_JWT_TTL || "8h" });
      } catch (e) {
        return res.status(500).json({ error: e instanceof Error ? e.message : "sign_failed" });
      }
    }
    if (!isDashboardPasswordConfigured() && (email == null || String(email).trim() === "")) {
      return res.status(400).json({ error: "email and password required" });
    }
    return res.status(400).json({ error: "use email+password, or set CONTROL_PLANE_DASHBOARD_PASSWORD for legacy single-password login" });
  });

  app.post("/api/v1/auth/register", async (req, res) => {
    if (process.env.CONTROL_PLANE_OPEN_REGISTRATION !== "1") {
      return res.status(403).json({ error: "registration_closed" });
    }
    if (!isJwtSecretConfigured()) {
      return res.status(503).json({ error: "jwt_secret_not_configured" });
    }
    const email = req.body?.email;
    const pw = req.body?.password;
    if (!email || !pw || typeof email !== "string" || typeof pw !== "string") {
      return res.status(400).json({ error: "email and password required" });
    }
    const customerId = getOpenRegistrationCustomerId();
    if (!customerId) {
      return res.status(503).json({ error: "open_registration_customer_not_configured" });
    }
    if (!getCustomerById(customerId)) {
      return res.status(503).json({ error: "open_registration_customer_not_found" });
    }
    try {
      const out = createUserInOrg(String(email).trim(), pw, customerId, "viewer");
      const tokens = await issueTokensForUser(out.id);
      return res.status(201).json({ ...tokens, userId: out.id });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/v1/auth/refresh", async (req, res) => {
    if (!isJwtSecretConfigured()) {
      return res.status(503).json({ error: "jwt_secret_not_configured" });
    }
    const rt = req.body?.refreshToken;
    if (!rt || typeof rt !== "string") {
      return res.status(400).json({ error: "refreshToken required" });
    }
    const row = getActiveSessionByRefreshToken(rt);
    if (!row) {
      return res.status(401).json({ error: "invalid_refresh" });
    }
    try {
      revokeSession(row.id);
      const out = await issueTokensForUser(row.user_id);
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "refresh_failed" });
    }
  });

  app.post("/api/v1/auth/forgot-password", (req, res) => {
    const email = req.body?.email;
    if (!email || typeof email !== "string" || !String(email).trim()) {
      return res.status(400).json({ error: "email required" });
    }
    const u = getUserByEmail(String(email).trim());
    if (u) {
      const raw = newRefreshToken();
      const exp = new Date(Date.now() + PASSWORD_RESET_MS).toISOString();
      createPasswordResetRow(u.id, hashOpaqueToken(raw), exp);
      insertAuditLog({
        actorType: "user",
        actorId: u.id,
        action: "password_reset_requested",
        detail: {},
      });
      if (process.env.CONTROL_PLANE_PASSWORD_RESET_DEV === "1") {
        return res.json({ ok: true, resetToken: raw });
      }
    }
    return res.json({ ok: true });
  });

  app.post("/api/v1/auth/reset-password", (req, res) => {
    const token = req.body?.token;
    const newPassword = req.body?.newPassword;
    if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
      return res.status(400).json({ error: "token and newPassword required" });
    }
    const row = getPasswordResetByRawToken(String(token));
    if (!row) {
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }
    try {
      updateUserPasswordHash(row.user_id, hashPassword(newPassword));
      markPasswordResetUsed(row.id);
      revokeAllSessionsForUser(row.user_id);
      insertAuditLog({
        actorType: "user",
        actorId: row.user_id,
        action: "password_changed",
        detail: { via: "reset" },
      });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "reset_failed" });
    }
  });

  app.post("/api/v1/auth/accept-invite", async (req, res) => {
    if (!isJwtSecretConfigured()) {
      return res.status(503).json({ error: "jwt_secret_not_configured" });
    }
    const token = req.body?.token;
    const password = req.body?.password;
    if (!token || typeof token !== "string" || !password || typeof password !== "string") {
      return res.status(400).json({ error: "token and password required" });
    }
    try {
      const u = completeOrgInvite(String(token), String(password));
      const out = await issueTokensForUser(u.id);
      return res.status(201).json({ ...out, userId: u.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "invalid_or_expired_invite" || msg === "invalid_password") {
        return res.status(400).json({ error: msg });
      }
      return res.status(500).json({ error: msg });
    }
  });

  app.post("/api/v1/auth/logout", async (req, res) => {
    const rt = req.body?.refreshToken;
    if (rt && typeof rt === "string") {
      const row = getActiveSessionByRefreshToken(rt);
      if (row) {
        revokeSession(row.id);
      }
      return res.json({ ok: true });
    }
    const auth = req.headers.authorization;
    const tok = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    const j = await verifyBearerJwt(tok || undefined);
    if (j && j.kind === "user" && j.sub) {
      revokeAllSessionsForUser(j.sub);
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: "refreshToken or Authorization bearer required" });
  });

  app.get("/api/v1/public/config", (_req, res) => {
    res.json({
      authRequired: needsStrictAuth(),
      passwordLoginEnabled: isDashboardPasswordConfigured(),
      jwtSigningConfigured: isJwtSecretConfigured(),
      apiKeyConfigured: Boolean(getApiKey()),
      userAccountCount: countUsers(),
      openRegistration: process.env.CONTROL_PLANE_OPEN_REGISTRATION === "1",
      openRegistrationCustomerConfigured: Boolean(getOpenRegistrationCustomerId()),
      corsConfigured: parseCorsOrigins().length > 0,
      rateLimitEnabled:
        process.env.CONTROL_PLANE_RATE_LIMIT !== "0" &&
        process.env.CONTROL_PLANE_DISABLE_RATE_LIMIT !== "1",
      accessTokenTtl: ACCESS_TTL,
      platformAdminsConfigured: Boolean((process.env.CONTROL_PLANE_PLATFORM_ADMINS || "").trim()),
    });
  });

  app.use("/api", authMiddleware);

  app.get("/api/v1/auth/me", (req, res) => {
    if (!needsStrictAuth()) {
      return res.json({ kind: "anonymous", authNotRequired: true });
    }
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (req.user.viaApiKey) {
      return res.json({ kind: "apikey" });
    }
    if (req.user.kind === "legacy") {
      return res.json({ kind: "legacy", roles: req.user.roles || [] });
    }
    if (req.user.kind === "user" && req.user.sub) {
      const u = getUserById(req.user.sub);
      if (!u) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const m = getMembershipsForUser(req.user.sub);
      return res.json({
        id: u.id,
        email: u.email,
        kind: "user",
        memberships: m,
      });
    }
    return res.status(401).json({ error: "unauthorized" });
  });

  app.post("/api/v1/auth/change-password", async (req, res) => {
    if (!req.user || req.user.kind !== "user" || !req.user.sub) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const cur = req.body?.currentPassword;
    const newP = req.body?.newPassword;
    if (!cur || !newP || typeof cur !== "string" || typeof newP !== "string") {
      return res.status(400).json({ error: "currentPassword and newPassword required" });
    }
    const u = getUserById(req.user.sub);
    if (!u || !verifyPassword(cur, u.password_hash)) {
      return res.status(401).json({ error: "invalid_current_password" });
    }
    updateUserPasswordHash(req.user.sub, hashPassword(newP));
    revokeAllSessionsForUser(req.user.sub);
    try {
      const out = await issueTokensForUser(req.user.sub);
      insertAuditLog({
        actorType: "user",
        actorId: req.user.sub,
        action: "password_changed",
        detail: { via: "change" },
      });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "change_failed" });
    }
  });

  app.get("/api/v1/customers", requireRoles("viewer", "admin"), (req, res) => {
    res.json({ items: listCustomersForScope(listCustomerIdsForUser(req.user)) });
  });

  app.post(
    "/api/v1/customers",
    (req, res, next) => {
      if (!needsStrictAuth()) {
        return next();
      }
      if (req.user && "viaApiKey" in req.user && req.user.viaApiKey) {
        return next();
      }
      if (req.user && req.user.kind === "user" && typeof req.user.email === "string" && isPlatformAdminEmail(req.user.email)) {
        return next();
      }
      return res.status(403).json({ error: "create_org_requires_api_key_or_platform_admin" });
    },
    (req, res) => {
    const id = req.body?.id != null ? String(req.body.id).trim() : "";
    const name = req.body?.name != null ? String(req.body.name).trim() : "";
    if (!id || !name) {
      return res.status(400).json({ error: "id and name required" });
    }
    let metadataJson = null;
    if (req.body?.metadata != null) {
      try {
        metadataJson =
          typeof req.body.metadata === "string" ? req.body.metadata : JSON.stringify(req.body.metadata);
      } catch {
        return res.status(400).json({ error: "invalid metadata" });
      }
    }
    try {
      if (req.user && req.user.kind === "user" && req.user.sub) {
        insertAuditLog({
          actorType: "user",
          actorId: req.user.sub,
          action: "customer_created",
          customerId: id,
          targetType: "customer",
          targetId: id,
          detail: { name },
        });
      } else {
        insertAuditLog({
          actorType: "apikey",
          actorId: null,
          action: "customer_created",
          customerId: id,
          targetType: "customer",
          targetId: id,
          detail: { name },
        });
      }
      return res.status(201).json(createCustomer(id, name, metadataJson));
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  }
  );

  app.get("/api/v1/customers/:customerId/users", requireRoles("admin", "viewer"), (req, res) => {
    res.json({ items: listUsersForCustomer(getCustomerId(req)) });
  });

  app.post("/api/v1/customers/:customerId/users", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const email = req.body?.email;
    const pw = req.body?.password;
    const role = req.body?.role != null ? String(req.body.role) : "viewer";
    if (!email || !pw || typeof email !== "string" || typeof pw !== "string") {
      return res.status(400).json({ error: "email and password required" });
    }
    const allowed = new Set(["admin", "policy_author", "approver", "viewer"]);
    if (!allowed.has(role)) {
      return res.status(400).json({ error: "invalid role" });
    }
    try {
      const out = createUserInOrg(String(email).trim(), pw, cid, role);
      if (req.user && req.user.kind === "user" && req.user.sub) {
        insertAuditLog({
          actorType: "user",
          actorId: req.user.sub,
          action: "org_user_created",
          customerId: cid,
          targetType: "user",
          targetId: out.id,
          detail: { email: out.email, role: out.role },
        });
      }
      return res.status(201).json({ id: out.id, email: out.email, customerId: cid, role: out.role });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.patch("/api/v1/customers/:customerId/users/:userId", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { userId } = req.params;
    const role = req.body?.role != null ? String(req.body.role) : "";
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const allowed = new Set(["admin", "policy_author", "approver", "viewer"]);
    if (!allowed.has(role)) {
      return res.status(400).json({ error: "invalid role" });
    }
    const rows = listUsersForCustomer(cid);
    if (!rows.some((r) => r.id === userId)) {
      return res.status(404).json({ error: "user_not_in_org" });
    }
    upsertOrgMembership(userId, cid, role);
    if (req.user && req.user.kind === "user" && req.user.sub) {
      insertAuditLog({
        actorType: "user",
        actorId: req.user.sub,
        action: "org_membership_updated",
        customerId: cid,
        targetType: "user",
        targetId: userId,
        detail: { role },
      });
    }
    return res.json({ ok: true, userId, customerId: cid, role });
  });

  app.delete("/api/v1/customers/:customerId/users/:userId", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    const rows = listUsersForCustomer(cid);
    if (!rows.some((r) => r.id === userId)) {
      return res.status(404).json({ error: "user_not_in_org" });
    }
    deleteOrgMembership(userId, cid);
    if (req.user && req.user.kind === "user" && req.user.sub) {
      insertAuditLog({
        actorType: "user",
        actorId: req.user.sub,
        action: "org_membership_removed",
        customerId: cid,
        targetType: "user",
        targetId: userId,
        detail: {},
      });
    }
    return res.json({ ok: true });
  });

  app.post("/api/v1/customers/:customerId/invites", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const email = req.body?.email;
    const role = req.body?.role != null ? String(req.body.role) : "viewer";
    if (!email || typeof email !== "string" || !String(email).trim()) {
      return res.status(400).json({ error: "email required" });
    }
    const allowed = new Set(["admin", "policy_author", "approver", "viewer"]);
    if (!allowed.has(role)) {
      return res.status(400).json({ error: "invalid role" });
    }
    const raw = newRefreshToken();
    const exp = new Date(Date.now() + INVITE_MS).toISOString();
    const em = String(email).toLowerCase().trim();
    const { id } = createOrgInviteRow({
      customerId: cid,
      email: em,
      role,
      tokenHash: hashOpaqueToken(raw),
      expiresAt: exp,
      createdByUserId: req.user && req.user.kind === "user" ? req.user.sub : null,
    });
    if (req.user && req.user.kind === "user" && req.user.sub) {
      insertAuditLog({
        actorType: "user",
        actorId: req.user.sub,
        action: "org_invite_created",
        customerId: cid,
        targetType: "invite",
        targetId: id,
        detail: { email: em, role },
      });
    }
    const out = { id, email: em, role, expiresAt: exp };
    if (process.env.CONTROL_PLANE_INVITE_DEV === "1") {
      Object.assign(out, { token: raw });
    }
    return res.status(201).json(out);
  });

  app.get("/api/v1/customers/:customerId/audit", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const items = listAuditForCustomer(cid, limit);
    return res.json({ items });
  });

  app.get("/api/v1/customers/:customerId/agents", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const includeInactive = req.query.includeInactive === "1" || req.query.includeInactive === "true";
    res.json({ items: listAgents(cid, { includeInactive }) });
  });

  app.post("/api/v1/customers/:customerId/agents", requireRoles("admin", "policy_author"), (req, res) => {
    const cid = getCustomerId(req);
    const body = req.body || {};
    const name = body.agent_name ?? body.name;
    const orgId = body.org_id ?? body.orgId ?? null;
    const channels = body.channels ?? body.allowed_channels ?? [];
    const metadata = body.metadata ?? {};
    try {
      const agent = createAgent(cid, { name, orgId, channels, metadata });
      let actorType = "system";
      /** @type {string | null} */
      let actorId = null;
      if (req.user && "viaApiKey" in req.user && req.user.viaApiKey) {
        actorType = "apikey";
      } else if (req.user && req.user.kind === "user" && req.user.sub) {
        actorType = "user";
        actorId = req.user.sub;
      }
      insertAuditLog({
        actorType,
        actorId,
        action: "agent_registered",
        customerId: cid,
        targetType: "agent",
        targetId: agent.agentId,
        detail: { name: agent.name, status: agent.status },
      });
      return res.status(201).json({
        agent_id: agent.agentId,
        status: agent.status,
        agent,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.includes("already exists") ? 409 : 400;
      return res.status(code).json({ error: msg });
    }
  });

  app.get("/api/v1/customers/:customerId/agents/:agentId", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const agent = getAgent(cid, req.params.agentId);
    if (!agent) {
      return res.status(404).json({ error: "agent not found" });
    }
    return res.json(agent);
  });

  app.patch("/api/v1/customers/:customerId/agents/:agentId", requireRoles("admin", "policy_author"), (req, res) => {
    const cid = getCustomerId(req);
    const body = req.body || {};
    const patch = {
      name: body.agent_name ?? body.name,
      orgId: body.org_id ?? body.orgId,
      channels: body.channels ?? body.allowed_channels,
      metadata: body.metadata,
      status: body.status,
    };
    Object.keys(patch).forEach((k) => {
      if (patch[k] === undefined) {
        delete patch[k];
      }
    });
    try {
      const agent = updateAgent(cid, req.params.agentId, patch);
      if (!agent) {
        return res.status(404).json({ error: "agent not found" });
      }
      insertAuditLog({
        actorType: req.user?.viaApiKey ? "apikey" : req.user?.kind === "user" ? "user" : "system",
        actorId: req.user?.kind === "user" ? req.user.sub : null,
        action: "agent_updated",
        customerId: cid,
        targetType: "agent",
        targetId: agent.agentId,
        detail: patch,
      });
      return res.json(agent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.includes("already exists") ? 409 : 400;
      return res.status(code).json({ error: msg });
    }
  });

  app.post("/api/v1/customers/:customerId/agents/:agentId/deactivate", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const agent = deactivateAgent(cid, req.params.agentId);
    if (!agent) {
      return res.status(404).json({ error: "agent not found" });
    }
    insertAuditLog({
      actorType: req.user?.viaApiKey ? "apikey" : req.user?.kind === "user" ? "user" : "system",
      actorId: req.user?.kind === "user" ? req.user.sub : null,
      action: "agent_deactivated",
      customerId: cid,
      targetType: "agent",
      targetId: agent.agentId,
      detail: { status: agent.status },
    });
    return res.json({ agent_id: agent.agentId, status: agent.status, agent });
  });

  app.get("/api/v1/customers/:customerId/agf/rule-file", requireRoles("policy_author", "admin", "viewer"), (req, res) => {
    const p = req.query.path;
    if (!p || typeof p !== "string") {
      return res.status(400).json({ error: "path query required" });
    }
    try {
      const text = readAgfFileUnderRoot(p);
      return res.json({ path: p, text });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/v1/customers/:customerId/bundles/validate", requireRoles("policy_author", "admin"), (req, res) => {
    const { ruleFiles } = req.body || {};
    if (!Array.isArray(ruleFiles) || ruleFiles.length === 0) {
      return res.status(400).json({ error: "ruleFiles[] required" });
    }
    if (process.env.CONTROL_PLANE_SKIP_ARSL_VALIDATE === "1") {
      return res.json({ ok: true, skipped: true });
    }
    const abs = resolveRuleFiles(ruleFiles);
    const v = validateArslFiles(abs);
    if (!v.ok) {
      return res.status(400).json({ ok: false, file: v.file, message: v.message });
    }
    return res.json({ ok: true, paths: abs });
  });

  app.get("/api/v1/customers/:customerId/dashboard/summary", requireRoles("viewer", "admin"), (req, res) => {
    res.json(getSummary(getCustomerId(req)));
  });

  app.get("/api/v1/customers/:customerId/decisions", requireRoles("viewer", "admin"), (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json({ items: listDecisions(getCustomerId(req), limit) });
  });

  app.get("/api/v1/customers/:customerId/approvals", requireRoles("viewer", "admin"), (req, res) => {
    const st = req.query.status;
    res.json({ items: listApprovals(getCustomerId(req), st || null) });
  });

  app.post("/api/v1/customers/:customerId/approvals/:id/resolve", requireRoles("approver", "admin"), async (req, res) => {
    const cid = getCustomerId(req);
    const decision = req.body?.resolution === "rejected" ? "rejected" : "approved";
    const r = resolveApprovalRow(cid, req.params.id, decision);
    if (!r) {
      return res.status(404).json({ error: "not_found" });
    }
    const actorId = req.user?.kind === "user" && req.user.sub ? req.user.sub : null;
    const actorType = req.user?.viaApiKey ? "apikey" : "user";
    insertAuditLog({
      actorType,
      actorId,
      action: "hitl_approval_resolved",
      customerId: cid,
      targetType: "approval",
      targetId: r.id,
      detail: { resolution: decision, decisionRef: r.decisionRef },
    });
    try {
      dispatchApprovalWebhook(cid, "approval.resolved", r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[webhook]", e instanceof Error ? e.message : e);
    }
    return res.json(r);
  });

  app.get("/api/v1/customers/:customerId/evidence/decisions", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    res.json({ items: listDecisions(cid, 10_000) });
  });

  app.get("/api/v1/customers/:customerId/evidence/export", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { from, to } = req.query;
    const payload = buildEvidenceExportPayload(cid, from ? String(from) : null, to ? String(to) : null);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="agf-evidence-${cid}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  });

  app.get("/api/v1/customers/:customerId/evidence/exports", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    return res.json({ items: listExportJobsForCustomer(cid, limit) });
  });

  app.post("/api/v1/customers/:customerId/evidence/exports", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const from = req.body?.from != null ? String(req.body.from) : null;
    const to = req.body?.to != null ? String(req.body.to) : null;
    try {
      const jsonBody = JSON.stringify(buildEvidenceExportPayload(cid, from, to), null, 2);
      const out = createExportJobAndFile(cid, from, to, jsonBody);
      return res.status(202).json({
        jobId: out.id,
        status: out.status,
        downloadPath: `/api/v1/customers/${cid}/evidence/exports/${out.id}/download`,
        completedAt: out.completedAt,
      });
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/v1/customers/:customerId/evidence/exports/:jobId", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const job = getExportJob(req.params.jobId, cid);
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({
      id: job.id,
      status: job.status,
      from: job.from_ts,
      to: job.to_ts,
      error: job.error_text,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      downloadPath:
        job.status === "completed"
          ? `/api/v1/customers/${cid}/evidence/exports/${job.id}/download`
          : null,
    });
  });

  app.get("/api/v1/customers/:customerId/evidence/exports/:jobId/download", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const fp = getExportFilePathForDownload(cid, req.params.jobId);
    if (!fp) {
      return res.status(404).json({ error: "not_found" });
    }
    const name = path.basename(fp);
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${name}"`);
    return res.send(fs.readFileSync(fp, "utf8"));
  });

  app.get("/api/v1/customers/:customerId/webhooks/outbox", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    return res.json({ items: listWebhookOutboxForCustomer(cid, limit) });
  });

  app.put("/api/v1/customers/:customerId/webhook", requireRoles("admin"), (req, res) => {
    const cid = getCustomerId(req);
    const url = req.body?.url;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url required" });
    }
    const secret = req.body?.secret != null ? String(req.body.secret) : null;
    return res.json(upsertWebhook(cid, url.trim(), secret));
  });

  app.get("/api/v1/customers/:customerId/webhook", requireRoles("viewer", "admin"), (req, res) => {
    const row = getWebhookForCustomer(getCustomerId(req));
    if (!row) {
      return res.json({ configured: false });
    }
    return res.json({ configured: true, url: row.url, hasSecret: Boolean(row.secret), createdAt: row.createdAt });
  });

  app.get("/api/v1/customers/:customerId/bundles", requireRoles("viewer", "admin"), (req, res) => {
    res.json({ items: listBundles(getCustomerId(req)) });
  });

  app.post("/api/v1/customers/:customerId/bundles", requireRoles("policy_author", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { publicBundleId, bundleVersion, ruleFiles, rulesetVersionId } = req.body || {};
    if (!publicBundleId || !bundleVersion || !Array.isArray(ruleFiles) || ruleFiles.length === 0) {
      return res.status(400).json({ error: "publicBundleId, bundleVersion, ruleFiles[] required" });
    }
    if (rulesetVersionId && process.env.CONTROL_PLANE_STRICT_RULESET === "1") {
      const rv = getDbRulesetVersionForBundle(cid, rulesetVersionId);
      if (!rv || rv.state !== "APPROVED") {
        return res.status(400).json({ error: "ruleset version must be APPROVED before publish" });
      }
    }
    try {
      const out = publishBundle(cid, publicBundleId, String(bundleVersion), ruleFiles, rulesetVersionId || null);
      if (rulesetVersionId) {
        const vrow = getDb().prepare("SELECT ruleset_id as rulesetId FROM ruleset_versions WHERE id = ?").get(rulesetVersionId);
        auditRulesetLifecycle(req, cid, "ruleset_published", (vrow && vrow.rulesetId) || "", rulesetVersionId, {
          publicBundleId: out.publicBundleId,
          bundleVersion: out.bundleVersion,
          digest: out.digest,
          deduped: out.deduped,
          via: "bundles_post",
        });
      }
      const publishedBy = req.user?.kind === "user" && req.user.sub ? req.user.sub : req.user?.viaApiKey ? "apikey" : null;
      return res.status(201).json({ ...out, state: "PUBLISHED", publishedBy });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/v1/customers/:customerId/rulesets", requireRoles("viewer", "admin"), (req, res) => {
    res.json({ items: listRulesets(getCustomerId(req)) });
  });

  app.get("/api/v1/customers/:customerId/rulesets/:rulesetId", requireRoles("viewer", "admin"), (req, res) => {
    const r = getRuleset(req.params.rulesetId, getCustomerId(req));
    if (!r) {
      return res.status(404).json({ error: "ruleset not found" });
    }
    return res.json({ id: r.id, name: r.name, createdAt: r.created_at });
  });

  app.post("/api/v1/customers/:customerId/rulesets", requireRoles("policy_author", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const name = req.body?.name;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name required" });
    }
    const out = createRuleset(cid, name.trim());
    auditRulesetLifecycle(req, cid, "ruleset_created", out.id, null, { name: out.name });
    return res.status(201).json(out);
  });

  app.get("/api/v1/customers/:customerId/rulesets/:rulesetId/versions", requireRoles("viewer", "admin"), (req, res) => {
    const { rulesetId } = req.params;
    const r = getRuleset(rulesetId, getCustomerId(req));
    if (!r) {
      return res.status(404).json({ error: "ruleset not found" });
    }
    return res.json({ items: getRulesetVersions(rulesetId) });
  });

  app.post("/api/v1/customers/:customerId/rulesets/:rulesetId/versions", requireRoles("policy_author", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { rulesetId } = req.params;
    const r = getRuleset(rulesetId, getCustomerId(req));
    if (!r) {
      return res.status(404).json({ error: "ruleset not found" });
    }
    const versionLabel = req.body?.versionLabel;
    if (!versionLabel) {
      return res.status(400).json({ error: "versionLabel required" });
    }
    const out = createRulesetVersion(rulesetId, String(versionLabel));
    auditRulesetLifecycle(req, cid, "ruleset_version_created", rulesetId, out.id, { versionLabel: out.versionLabel });
    return res.status(201).json(out);
  });

  app.get("/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId", requireRoles("viewer", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { rulesetId, versionId } = req.params;
    const d = getRulesetVersionDetail(rulesetId, versionId, cid);
    if (!d) {
      return res.status(404).json({ error: "version not found" });
    }
    const publishedBundle = d.publishedBundle
      ? (() => {
          const p = d.publishedBundle;
          let ruleFiles = null;
          try {
            ruleFiles = JSON.parse(p.ruleFilesJson);
          } catch {
            ruleFiles = null;
          }
          return {
            id: p.id,
            publicBundleId: p.publicBundleId,
            bundleVersion: p.bundleVersion,
            digest: p.digest,
            publishedAt: p.publishedAt,
            rulesetVersionId: p.rulesetVersionId,
            ruleFiles,
          };
        })()
      : null;
    return res.json({
      id: d.id,
      rulesetId: d.rulesetId,
      versionLabel: d.versionLabel,
      state: d.state,
      createdAt: d.createdAt,
      publishedBundle,
    });
  });

  const submitForReview = (req, res) => {
    const cid = getCustomerId(req);
    const { rulesetId, versionId } = req.params;
    try {
      const out = setRulesetVersionState(rulesetId, versionId, cid, "IN_REVIEW");
      if (!out) {
        return res.status(404).json({ error: "version not found" });
      }
      auditRulesetLifecycle(req, cid, "ruleset_submitted_review", rulesetId, versionId, { toState: "IN_REVIEW" });
      return res.json(out);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  app.post(
    ["/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/submit-review", "/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/review"],
    requireRoles("policy_author", "admin"),
    submitForReview
  );

  const approveVersion = (req, res) => {
    const cid = getCustomerId(req);
    const { rulesetId, versionId } = req.params;
    try {
      const out = setRulesetVersionState(rulesetId, versionId, cid, "APPROVED");
      if (!out) {
        return res.status(404).json({ error: "version not found" });
      }
      auditRulesetLifecycle(req, cid, "ruleset_approved", rulesetId, versionId, { toState: "APPROVED" });
      return res.json(out);
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  app.post(
    ["/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/approve-review", "/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/approve"],
    requireRoles("approver", "admin"),
    approveVersion
  );

  app.post(
    "/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/deprecate",
    requireRoles("policy_author", "admin"),
    (req, res) => {
      const cid = getCustomerId(req);
      const { rulesetId, versionId } = req.params;
      try {
        const out = setRulesetVersionState(rulesetId, versionId, cid, "DEPRECATED");
        if (!out) {
          return res.status(404).json({ error: "version not found" });
        }
        auditRulesetLifecycle(req, cid, "ruleset_deprecated", rulesetId, versionId, { toState: "DEPRECATED" });
        return res.json(out);
      } catch (e) {
        return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  app.post(
    "/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/retire",
    requireRoles("admin"),
    (req, res) => {
      const cid = getCustomerId(req);
      const { rulesetId, versionId } = req.params;
      try {
        const out = setRulesetVersionState(rulesetId, versionId, cid, "RETIRED");
        if (!out) {
          return res.status(404).json({ error: "version not found" });
        }
        auditRulesetLifecycle(req, cid, "ruleset_retired", rulesetId, versionId, { toState: "RETIRED" });
        return res.json(out);
      } catch (e) {
        return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  app.post("/api/v1/customers/:customerId/rulesets/:rulesetId/versions/:versionId/publish", requireRoles("policy_author", "admin"), (req, res) => {
    const cid = getCustomerId(req);
    const { rulesetId, versionId } = req.params;
    const r = getRuleset(rulesetId, cid);
    if (!r) {
      return res.status(404).json({ error: "ruleset not found" });
    }
    if (!strictRulesetGate(rulesetId, versionId, cid)) {
      return res.status(400).json({ error: "ruleset version must be APPROVED before publish" });
    }
    const { publicBundleId, bundleVersion, ruleFiles } = req.body || {};
    if (!publicBundleId || !bundleVersion || !Array.isArray(ruleFiles) || !ruleFiles.length) {
      return res.status(400).json({ error: "publicBundleId, bundleVersion, ruleFiles[] required" });
    }
    try {
      const out = publishBundle(cid, publicBundleId, String(bundleVersion), ruleFiles, versionId);
      auditRulesetLifecycle(req, cid, "ruleset_published", rulesetId, versionId, {
        publicBundleId: out.publicBundleId,
        bundleVersion: out.bundleVersion,
        digest: out.digest,
        deduped: out.deduped,
      });
      const publishedBy = req.user?.kind === "user" && req.user.sub ? req.user.sub : req.user?.viaApiKey ? "apikey" : null;
      return res.status(201).json({ ...out, state: "PUBLISHED", publishedBy });
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/v1/customers/:customerId/evaluate", requireRoles("policy_author", "admin"), async (req, res) => {
    const cid = getCustomerId(req);
    const { publicBundleId, entityId, entityName, data } = req.body || {};
    if (!publicBundleId || entityId == null || !data || typeof data !== "object") {
      return res.status(400).json({ error: "publicBundleId, entityId, data required" });
    }
    const bundle = getBundleByPublicId(cid, publicBundleId);
    if (!bundle) {
      return res.status(404).json({ error: "bundle not found" });
    }
    let ruleFiles;
    try {
      ruleFiles = JSON.parse(bundle.rule_files_json);
    } catch {
      return res.status(500).json({ error: "invalid bundle storage" });
    }
    const name = (entityName && String(entityName)) || `entity-${entityId}`;
    const ent = Number(entityId);
    if (!Number.isFinite(ent) || ent < 0 || ent > 0xffffffff) {
      return res.status(400).json({ error: "entityId must be a u32" });
    }
    const hitl = req.body?.hitl;
    const requestedAgentId =
      (typeof req.body?.agentId === "string" && req.body.agentId.trim()) ||
      (typeof hitl?.agentId === "string" && hitl.agentId.trim()) ||
      null;
    if (requestedAgentId) {
      const registered = getAgent(cid, requestedAgentId);
      if (!registered) {
        return res.status(400).json({ error: "unknown_agent_id", agentId: requestedAgentId });
      }
      if (registered.status !== "active") {
        return res.status(400).json({ error: "agent_inactive", agentId: requestedAgentId });
      }
    }
    const payload = {
      entity_id: ent,
      entity_name: name,
      rule_files: ruleFiles,
      data: data,
    };
    let agf;
    try {
      agf = await postEvaluateEntity(payload);
    } catch (e) {
      return res.status(502).json({ error: e instanceof Error ? e.message : String(e) });
    }
    const platform = mapKernelToPlatform(agf.overall_decision, agf);
    const id = insertDecision({
      customerId: cid,
      entityId: String(entityId),
      entityName: name,
      platformDecision: platform,
      kernelDecisionRaw: agf.overall_decision,
      publicBundleId: bundle.public_bundle_id,
      proofHash: agf.audit?.proof_hash ?? null,
      chainHash: agf.audit?.chain_hash ?? null,
      signature: agf.signature ?? null,
    });

    if (typeof hitl === "object" && hitl && typeof hitl.title === "string" && hitl.title.trim()) {
      const ap = insertPendingApproval(cid, {
        title: hitl.title.trim(),
        agentId: requestedAgentId || "orchestrator",
        decisionRef: id,
      });
      insertAuditLog({
        actorType: "system",
        actorId: null,
        action: "hitl_approval_queued",
        customerId: cid,
        targetType: "approval",
        targetId: ap.id,
        detail: { title: ap.title, decisionId: id, source: "hitl_body" },
      });
      try {
        dispatchApprovalWebhook(cid, "approval.created", { ...ap, status: "pending" });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[webhook]", e instanceof Error ? e.message : e);
      }
    } else if (platform === "REQUIRE_APPROVAL") {
      const ap = insertPendingApproval(cid, {
        title: `Kernel review: entity ${entityId}`,
        agentId: "agf-kernel",
        decisionRef: id,
      });
      insertAuditLog({
        actorType: "system",
        actorId: null,
        action: "hitl_approval_queued",
        customerId: cid,
        targetType: "approval",
        targetId: ap.id,
        detail: { title: ap.title, decisionId: id, source: "kernel_require_approval" },
      });
      try {
        dispatchApprovalWebhook(cid, "approval.created", { ...ap, status: "pending" });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[webhook]", e instanceof Error ? e.message : e);
      }
    }
    return res.status(201).json({ decisionId: id, platformDecision: platform, agf: agf });
  });

  app.get("/api/v1/kernel/health", requireRoles("viewer", "admin"), async (_req, res) => {
    res.json(await fetchKernelHealth());
  });

  if (process.env.CONTROL_PLANE_ENABLE_LEGACY_DEFAULT_PATHS === "1") {
    app.get("/api/v1/dashboard/summary", requireRoles("viewer", "admin"), (req, res) => {
      res.json(getSummary(req.query.customerId || DEFAULT_CUSTOMER_ID));
    });
    app.get("/api/v1/decisions", requireRoles("viewer", "admin"), (req, res) => {
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
      res.json({ items: listDecisions(req.query.customerId || DEFAULT_CUSTOMER_ID, limit) });
    });
    app.get("/api/v1/approvals", requireRoles("viewer", "admin"), (req, res) => {
      res.json({ items: listApprovals(req.query.customerId || DEFAULT_CUSTOMER_ID, req.query.status || null) });
    });
    app.post("/api/v1/approvals/:id/resolve", requireRoles("approver", "admin"), async (req, res) => {
      const cid = req.query.customerId || DEFAULT_CUSTOMER_ID;
      const decision = req.body?.resolution === "rejected" ? "rejected" : "approved";
      const r = resolveApprovalRow(cid, req.params.id, decision);
      if (!r) {
        return res.status(404).json({ error: "not_found" });
      }
      const actorId = req.user?.kind === "user" && req.user.sub ? req.user.sub : null;
      const actorType = req.user?.viaApiKey ? "apikey" : "user";
      insertAuditLog({
        actorType,
        actorId,
        action: "hitl_approval_resolved",
        customerId: cid,
        targetType: "approval",
        targetId: r.id,
        detail: { resolution: decision, decisionRef: r.decisionRef },
      });
      try {
        dispatchApprovalWebhook(cid, "approval.resolved", r);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[webhook]", e instanceof Error ? e.message : e);
      }
      return res.json(r);
    });
    app.get("/api/v1/evidence/decisions", requireRoles("viewer", "admin"), (req, res) => {
      const cid = req.query.customerId || DEFAULT_CUSTOMER_ID;
      return res.json({ items: listDecisions(cid, 10_000) });
    });
    app.post("/api/v1/record-decision", requireRoles("policy_author", "admin"), (req, res) => {
      const id = insertDecision({
        customerId: req.query.customerId || DEFAULT_CUSTOMER_ID,
        entityId: String(req.body?.entityId || "unknown"),
        platformDecision: String(req.body?.decision || "ALLOW"),
        kernelDecisionRaw: null,
        publicBundleId: req.body?.bundleId != null ? String(req.body.bundleId) : null,
        proofHash: req.body?.proofHash,
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json({ id });
    });
  }

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err, _req, res, _next) => {
      // eslint-disable-next-line no-console
      console.error(err);
      res.status(500).json({ error: "internal_error" });
    }
  );

  const enterprise = await loadEnterpriseExtensions(app);
  return { app, enterprise };
}

/**
 * @param {string} _cid
 * @param {string} versionId
 */
function getDbRulesetVersionForBundle(_cid, versionId) {
  return getDb()
    .prepare("SELECT id, state FROM ruleset_versions WHERE id = ?")
    .get(versionId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
