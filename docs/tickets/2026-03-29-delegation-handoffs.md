# Delegation handoffs (2026-03-29)

Explore agents were run **read-only** against the Virgil repo (e.g. `/Users/caleb/Documents/virgil`) to map implementation surfaces for open tickets. Use this as a starting point for implementation PRs; verify line numbers after pulls.

---

## VIRG-E2 — Per-model prompt variants

**Status (2026-03-29):** Shipped baseline — `LocalModelClass`, `inferLocalModelClassFromOllamaTag`, `getResolvedLocalModelClass`; slim/compact prompts in `lib/ai/slim-prompt.ts`; `route.ts` passes class for local Ollama; discovered models in `ollama-discovery.ts`; ADR in `docs/DECISIONS.md`. Optional follow-ups (extra presets, `full`-path splits) remain in the E2 ticket.

**Flow:** `getChatModelWithLocalFallback` → `promptVariant` × **`localModelClass`** → `route.ts` chooses `buildCompact*` / `buildSlim*` / full `build*SystemPrompt` for local Ollama; gateway always uses full builders.

**Merge risk with E3:** Both touch `route.ts` near `systemTokenEstimate` + `trimMessagesForBudget` — coordinate or sequence.

---

## VIRG-E3 — Smart context compression

**Status (2026-04):** Shipped — `TOKENS_PER_MESSAGE_OVERHEAD`, long user/assistant compression, plus `shrinkMiddleTrialToBudget` (removable assistant before removable user; structural tool parts protected until last resort) and no long-message compression for tool-bearing messages.

**Behavior:** `lib/ai/trim-context.ts` — char/3.5 token heuristic + overhead per message; local-only trim in `route.ts`. Long history: keep `first`, greedy middle from newest, tail cap 4 or 6; trim marker `[earlier conversation trimmed]`. Long turns >200 est. tokens compressed to ~150.

**Tests:** `tests/unit/trim-context.test.ts`, `tests/unit/local-context.test.ts` (marker + budget).

---

## VIRG-E6 — Product feedback (`submitProductOpportunity`)

**Status (2026-03-29):** Partially shipped — `sanitizeProductOpportunityToolError`; expanded [github-product-opportunity.md](../github-product-opportunity.md) (no-tools/reasoning, Issue→backlog workflow, synthesis template, security link). Optional follow-ups: per-user issue caps per security plan.

**Paths:** `lib/ai/tools/submit-product-opportunity.ts`, `lib/github/product-opportunity-issue.ts`, wired in `route.ts` (gateway + configured). Auth = same as chat session; env: `GITHUB_REPOSITORY`, `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` or `GITHUB_TOKEN`, optional labels.

---

## VIRG-E7 — Night insights + digest merge

**Status (2026-03-29):** Partially shipped — `buildNightReviewRunGroups` + facet labels in [`lib/night-review/digest-display.ts`](../lib/night-review/digest-display.ts); UI groups by run, batch accept/dismiss; `mergeToolCounts` in `build-context.ts` remains **review-prompt-only** (not end-user digest).

**Paths:** `app/(chat)/night-insights/page.tsx`, `night-insights-client.tsx`, `app/(chat)/api/memories/night-review/route.ts`, `lib/db/query-modules/night-review.ts`, `lib/night-review/run-night-review.ts`.

**Guardrails:** Night job does not write workspace core files (read-only `workspace.ts`); README updated for `/night-insights` vs prompts.

---

## VIRG-E8-follow — NVIDIA + GPU Ollama

**Repo:** `docker-compose.yml` has **no** GPU on `ollama`; `docker-compose.override.example.yml` is pointer-only; host GPU path = `docker-compose.host-ollama.yml` + host Ollama.

**Next:** Add `docker-compose.gpu.yml` or documented override (`deploy.resources.reservations.devices` or `gpus: all`), AGENTS.md + beta-lan steps for NVIDIA Container Toolkit and `docker run --gpus all` smoke.

---

## VIRG-P4 — Host cron, LAN, env docs

**Status (2026-03-29):** Shipped — [AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron) (curl, systemd, UTC), [AGENTS.md § self-hosted schedules](../AGENTS.md#self-hosted-schedules-no-vercel-cron) (inventory + LAN + enqueue base URL), env table extended for `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, etc.
