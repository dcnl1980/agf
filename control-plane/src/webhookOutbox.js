import { getPendingOutboxBatch, markOutboxFailedRetry, markOutboxSent } from "./db.js";
import { postHmacWebhook } from "./webhookDispatch.js";

/**
 * @returns {Promise<void>}
 */
export async function processOutboxOnce() {
  const rows = getPendingOutboxBatch(8);
  for (const row of rows) {
    const attempt = row.attempt_count || 0;
    let inner;
    try {
      inner = JSON.parse(row.payload_json);
    } catch {
      markOutboxFailedRetry(row.id, "invalid payload_json", attempt + 1);
      // eslint-disable-next-line no-continue
      continue;
    }
    try {
      await postHmacWebhook(row.url, row.secret, row.event_type, inner);
      markOutboxSent(row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      markOutboxFailedRetry(row.id, msg, attempt + 1);
    }
  }
}

/**
 * @param {number} intervalMs
 * @returns {NodeJS.Timeout}
 */
export function startOutboxWorker(intervalMs = 2500) {
  return setInterval(() => {
    void processOutboxOnce().catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[outbox]", e);
    });
  }, intervalMs);
}
