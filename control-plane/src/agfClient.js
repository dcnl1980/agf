const AGF_KERNEL_URL = (process.env.AGF_KERNEL_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

/**
 * @param {object} body EvaluateEntityRequest
 */
export async function postEvaluateEntity(body) {
  const res = await fetch(`${AGF_KERNEL_URL}/evaluate-entity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await res.text();
  let json;
  if (!res.ok) {
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`AGF ${res.status}: ${text || res.statusText}`);
    }
    throw new Error(`AGF ${res.status}: ${json?.message || text || res.statusText}`);
  }
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`AGF returned non-JSON: ${text.slice(0, 200)}`);
  }
  return json;
}

/**
 * Map kernel `overall_decision` (and optional AGF response metadata) to platform decision.
 * `human_review: true` in the JSON response yields REQUIRE_APPROVAL for the control-plane queue.
 * @param {string} overall
 * @param {Record<string, unknown> | null | undefined} [agf]
 */
export function mapKernelToPlatform(overall, agf) {
  if (agf && typeof agf === "object" && agf.human_review === true) {
    return "REQUIRE_APPROVAL";
  }
  if (typeof overall === "string" && overall.toUpperCase() === "REVIEW") {
    return "REQUIRE_APPROVAL";
  }
  if (overall === "BLOCK") {
    return "BLOCK";
  }
  if (overall === "PASS") {
    return "ALLOW";
  }
  return "ALLOW";
}

export async function fetchKernelHealth() {
  const url = `${AGF_KERNEL_URL}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      return { reachable: false, agfBaseUrl: AGF_KERNEL_URL, error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    return { reachable: true, agfBaseUrl: AGF_KERNEL_URL, agf: body };
  } catch (e) {
    return {
      reachable: false,
      agfBaseUrl: AGF_KERNEL_URL,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export { AGF_KERNEL_URL };
