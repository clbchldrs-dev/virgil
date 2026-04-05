# V2 cost telemetry (what v1 can measure now)

**Status:** Groundwork artifact for E10/T7.  
**Related:** [workspace/v2-eval/README.md](../workspace/v2-eval/README.md), [V2_MIGRATION.md](V2_MIGRATION.md), ticket [T7](tickets/2026-04-01-v2-t7-gateway-cost-telemetry.md).

---

## 1) Current capture point in v1

The best per-turn hook is `onFinish` in `app/(chat)/api/chat/route.ts`, where we already collect interaction metadata and can safely append optional JSONL logs.

For cost-oriented logging we only record when the effective tier is gateway-like (`gateway` or `gemini`) and keep local/Ollama rows out of gateway cost files.

---

## 2) Fields we can know today (best-effort)

From the stream finish event usage object (when present), we can log:

- `inputTokens` (prompt tokens)
- `outputTokens` (completion tokens)
- `totalTokens`

From route context we can always log:

- `timestamp`
- `chatId`
- `requestedModelId`
- `effectiveModelId`
- `fallbackTier` (`ollama` | `gemini` | `gateway` | `none`)

The optional JSONL row shape for `workspace/v2-eval/costs.jsonl` is:

```json
{
  "timestamp": "2026-04-05T10:22:00.000Z",
  "chatId": "…",
  "requestedModelId": "…",
  "effectiveModelId": "…",
  "fallbackTier": "gateway",
  "inputTokens": 123,
  "outputTokens": 456,
  "totalTokens": 579
}
```

---

## 3) Known limits and caveats

- Usage metadata is provider-dependent; some rows can contain `null` token fields.
- Local Ollama paths may omit usage or follow different token semantics; we do not force synthetic gateway costs for them.
- These logs are calibration inputs, not billing truth.

---

## 4) What still needs provider/billing integration

- Per-model USD conversion (stable price tables by provider/model/version).
- Billed vs estimated token reconciliation.
- Monthly budget enforcement logic beyond offline JSONL analysis.
- Non-chat model spend (night-review, background workers) in the same ledger.

---

## 5) Operational guidance

- Keep logging opt-in via env flags.
- Keep logs local and gitignored (`workspace/v2-eval/costs.jsonl`).
- Treat rows as sensitive metadata even without raw conversation text.
