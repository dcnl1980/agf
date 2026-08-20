import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID, createHash, randomBytes } from "crypto";
import { computeBundleDigest } from "./digest.js";
import { getAgfSp1Root, resolveRuleFiles } from "./paths.js";
import { validateArslFiles } from "./arslValidate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CUSTOMER_ID = "cust_dev";
const DEFAULT_RULESET_NAME = "default";

/** @type {import('better-sqlite3').Database | null} */
let _db = null;

export function getDb() {
  if (!_db) {
    throw new Error("DB not open");
  }
  return _db;
}

export function getDataDir() {
  return process.env.CONTROL_PLANE_DATA || path.join(__dirname, "../data");
}

export function getDbPath() {
  return process.env.SQLITE_PATH || path.join(getDataDir(), "control-plane.db");
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rulesets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS ruleset_versions (
      id TEXT PRIMARY KEY,
      ruleset_id TEXT NOT NULL,
      version_label TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      published_bundle_fk TEXT,
      FOREIGN KEY (ruleset_id) REFERENCES rulesets(id)
    );
    CREATE TABLE IF NOT EXISTS policy_bundles (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      ruleset_version_id TEXT,
      public_bundle_id TEXT NOT NULL UNIQUE,
      bundle_version TEXT NOT NULL,
      digest TEXT NOT NULL,
      rule_files_json TEXT NOT NULL,
      published_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_name TEXT,
      platform_decision TEXT NOT NULL,
      kernel_decision_raw TEXT,
      public_bundle_id TEXT,
      proof_hash TEXT,
      chain_hash TEXT,
      signature TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_customer ON decisions(customer_id, created_at);
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decision_ref TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL,
      from_ts TEXT,
      to_ts TEXT,
      error_text TEXT,
      file_path TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      secret TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS org_memberships (
      user_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, customer_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE TABLE IF NOT EXISTS webhook_outbox (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      idempotency_key TEXT NOT NULL UNIQUE,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL,
      next_attempt_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_outbox_pending ON webhook_outbox(status, next_attempt_at);
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS org_invites (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT,
      accepted_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      customer_id TEXT,
      target_type TEXT,
      target_id TEXT,
      detail_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_log(customer_id, at);
  `);
}

/**
 * @param {import('better-sqlite3').Database} db
 */
function migrateV2(db) {
  try {
    db.prepare("ALTER TABLE customers ADD COLUMN metadata_json TEXT").run();
  } catch {
    /* column exists */
  }
}

/**
 * Agent Registry (MVP module 1)
 * @param {import('better-sqlite3').Database} db
 */
function migrateV3(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      org_id TEXT,
      channels_json TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_agents_customer ON agents(customer_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_customer_name ON agents(customer_id, name);
  `);
}

function seedIfEmpty(db) {
  if (process.env.CONTROL_PLANE_SEED_DEV_DATA !== "1") {
    return;
  }
  const c = db.prepare("SELECT COUNT(*) as n FROM customers").get();
  if (c.n > 0) {
    return;
  }
  const now = new Date().toISOString();
  const custId = DEFAULT_CUSTOMER_ID;
  db.prepare("INSERT INTO customers (id, name, created_at) VALUES (?, ?, ?)").run(custId, "Development customer", now);

  const rsId = "rs_dev";
  db.prepare("INSERT INTO rulesets (id, customer_id, name, created_at) VALUES (?, ?, ?, ?)").run(rsId, custId, DEFAULT_RULESET_NAME, now);

  const verId = "rsv_dev_1";
  // Same four verticals as `agf-demo` for a predictable PASS on evaluate.
  const relFiles = [
    "rules/finance/kyc/standard_onboarding.arsl.toml",
    "rules/finance/sanctions/hmt.arsl.toml",
    "rules/finance/fca/consumer_duty.arsl.toml",
    "rules/cross_industry/gdpr/consent.arsl.toml",
  ];
  const abs = resolveRuleFiles(relFiles);
  for (const p of abs) {
    if (!fs.existsSync(p)) {
      // eslint-disable-next-line no-console
      console.warn(`[seed] skip default bundle, missing rule file: ${p}`);
      return;
    }
  }
  db.prepare(
    "INSERT INTO ruleset_versions (id, ruleset_id, version_label, state, created_at, published_bundle_fk) VALUES (?, ?, ?, 'DRAFT', ?, NULL)"
  ).run(verId, rsId, "2026.01.0", now);
  const digest = computeBundleDigest(abs);
  const bundleRowId = "pb_dev_1";
  const publicBundleId = "rb_dev_default";
  db.prepare(
    `INSERT INTO policy_bundles (id, customer_id, ruleset_version_id, public_bundle_id, bundle_version, digest, rule_files_json, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(bundleRowId, custId, verId, publicBundleId, "2026.01.0", digest, JSON.stringify(abs), now);

  db.prepare("UPDATE ruleset_versions SET state = 'PUBLISHED', published_bundle_fk = ? WHERE id = ?").run(
    bundleRowId,
    verId
  );

  db.prepare("INSERT INTO approvals (id, customer_id, title, agent_id, status, created_at, decision_ref) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "appr_seed_1",
    custId,
    "Wire transfer over threshold",
    "agt_payments",
    "pending",
    now,
    null
  );
  db.prepare("INSERT INTO approvals (id, customer_id, title, agent_id, status, created_at, decision_ref) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "appr_seed_2",
    custId,
    "New vendor onboarding",
    "agt_onboarding",
    "pending",
    now,
    null
  );

  const agentSeed = [
    ["agt_payments", "payments-orchestrator", "org_finops"],
    ["agt_onboarding", "vendor-onboarding", "org_finops"],
  ];
  for (const [id, name, orgId] of agentSeed) {
    db.prepare(
      `INSERT INTO agents (id, customer_id, name, status, org_id, channels_json, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).run(
      id,
      custId,
      name,
      orgId,
      JSON.stringify(["api", "temporal"]),
      JSON.stringify({ seeded: true }),
      now,
      now
    );
  }
}

export function openDb() {
  if (_db) {
    return _db;
  }
  fs.mkdirSync(getDataDir(), { recursive: true });
  const db = new Database(getDbPath());
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  migrate(db);
  migrateV2(db);
  migrateV3(db);
  seedIfEmpty(db);
  _db = db;
  return db;
}

export { DEFAULT_CUSTOMER_ID };

// --- queries ---

export function getSummary(customerId = DEFAULT_CUSTOMER_ID) {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as n FROM decisions WHERE customer_id = ?").get(customerId).n;
  const allow = db
    .prepare("SELECT COUNT(*) as n FROM decisions WHERE customer_id = ? AND platform_decision = 'ALLOW'")
    .get(customerId).n;
  const block = db
    .prepare("SELECT COUNT(*) as n FROM decisions WHERE customer_id = ? AND platform_decision = 'BLOCK'")
    .get(customerId).n;
  const applicable = allow + block;
  const pending = db
    .prepare("SELECT COUNT(*) as n FROM approvals WHERE customer_id = ? AND status = 'pending'")
    .get(customerId).n;
  return {
    totalDecisions: total,
    allowCount: allow,
    blockCount: block,
    passRateBps: applicable > 0 ? Math.round((allow / applicable) * 10000) : 0,
    pendingApprovals: pending,
  };
}

/**
 * @param {string} customerId
 * @param {number} limit
 */
export function listDecisions(customerId, limit) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, entity_id as entityId, platform_decision as decision, public_bundle_id as bundleId, created_at as createdAt, proof_hash as proofHash, chain_hash as chainHash, signature
       FROM decisions WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(customerId, limit);
}

export function listApprovals(customerId, status) {
  const db = getDb();
  if (status) {
    return db
      .prepare(
        `SELECT id, title, agent_id as agentId, status, created_at as createdAt, decision_ref as decisionRef
         FROM approvals WHERE customer_id = ? AND status = ? ORDER BY created_at DESC`
      )
      .all(customerId, status);
  }
  return db
    .prepare(
      `SELECT id, title, agent_id as agentId, status, created_at as createdAt, decision_ref as decisionRef
       FROM approvals WHERE customer_id = ? ORDER BY created_at DESC`
    )
    .all(customerId);
}

/**
 * @param {object} row
 */
export function insertDecision(row) {
  const db = getDb();
  const id = row.id || `dec_${randomUUID()}`;
  db.prepare(
    `INSERT INTO decisions (id, customer_id, entity_id, entity_name, platform_decision, kernel_decision_raw, public_bundle_id, proof_hash, chain_hash, signature, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    row.customerId,
    row.entityId,
    row.entityName ?? null,
    row.platformDecision,
    row.kernelDecisionRaw,
    row.publicBundleId ?? null,
    row.proofHash ?? null,
    row.chainHash ?? null,
    row.signature ?? null,
    row.createdAt || new Date().toISOString()
  );
  return id;
}

export function resolveApprovalRow(customerId, id, resolution) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM approvals WHERE id = ? AND customer_id = ?").get(id, customerId);
  if (!row) {
    return null;
  }
  const st = resolution === "rejected" ? "rejected" : "approved";
  db.prepare("UPDATE approvals SET status = ? WHERE id = ?").run(st, id);
  return {
    id: row.id,
    status: st,
    resolvedAt: new Date().toISOString(),
    title: row.title,
    agentId: row.agent_id,
    decisionRef: row.decision_ref,
  };
}

export function getBundleByPublicId(customerId, publicBundleId) {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM policy_bundles WHERE customer_id = ? AND public_bundle_id = ?"
    )
    .get(customerId, publicBundleId);
}

export function listBundles(customerId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, public_bundle_id as publicBundleId, bundle_version as bundleVersion, digest, rule_files_json as ruleFilesJson, published_at as publishedAt, ruleset_version_id as rulesetVersionId
       FROM policy_bundles WHERE customer_id = ? ORDER BY published_at DESC`
    )
    .all(customerId);
}

/**
 * @param {string} customerId
 * @param {string} publicBundleId
 * @param {string} bundleVersion
 * @param {string[]} relRuleFiles relative to agf-sp1
 * @param {string | null} rulesetVersionId
 */
export function publishBundle(customerId, publicBundleId, bundleVersion, relRuleFiles, rulesetVersionId) {
  const abs = resolveRuleFiles(relRuleFiles);
  for (const p of abs) {
    if (!fs.existsSync(p)) {
      throw new Error(`rule file not found: ${p}`);
    }
  }
  if (process.env.CONTROL_PLANE_SKIP_ARSL_VALIDATE !== "1") {
    const v = validateArslFiles(abs);
    if (!v.ok) {
      throw new Error(`ARSL validation failed: ${v.file || "?"}: ${v.message}`);
    }
  }
  const digest = computeBundleDigest(abs);
  const db = getDb();
  const existing = db
    .prepare("SELECT id, digest FROM policy_bundles WHERE public_bundle_id = ? AND customer_id = ?")
    .get(publicBundleId, customerId);
  if (existing && existing.digest === digest) {
    const row = db
      .prepare(
        "SELECT id, public_bundle_id as publicBundleId, bundle_version as bundleVersion, digest, published_at as publishedAt, ruleset_version_id as rulesetVersionId FROM policy_bundles WHERE public_bundle_id = ? AND customer_id = ?"
      )
      .get(publicBundleId, customerId);
    return {
      id: row.id,
      deduped: true,
      publicBundleId: row.publicBundleId,
      bundleVersion: row.bundleVersion,
      digest: row.digest,
      publishedAt: row.publishedAt,
      rulesetVersionId: row.rulesetVersionId,
    };
  }
  if (existing) {
    throw new Error("public_bundle_id already exists with different content; bump bundle_version or use a new public_bundle_id");
  }
  const id = `pb_${randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO policy_bundles (id, customer_id, ruleset_version_id, public_bundle_id, bundle_version, digest, rule_files_json, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, customerId, rulesetVersionId, publicBundleId, bundleVersion, digest, JSON.stringify(abs), now);
  if (rulesetVersionId) {
    db.prepare("UPDATE ruleset_versions SET state = 'PUBLISHED', published_bundle_fk = ? WHERE id = ?").run(
      id,
      rulesetVersionId
    );
  }
  return {
    id,
    deduped: false,
    publicBundleId,
    bundleVersion,
    digest,
    publishedAt: now,
    rulesetVersionId: rulesetVersionId || null,
  };
}

export function createRuleset(customerId, name) {
  const db = getDb();
  const id = `rs_${randomUUID()}`;
  db.prepare("INSERT INTO rulesets (id, customer_id, name, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    customerId,
    name,
    new Date().toISOString()
  );
  return { id, customerId, name };
}

export function createRulesetVersion(rulesetId, versionLabel) {
  const db = getDb();
  const id = `rsv_${randomUUID()}`;
  db.prepare("INSERT INTO ruleset_versions (id, ruleset_id, version_label, state, created_at) VALUES (?, ?, ?, 'DRAFT', ?)").run(
    id,
    rulesetId,
    versionLabel,
    new Date().toISOString()
  );
  return { id, rulesetId, versionLabel, state: "DRAFT" };
}

export function listRulesets(customerId) {
  const db = getDb();
  return db
    .prepare("SELECT id, name, created_at as createdAt FROM rulesets WHERE customer_id = ? ORDER BY created_at DESC")
    .all(customerId);
}

export function getRuleset(rulesetId, customerId) {
  return getDb()
    .prepare("SELECT * FROM rulesets WHERE id = ? AND customer_id = ?")
    .get(rulesetId, customerId);
}

export function getRulesetVersions(rulesetId) {
  return getDb()
    .prepare(
      "SELECT id, version_label as versionLabel, state, created_at as createdAt, published_bundle_fk as publishedBundleFk FROM ruleset_versions WHERE ruleset_id = ? ORDER BY created_at DESC"
    )
    .all(rulesetId);
}

export function getDecisionRowsForExport(customerId, from, to) {
  const db = getDb();
  if (from && to) {
    return db
      .prepare(
        `SELECT * FROM decisions WHERE customer_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at ASC`
      )
      .all(customerId, from, to);
  }
  return db.prepare("SELECT * FROM decisions WHERE customer_id = ? ORDER BY created_at ASC").all(customerId);
}

const STATE_EDGES = {
  DRAFT: new Set(["IN_REVIEW"]),
  IN_REVIEW: new Set(["APPROVED"]),
  APPROVED: new Set(),
  PUBLISHED: new Set(["DEPRECATED"]),
  DEPRECATED: new Set(["RETIRED"]),
  RETIRED: new Set(),
};

/**
 * @param {string} rulesetId
 * @param {string} versionId
 * @param {string} customerId
 */
export function getRulesetVersion(rulesetId, versionId, customerId) {
  return getDb()
    .prepare(
      `SELECT rv.id, rv.ruleset_id as rulesetId, rv.version_label as versionLabel, rv.state, rv.created_at as createdAt, rv.published_bundle_fk as publishedBundleFk
       FROM ruleset_versions rv
       INNER JOIN rulesets r ON r.id = rv.ruleset_id
       WHERE rv.id = ? AND rv.ruleset_id = ? AND r.customer_id = ?`
    )
    .get(versionId, rulesetId, customerId);
}

/**
 * Version row plus resolved published bundle (if any) for API_CONTRACTS `GET .../versions/{id}`.
 * @param {string} rulesetId
 * @param {string} versionId
 * @param {string} customerId
 */
export function getRulesetVersionDetail(rulesetId, versionId, customerId) {
  const v = getRulesetVersion(rulesetId, versionId, customerId);
  if (!v) {
    return null;
  }
  if (!v.publishedBundleFk) {
    return { ...v, publishedBundle: null };
  }
  const b = getDb()
    .prepare(
      `SELECT id, public_bundle_id as publicBundleId, bundle_version as bundleVersion, digest,
              rule_files_json as ruleFilesJson, published_at as publishedAt, ruleset_version_id as rulesetVersionId
       FROM policy_bundles WHERE id = ?`
    )
    .get(v.publishedBundleFk);
  return { ...v, publishedBundle: b || null };
}

/**
 * @param {string} rulesetId
 * @param {string} versionId
 * @param {string} customerId
 * @param {string} newState
 */
export function setRulesetVersionState(rulesetId, versionId, customerId, newState) {
  const row = getRulesetVersion(rulesetId, versionId, customerId);
  if (!row) {
    return null;
  }
  const cur = row.state;
  if (newState === cur) {
    return { ...row, state: newState };
  }
  const allow = STATE_EDGES[cur];
  if (!allow || !allow.has(newState)) {
    throw new Error(`invalid ruleset version transition: ${cur} -> ${newState}`);
  }
  getDb().prepare("UPDATE ruleset_versions SET state = ? WHERE id = ?").run(newState, versionId);
  return { ...row, state: newState };
}

/**
 * @param {string} customerId
 * @param {string | null} from
 * @param {string | null} to
 * @param {string} jsonBody pre-serialized export (e.g. from `buildEvidenceExportPayload`)
 */
export function createExportJobAndFile(customerId, from, to, jsonBody) {
  const db = getDb();
  const id = `exp_${randomUUID()}`;
  const now = new Date().toISOString();
  const exportDir = path.join(getDataDir(), "exports");
  fs.mkdirSync(exportDir, { recursive: true });
  const fileName = `${id}.json`;
  const filePath = path.join(exportDir, fileName);
  db
    .prepare(
      "INSERT INTO export_jobs (id, customer_id, status, from_ts, to_ts, created_at) VALUES (?, ?, 'running', ?, ?, ?)"
    )
    .run(id, customerId, from, to, now);
  try {
    fs.writeFileSync(filePath, jsonBody, "utf8");
    const done = new Date().toISOString();
    db.prepare("UPDATE export_jobs SET status = ?, file_path = ?, completed_at = ? WHERE id = ?").run("completed", filePath, done, id);
    return { id, status: "completed", fileName, filePath, completedAt: done };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const done = new Date().toISOString();
    db.prepare("UPDATE export_jobs SET status = ?, error_text = ?, completed_at = ? WHERE id = ?").run("failed", msg, done, id);
    throw e;
  }
}

/**
 * @param {string} id
 * @param {string} customerId
 */
export function getExportJob(id, customerId) {
  return getDb()
    .prepare("SELECT * FROM export_jobs WHERE id = ? AND customer_id = ?")
    .get(id, customerId);
}

/**
 * @param {string} customerId
 * @param {number} limit
 */
export function listExportJobsForCustomer(customerId, limit) {
  const lim = Math.min(100, Math.max(1, limit));
  return getDb()
    .prepare(
      "SELECT id, status, from_ts as fromTs, to_ts as toTs, error_text as errorText, created_at as createdAt, completed_at as completedAt FROM export_jobs WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(customerId, lim);
}

/**
 * @param {string} customerId
 * @param {number} limit
 */
export function listWebhookOutboxForCustomer(customerId, limit) {
  const lim = Math.min(100, Math.max(1, limit));
  return getDb()
    .prepare(
      "SELECT id, event_type as eventType, status, attempt_count as attemptCount, last_error as lastError, created_at as createdAt, next_attempt_at as nextAttemptAt FROM webhook_outbox WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(customerId, lim);
}

/**
 * @param {string} customerId
 * @param {string} jobId
 * @returns {string | null} absolute path to file if job completed
 */
export function getExportFilePathForDownload(customerId, jobId) {
  const job = getExportJob(jobId, customerId);
  if (!job || job.status !== "completed" || !job.file_path) {
    return null;
  }
  const fp = job.file_path;
  const base = path.resolve(getDataDir(), "exports");
  const resolved = path.resolve(fp);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

/**
 * @param {string} customerId
 * @param {string} url
 * @param {string | null} secret
 */
export function upsertWebhook(customerId, url, secret) {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM webhooks WHERE customer_id = ?").get(customerId);
  if (existing) {
    db.prepare("UPDATE webhooks SET url = ?, secret = ? WHERE customer_id = ?").run(url, secret, customerId);
    return { id: existing.id, customerId, url, secret, updatedAt: now };
  }
  const id = `wh_${randomUUID()}`;
  db.prepare("INSERT INTO webhooks (id, customer_id, url, secret, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    customerId,
    url,
    secret,
    now
  );
  return { id, customerId, url, secret, createdAt: now };
}

/**
 * @param {string} customerId
 */
export function getWebhookForCustomer(customerId) {
  return getDb().prepare("SELECT id, url, secret, created_at as createdAt FROM webhooks WHERE customer_id = ?").get(customerId);
}

/**
 * @param {string} raw
 */
export function hashOpaqueToken(raw) {
  return createHash("sha256").update(String(raw), "utf8").digest("hex");
}

export function newRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function listCustomers() {
  return getDb()
    .prepare(
      "SELECT id, name, created_at as createdAt, metadata_json as metadataJson FROM customers ORDER BY created_at ASC"
    )
    .all();
}

/**
 * @param {string} id
 * @param {string} name
 * @param {string | null} [metadataJson]
 */
export function createCustomer(id, name, metadataJson = null) {
  const db = getDb();
  const ex = db.prepare("SELECT id FROM customers WHERE id = ?").get(id);
  if (ex) {
    throw new Error("customer id already exists");
  }
  const now = new Date().toISOString();
  db.prepare("INSERT INTO customers (id, name, created_at, metadata_json) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    now,
    metadataJson
  );
  return { id, name, createdAt: now, metadataJson: metadataJson || null };
}

/**
 * @param {string} customerId
 * @param {string | null} metadataJson
 */
export function updateCustomerMetadata(customerId, metadataJson) {
  getDb().prepare("UPDATE customers SET metadata_json = ? WHERE id = ?").run(metadataJson, customerId);
}

/**
 * @param {string} customerId
 * @param {{ title: string, agentId: string, decisionRef: string | null }} row
 * @returns {{ id: string, title: string, agentId: string, status: string }}
 */
export function insertPendingApproval(customerId, row) {
  const db = getDb();
  const id = `appr_${randomUUID()}`;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO approvals (id, customer_id, title, agent_id, status, created_at, decision_ref) VALUES (?, ?, ?, ?, 'pending', ?, ?)"
  ).run(id, customerId, row.title, row.agentId, now, row.decisionRef);
  return { id, title: row.title, agentId: row.agentId, status: "pending" };
}

// --- users & orgs (B.3 / B.4) ---

export function countUsers() {
  return getDb().prepare("SELECT COUNT(*) as n FROM users").get().n;
}

/**
 * @param {string} email
 */
export function getUserByEmail(email) {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase().trim());
}

/**
 * @param {string} id
 */
export function getUserById(id) {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
}

/**
 * @param {string} customerId
 */
export function getCustomerById(customerId) {
  return getDb()
    .prepare("SELECT id, name, created_at as createdAt, metadata_json as metadataJson FROM customers WHERE id = ?")
    .get(customerId);
}

/**
 * @param {string} id
 * @param {string} email
 * @param {string} passwordHash
 */
export function insertUserRecord(id, email, passwordHash) {
  const now = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, String(email).toLowerCase().trim(), passwordHash, now);
  return { id, email, createdAt: now };
}

/**
 * @param {string} userId
 * @param {string} customerId
 * @param {string} role
 */
export function upsertOrgMembership(userId, customerId, role) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO org_memberships (user_id, customer_id, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, customer_id) DO UPDATE SET role = excluded.role`
    )
    .run(userId, customerId, role, now);
}

/**
 * @param {string} userId
 * @returns {{ customerId: string, role: string, createdAt: string }[]}
 */
export function getMembershipsForUser(userId) {
  return getDb()
    .prepare(
      "SELECT customer_id as customerId, role, created_at as createdAt FROM org_memberships WHERE user_id = ? ORDER BY created_at"
    )
    .all(userId);
}

/**
 * @param {string} customerId
 */
export function listUsersForCustomer(customerId) {
  return getDb()
    .prepare(
      `SELECT u.id, u.email, u.created_at as createdAt, m.role
       FROM users u
       INNER JOIN org_memberships m ON m.user_id = u.id
       WHERE m.customer_id = ?
       ORDER BY u.email`
    )
    .all(customerId);
}

/**
 * @param {string[] | null} allowedCustomerIds
 */
export function listCustomersForScope(allowedCustomerIds) {
  if (allowedCustomerIds == null) {
    return listCustomers();
  }
  if (allowedCustomerIds.length === 0) {
    return [];
  }
  const db = getDb();
  const ph = allowedCustomerIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT id, name, created_at as createdAt, metadata_json as metadataJson FROM customers WHERE id IN (${ph}) ORDER BY created_at`
    )
    .all(...allowedCustomerIds);
}

/**
 * @param {string} userId
 * @param {string} newPasswordHash
 */
export function updateUserPasswordHash(userId, newPasswordHash) {
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newPasswordHash, userId);
}

/**
 * @param {string} userId
 * @param {string} customerId
 */
export function deleteOrgMembership(userId, customerId) {
  getDb().prepare("DELETE FROM org_memberships WHERE user_id = ? AND customer_id = ?").run(userId, customerId);
}

// --- sessions (B.2) ---

/**
 * @param {string} userId
 * @param {string} refreshHash
 * @param {string} expiresAtIso
 */
export function createSessionRow(userId, refreshHash, expiresAtIso) {
  const id = `ses_${randomUUID()}`;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO sessions (id, user_id, refresh_hash, expires_at, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)"
    )
    .run(id, userId, refreshHash, expiresAtIso, now);
  return { id, userId, expiresAt: expiresAtIso };
}

/**
 * @param {string} refreshTokenRaw
 */
export function getActiveSessionByRefreshToken(refreshTokenRaw) {
  const h = hashOpaqueToken(refreshTokenRaw);
  const now = new Date().toISOString();
  return getDb()
    .prepare("SELECT * FROM sessions WHERE refresh_hash = ? AND revoked = 0 AND expires_at > ?")
    .get(h, now);
}

/**
 * @param {string} sessionId
 */
export function revokeSession(sessionId) {
  getDb().prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(sessionId);
}

/**
 * @param {string} userId
 */
export function revokeAllSessionsForUser(userId) {
  getDb().prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(userId);
}

// --- password reset (B.2) ---

/**
 * @param {string} userId
 * @param {string} tokenHash
 * @param {string} expiresAtIso
 */
export function createPasswordResetRow(userId, tokenHash, expiresAtIso) {
  const id = `pr_${randomUUID()}`;
  const now = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, tokenHash, expiresAtIso, now);
  return { id, expiresAt: expiresAtIso };
}

/**
 * @param {string} rawToken
 */
export function getPasswordResetByRawToken(rawToken) {
  const h = hashOpaqueToken(rawToken);
  const now = new Date().toISOString();
  return getDb()
    .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(h, now);
}

/**
 * @param {string} id
 */
export function markPasswordResetUsed(id) {
  getDb().prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

// --- org invites (B.4) ---

/**
 * @param {object} o
 */
export function createOrgInviteRow(o) {
  const id = `inv_${randomUUID()}`;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO org_invites (id, customer_id, email, role, token_hash, expires_at, created_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      o.customerId,
      o.email,
      o.role,
      o.tokenHash,
      o.expiresAt,
      now,
      o.createdByUserId || null
    );
  return { id };
}

/**
 * @param {string} rawToken
 */
export function getOrgInviteByRawToken(rawToken) {
  const h = hashOpaqueToken(rawToken);
  const now = new Date().toISOString();
  return getDb()
    .prepare("SELECT * FROM org_invites WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?")
    .get(h, now);
}

/**
 * @param {string} id
 */
export function markOrgInviteAccepted(id) {
  getDb().prepare("UPDATE org_invites SET accepted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

// --- audit (B.2/B.3) ---

/**
 * @param {object} r
 * @param {string} r.actorType
 * @param {string | null} r.actorId
 * @param {string} r.action
 * @param {string | null} [r.customerId]
 * @param {string | null} [r.targetType]
 * @param {string | null} [r.targetId]
 * @param {object | null} [r.detail]
 */
export function insertAuditLog(r) {
  const id = `aud_${randomUUID()}`;
  const at = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO audit_log (id, at, actor_type, actor_id, action, customer_id, target_type, target_id, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      id,
      at,
      r.actorType,
      r.actorId ?? null,
      r.action,
      r.customerId ?? null,
      r.targetType ?? null,
      r.targetId ?? null,
      r.detail != null ? JSON.stringify(r.detail) : null
    );
  return { id, at };
}

/**
 * @param {string} customerId
 * @param {number} limit
 */
export function listAuditForCustomer(customerId, limit) {
  return getDb()
    .prepare(
      "SELECT id, at, actor_type as actorType, actor_id as actorId, action, target_type as targetType, target_id as targetId, detail_json as detailJson FROM audit_log WHERE customer_id = ? ORDER BY at DESC LIMIT ?"
    )
    .all(customerId, limit);
}

// --- agents (MVP module 1) ---

/**
 * @param {object} row
 */
function mapAgentRow(row) {
  if (!row) {
    return null;
  }
  let channels = [];
  let metadata = {};
  try {
    channels = row.channels_json ? JSON.parse(row.channels_json) : [];
  } catch {
    channels = [];
  }
  try {
    metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
  } catch {
    metadata = {};
  }
  return {
    agentId: row.id,
    customerId: row.customer_id,
    name: row.name,
    status: row.status,
    orgId: row.org_id || null,
    channels: Array.isArray(channels) ? channels : [],
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {string} customerId
 * @param {object} input
 * @param {string} input.name
 * @param {string | null} [input.orgId]
 * @param {string[]} [input.channels]
 * @param {object} [input.metadata]
 */
export function createAgent(customerId, input) {
  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("agent_name required");
  }
  const id = `agt_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const now = new Date().toISOString();
  const channels = Array.isArray(input.channels) ? input.channels.map(String) : [];
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const orgId = input.orgId != null && String(input.orgId).trim() ? String(input.orgId).trim() : null;
  try {
    getDb()
      .prepare(
        `INSERT INTO agents (id, customer_id, name, status, org_id, channels_json, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
      )
      .run(id, customerId, name, orgId, JSON.stringify(channels), JSON.stringify(metadata), now, now);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("agent_name already exists for customer");
    }
    throw e;
  }
  return getAgent(customerId, id);
}

/**
 * @param {string} customerId
 * @param {string} agentId
 */
export function getAgent(customerId, agentId) {
  const row = getDb()
    .prepare("SELECT * FROM agents WHERE customer_id = ? AND id = ?")
    .get(customerId, agentId);
  return mapAgentRow(row);
}

/**
 * @param {string} customerId
 * @param {{ includeInactive?: boolean }} [opts]
 */
export function listAgents(customerId, opts = {}) {
  const includeInactive = Boolean(opts.includeInactive);
  const rows = includeInactive
    ? getDb().prepare("SELECT * FROM agents WHERE customer_id = ? ORDER BY created_at DESC").all(customerId)
    : getDb()
        .prepare("SELECT * FROM agents WHERE customer_id = ? AND status = 'active' ORDER BY created_at DESC")
        .all(customerId);
  return rows.map(mapAgentRow);
}

/**
 * @param {string} customerId
 * @param {string} agentId
 * @param {object} patch
 */
export function updateAgent(customerId, agentId, patch) {
  const existing = getDb()
    .prepare("SELECT * FROM agents WHERE customer_id = ? AND id = ?")
    .get(customerId, agentId);
  if (!existing) {
    return null;
  }
  const name =
    patch.name != null ? String(patch.name).trim() : existing.name;
  if (!name) {
    throw new Error("agent_name required");
  }
  const orgId =
    patch.orgId !== undefined
      ? patch.orgId == null || String(patch.orgId).trim() === ""
        ? null
        : String(patch.orgId).trim()
      : existing.org_id;
  let channelsJson = existing.channels_json;
  if (patch.channels !== undefined) {
    if (!Array.isArray(patch.channels)) {
      throw new Error("channels must be an array");
    }
    channelsJson = JSON.stringify(patch.channels.map(String));
  }
  let metadataJson = existing.metadata_json;
  if (patch.metadata !== undefined) {
    if (!patch.metadata || typeof patch.metadata !== "object" || Array.isArray(patch.metadata)) {
      throw new Error("metadata must be an object");
    }
    metadataJson = JSON.stringify(patch.metadata);
  }
  const status =
    patch.status != null ? String(patch.status).trim().toLowerCase() : existing.status;
  if (status !== "active" && status !== "inactive") {
    throw new Error("status must be active or inactive");
  }
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `UPDATE agents SET name = ?, org_id = ?, channels_json = ?, metadata_json = ?, status = ?, updated_at = ?
         WHERE customer_id = ? AND id = ?`
      )
      .run(name, orgId, channelsJson, metadataJson, status, now, customerId, agentId);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("agent_name already exists for customer");
    }
    throw e;
  }
  return getAgent(customerId, agentId);
}

/**
 * Soft-deactivate (status=inactive).
 * @param {string} customerId
 * @param {string} agentId
 */
export function deactivateAgent(customerId, agentId) {
  return updateAgent(customerId, agentId, { status: "inactive" });
}

// --- webhook outbox (D.4) ---

const MAX_OUTBOX_ATTEMPTS = 8;

/**
 * @param {object} o
 * @param {string} o.customerId
 * @param {string} o.eventType
 * @param {string} o.url
 * @param {string | null} o.secret
 * @param {string} o.idempotencyKey
 * @param {object} o.payload
 */
export function enqueueWebhookOutbox(o) {
  const db = getDb();
  const id = `wout_${randomUUID()}`;
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(o.payload);
  try {
    db.prepare(
      `INSERT INTO webhook_outbox (id, customer_id, event_type, payload_json, url, secret, idempotency_key, attempt_count, last_error, status, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 'pending', ?, ?)`
    ).run(
      id,
      o.customerId,
      o.eventType,
      payloadJson,
      o.url,
      o.secret,
      o.idempotencyKey,
      now,
      now
    );
    return { id, new: true };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { id: null, new: false };
    }
    throw e;
  }
}

export function getPendingOutboxBatch(limit = 8) {
  const now = new Date().toISOString();
  return getDb()
    .prepare(
      `SELECT * FROM webhook_outbox WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at LIMIT ?`
    )
    .all(now, limit);
}

/**
 * @param {string} id
 */
export function markOutboxSent(id) {
  getDb().prepare("UPDATE webhook_outbox SET status = 'sent', last_error = NULL WHERE id = ?").run(id);
}

/**
 * @param {string} id
 * @param {string} errMsg
 * @param {number} attemptCount
 */
export function markOutboxFailedRetry(id, errMsg, attemptCount) {
  if (attemptCount >= MAX_OUTBOX_ATTEMPTS) {
    getDb()
      .prepare("UPDATE webhook_outbox SET status = 'failed', last_error = ? WHERE id = ?")
      .run(errMsg.slice(0, 2000), id);
    return;
  }
  const delayMs = Math.min(60_000, 500 * 2 ** attemptCount);
  const next = new Date(Date.now() + delayMs).toISOString();
  getDb()
    .prepare(
      "UPDATE webhook_outbox SET attempt_count = ?, last_error = ?, next_attempt_at = ?, status = 'pending' WHERE id = ?"
    )
    .run(attemptCount, errMsg.slice(0, 2000), next, id);
}

export { getAgfSp1Root };
