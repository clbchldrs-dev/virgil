# GitHub Issues: product opportunities (Option A)

Virgil can file **GitHub Issues** when using **AI Gateway models** (not local Ollama) so you can triage ideas in the same place Cursor agents already work.

## Behavior

- Tool: `submitProductOpportunity` ([`lib/ai/tools/submit-product-opportunity.ts`](../lib/ai/tools/submit-product-opportunity.ts)).
- **Local Ollama chats do not register this tool** — keeps the small-model path light.
- **Reasoning / “no tools” gateway models:** Some models report `reasoning` but **not** `tools` from the gateway. The chat route sets `experimental_activeTools` to **[]** for those models, so **no tools run at all** in that session — including `submitProductOpportunity` — even if `GITHUB_*` is configured. Use a tool-capable gateway model to file issues.
- The model should only call it **after the user agrees** (see system prompt hints in companion / front-desk prompts).
- Issues include alignment fields (local-first, low cost, test plan) and anonymized `userRef` + `chatId` for correlation — no email in the body.
- **Errors:** Failed GitHub API calls return **sanitized** messages to the tool result (no raw JSON bodies). Check server logs for details.

## Workflow: Issue → backlog (human)

Nothing is written automatically into **system prompts** or product code from an issue.

1. User submits via the tool → **GitHub Issue** (with labels you configure).
2. **Owner triage** — label, comment, close, or `approved-for-build` when you want work tracked.
3. **Synthesis (optional, on your cadence)** — e.g. monthly or after a release: review open `product-opportunity` issues; for ideas you accept, add a row to [ENHANCEMENTS.md](ENHANCEMENTS.md) or a line in [VIRGIL_ROADMAP_LINUX_24_7.md](VIRGIL_ROADMAP_LINUX_24_7.md). **You** edit the markdown; the repo does not auto-merge feedback into prompts.

### Synthesis pass (template)

When you add something from an issue to the backlog, capture short bullets:

- **Source:** issue `#NN` (link)
- **Idea:** one sentence
- **Why now / fit:** local-first, cost, testability
- **Backlog row:** new `E…` or update existing row in ENHANCEMENTS

External ideas (e.g. from [OpenClaw](https://github.com/openclaw/openclaw) communities) follow the same rule: **human-reviewed** rows only.

## Setup

1. **Repository** — set `GITHUB_REPOSITORY` to `owner/repo` (same repo you open in Cursor).

2. **Token** — create a **fine-grained PAT** (or classic PAT) with **Issues: read and write** on that repo. Prefer a dedicated secret:
   - `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` (recommended), or
   - `GITHUB_TOKEN` if you do not use it elsewhere.

3. **Labels (optional)** — default labels sent with each issue: `product-opportunity`, `needs-owner-decision`. Create them in the repo (**Issues → Labels**) or omit them by setting:

   ```bash
   GITHUB_PRODUCT_OPPORTUNITY_LABELS=
   ```

   If labels are missing, the API may return 422; the server **retries once without labels** so the issue still opens.

4. **Owner triage** — add a label such as `approved-for-build` when you want agents to pick up work, or close the issue.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_REPOSITORY` | Yes | `owner/repo` |
| `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` or `GITHUB_TOKEN` | Yes | PAT with `issues: write` |
| `GITHUB_PRODUCT_OPPORTUNITY_LABELS` | No | Comma-separated; default see [`lib/github/product-opportunity-issue.ts`](../lib/github/product-opportunity-issue.ts) |

Documented in [`.env.example`](../.env.example) and [AGENTS.md](../AGENTS.md#deployment-production) (env table).

## Related

- [docs/PROJECT.md](PROJECT.md) — self-improvement via backlog and review  
- [docs/ENHANCEMENTS.md](ENHANCEMENTS.md) — enhancement acceptance criteria  
- [docs/superpowers/plans/2026-03-29-security-hardening-agents.md](superpowers/plans/2026-03-29-security-hardening-agents.md) — security review notes (abuse limits, gateway tools)  
