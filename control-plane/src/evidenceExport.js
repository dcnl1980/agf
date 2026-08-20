import { createHash, randomUUID } from "crypto";
import { getDb } from "./db.js";

const EXPORT_CONTRACT = "agf.evidence_export/v1";

/**
 * @param {string | null | undefined} h
 */
function hashRef(h) {
  if (h == null || h === "") {
    return null;
  }
  const s = String(h);
  return s.includes(":") ? s : `blake3:${s}`;
}

/**
 * @param {Record<string, unknown>} row
 */
function mapRowToDecisionRecord(row) {
  const sig = row.signature;
  return {
    decision_id: row.id,
    customer_id: row.customer_id,
    entity_id: row.entity_id,
    entity_name: row.entity_name ?? null,
    decision: row.platform_decision,
    kernel_decision_raw: row.kernel_decision_raw ?? null,
    created_at: row.created_at,
    integrity: {
      proof_hash: hashRef(/** @type {string | null | undefined} */ (row.proof_hash)),
      chain_hash: hashRef(/** @type {string | null | undefined} */ (row.chain_hash)),
    },
    signature: sig || null,
    policy_ref:
      row.public_bundle_id != null
        ? {
            bundle_id: row.public_bundle_id,
            bundle_version: row.bundle_version ?? null,
            bundle_digest: hashRef(/** @type {string | null | undefined} */ (row.bundle_digest)),
          }
        : null,
  };
}

/**
 * Time-range (or all) decision export aligned with `docs/EVIDENCE_SCHEMA.md` MVP shape.
 * @param {string} customerId
 * @param {string | null} from
 * @param {string | null} to
 * @param {string} [exportId]
 */
export function buildEvidenceExportPayload(customerId, from, to, exportId = `exp_${randomUUID()}`) {
  const db = getDb();
  let rows;
  if (from && to) {
    rows = db
      .prepare(
        `SELECT d.id, d.customer_id, d.entity_id, d.entity_name, d.platform_decision, d.kernel_decision_raw,
                d.public_bundle_id, d.proof_hash, d.chain_hash, d.signature, d.created_at,
                pb.bundle_version, pb.digest AS bundle_digest
         FROM decisions d
         LEFT JOIN policy_bundles pb ON pb.customer_id = d.customer_id AND pb.public_bundle_id = d.public_bundle_id
         WHERE d.customer_id = ? AND d.created_at >= ? AND d.created_at <= ?
         ORDER BY d.created_at ASC`
      )
      .all(customerId, from, to);
  } else {
    rows = db
      .prepare(
        `SELECT d.id, d.customer_id, d.entity_id, d.entity_name, d.platform_decision, d.kernel_decision_raw,
                d.public_bundle_id, d.proof_hash, d.chain_hash, d.signature, d.created_at,
                pb.bundle_version, pb.digest AS bundle_digest
         FROM decisions d
         LEFT JOIN policy_bundles pb ON pb.customer_id = d.customer_id AND pb.public_bundle_id = d.public_bundle_id
         WHERE d.customer_id = ?
         ORDER BY d.created_at ASC`
      )
      .all(customerId);
  }

  const decisionRecords = rows.map((r) => mapRowToDecisionRecord(r));
  const generatedAt = new Date().toISOString();

  const bundleIds = new Set();
  for (const r of rows) {
    if (r.public_bundle_id) {
      bundleIds.add(r.public_bundle_id);
    }
  }

  const bodyObj = {
    export_contract: EXPORT_CONTRACT,
    export_id: exportId,
    customer_id: customerId,
    generated_at: generatedAt,
    window: { from: from || null, to: to || null },
    counts: {
      decisions: decisionRecords.length,
      bundles: bundleIds.size,
    },
    records: {
      decision_records: decisionRecords,
    },
  };

  const manifestInput = JSON.stringify({ decision_records: decisionRecords });
  const manifest_hash = `sha256:${createHash("sha256").update(manifestInput, "utf8").digest("hex")}`;

  return { ...bodyObj, manifest_hash };
}
