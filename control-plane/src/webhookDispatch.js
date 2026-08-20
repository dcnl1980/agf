import crypto from "crypto";

/**
 * @param {string} url
 * @param {string | null | undefined} secret
 * @param {string} eventType
 * @param {Record<string, unknown>} payload
 */
export async function postHmacWebhook(url, secret, eventType, payload) {
  const body = JSON.stringify({
    type: eventType,
    at: new Date().toISOString(),
    ...payload,
  });
  /** @type {Record<string, string>} */
  const headers = { "content-type": "application/json" };
  if (secret) {
    const sig = crypto.createHmac("sha256", String(secret)).update(body).digest("hex");
    headers["x-agf-signature-256"] = `sha256=${sig}`;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15_000);
  let r;
  try {
    r = await fetch(url, { method: "POST", headers, body, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`webhook HTTP ${r.status} ${t.slice(0, 200)}`);
  }
}
