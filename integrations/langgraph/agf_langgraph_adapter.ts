/**
 * Thin LangChain/LangGraph adapter for AGF policy execution gateway.
 *
 * Use this guard before tool execution nodes.
 */

export type AgfEvaluateRequest = {
  rule_file: string;
  entity_id: number;
  data: Record<string, number>;
};

export type AgfEvaluateResponse = {
  decision: "PASS" | "BLOCK";
  total_rules: number;
  pass_count: number;
  block_count: number;
  evaluation_ms: number;
  signature: string;
  audit: {
    log_id: number;
    proof_hash: string;
    chain_hash: string;
    timestamp_utc: string;
  };
};

export type PlatformDecision = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

export type AgfLangGraphAdapterOptions = {
  agfBaseUrl: string;
  ruleFile: string;
  requireApprovalWhen?: (result: AgfEvaluateResponse) => boolean;
};

export async function runAgfGuard(
  options: AgfLangGraphAdapterOptions,
  input: { entityId: number; data: Record<string, number> },
): Promise<{ decision: PlatformDecision; evidence: AgfEvaluateResponse }> {
  const payload: AgfEvaluateRequest = {
    rule_file: options.ruleFile,
    entity_id: input.entityId,
    data: input.data,
  };

  const response = await fetch(`${options.agfBaseUrl}/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AGF evaluate failed: ${response.status} ${response.statusText}`);
  }

  const evidence = (await response.json()) as AgfEvaluateResponse;
  let decision: PlatformDecision;

  if (evidence.decision === "BLOCK") {
    decision = "BLOCK";
  } else if (options.requireApprovalWhen?.(evidence)) {
    decision = "REQUIRE_APPROVAL";
  } else {
    decision = "ALLOW";
  }

  return { decision, evidence };
}

