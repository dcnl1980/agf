# Integration Quickstart: LangChain / LangGraph + AGF

## Goal

Use AGF as a deterministic pre-tool execution gate in LangChain/LangGraph flows.

## Files

- Adapter: `integrations/langgraph/agf_langgraph_adapter.ts`
- Kernel endpoints used: `POST /evaluate`, `GET /public-key`

## 1) Start AGF Server

```bash
cd /Users/cvsteenbergen/Code/agf/agf-sp1
cargo run -p agf-server --bin agf-server
```

## 2) Add Guard Before Tool Node

```ts
import { runAgfGuard } from "../../integrations/langgraph/agf_langgraph_adapter";

async function guardedToolNode(state: {
  entityId: number;
  toolInput: { amountCents: number; riskScore: number };
}) {
  const gate = await runAgfGuard(
    {
      agfBaseUrl: "http://127.0.0.1:3000",
      ruleFile: "agf-sp1/rules/finance/psd2_sca.arsl.toml",
      requireApprovalWhen: (result) => result.pass_count > 0 && result.evaluation_ms > 5,
    },
    {
      entityId: state.entityId,
      data: {
        transaction_amount: state.toolInput.amountCents,
        aml_risk_score: state.toolInput.riskScore,
      },
    },
  );

  if (gate.decision === "BLOCK") {
    return {
      status: "blocked",
      reason: "blocked_by_agf",
      evidence: gate.evidence,
    };
  }

  if (gate.decision === "REQUIRE_APPROVAL") {
    return {
      status: "pending_approval",
      evidence: gate.evidence,
    };
  }

  // Continue existing tool execution path.
  return {
    status: "allowed",
    evidence: gate.evidence,
  };
}
```

## 3) Wire HITL Escalation

- On `REQUIRE_APPROVAL`, push item to control-plane approvals queue.
- Store evidence payload ID and AGF signature in queue metadata.
- Resume graph/tool execution only after approval resolution.

## 4) Evidence Handling

- Persist decision + signature + chain hashes in customer evidence store.
- Keep policy version pin in evidence payload for replay/verifiability.
- Use `GET /public-key` for independent signature verification.

## Production Notes

- Control plane owns ruleset lifecycle and publication.
- Kernel executes only pinned, validated, published rules.
- This guard path should remain deterministic and side-effect-free before the tool action.
