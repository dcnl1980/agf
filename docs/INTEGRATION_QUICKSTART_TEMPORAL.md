# Integration Quickstart: Temporal + AGF

## Goal

Add AGF pre-execution governance to Temporal workflows without rewriting core business logic.

## Files

- Adapter: `integrations/temporal/agf_temporal_adapter.ts`
- Kernel endpoints used: `POST /evaluate-entity`, `GET /public-key`

## 1) Start AGF Server

```bash
cd /Users/cvsteenbergen/Code/agf/agf-sp1
cargo run -p agf-server --bin agf-server
```

## 2) Configure Adapter in Worker Code

```ts
import { AgfTemporalAdapter } from "../../integrations/temporal/agf_temporal_adapter";

const agf = new AgfTemporalAdapter({
  agfBaseUrl: "http://127.0.0.1:3000",
  ruleFiles: [
    "agf-sp1/rules/finance/psd2_sca.arsl.toml",
    "agf-sp1/rules/insurance/solvency_ii.arsl.toml",
  ],
  requireApprovalWhen: (result) => result.total_pass > 0 && result.evaluation_ms > 5,
});
```

## 3) Guard Side-Effectful Activity

```ts
export async function executePaymentActivity(input: {
  entityId: number;
  entityName: string;
  amountCents: number;
  capitalRatioBps: number;
}) {
  const gate = await agf.evaluateBeforeActivity({
    entityId: input.entityId,
    entityName: input.entityName,
    data: {
      transaction_amount: input.amountCents,
      capital_ratio: input.capitalRatioBps,
    },
  });

  if (gate.decision === "BLOCK") {
    throw new Error(`Blocked by AGF. proof=${gate.evidence.audit.proof_hash}`);
  }

  if (gate.decision === "REQUIRE_APPROVAL") {
    return {
      status: "pending_approval",
      evidence: gate.evidence,
    };
  }

  // Continue with existing payment side effects.
  return { status: "executed", evidence: gate.evidence };
}
```

## 4) Verify Returned Evidence

- Persist `signature`, `proof_hash`, `chain_hash`, and bundle version pin in evidence store.
- Retrieve AGF public key from `GET /public-key` for independent verification.

## Production Notes

- Control plane should provide pinned published bundles to the adapter.
- Do not send draft rules directly to kernel evaluation endpoints.
- Keep customer evidence and key ownership boundaries isolated.
