/**
 * Thin Temporal adapter for AGF policy execution gateway.
 *
 * Purpose: call AGF before side-effectful activities execute.
 * This file is intentionally framework-light so teams can copy it into an existing worker codebase.
 */

export type AgfEvaluateEntityRequest = {
  entity_id: number;
  entity_name: string;
  rule_files: string[];
  data: Record<string, number>;
};

export type AgfEvaluateEntityResponse = {
  entity_id: number;
  entity_name: string;
  overall_decision: "PASS" | "BLOCK";
  total_rules: number;
  total_pass: number;
  total_block: number;
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

type AdapterOptions = {
  agfBaseUrl: string;
  ruleFiles: string[];
  requireApprovalWhen?: (result: AgfEvaluateEntityResponse) => boolean;
};

export class AgfTemporalAdapter {
  constructor(private readonly options: AdapterOptions) {}

  async evaluateBeforeActivity(input: {
    entityId: number;
    entityName: string;
    data: Record<string, number>;
  }): Promise<{ decision: PlatformDecision; evidence: AgfEvaluateEntityResponse }> {
    const payload: AgfEvaluateEntityRequest = {
      entity_id: input.entityId,
      entity_name: input.entityName,
      rule_files: this.options.ruleFiles,
      data: input.data,
    };

    const response = await fetch(`${this.options.agfBaseUrl}/evaluate-entity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AGF evaluate-entity failed: ${response.status} ${response.statusText}`);
    }

    const evidence = (await response.json()) as AgfEvaluateEntityResponse;
    const decision = this.mapDecision(evidence);

    return { decision, evidence };
  }

  private mapDecision(result: AgfEvaluateEntityResponse): PlatformDecision {
    if (result.overall_decision === "BLOCK") {
      return "BLOCK";
    }
    if (this.options.requireApprovalWhen?.(result)) {
      return "REQUIRE_APPROVAL";
    }
    return "ALLOW";
  }
}

