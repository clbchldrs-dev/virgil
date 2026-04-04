# Architecture decisions (ADR-style)

Significant, stable choices for Virgil. New entries go at the **top** (reverse chronological). Summaries also appear in [AGENTS.md Key Decisions](../AGENTS.md#key-decisions); this file is the **traceable** record.

---

## 2026-04-02 — Target architecture: Virgil brain + Agent Zero executor (scoped, not shipped) — Accepted

**Context:** Owner hardware (Mac mini with 48 GB unified memory) and product intent (capable local agent, delegated computer use, skills, bounded self-improvement) were discussed outside committed docs. The shipped codebase remains TypeScript-only for tools; OpenClaw was referenced only as inspiration for workspace/night patterns, which caused confusion about the real target stack.

**Decision:**

1. **Document** the target split in [`docs/TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md): **Virgil (this repo)** = brain (UI, auth, Postgres, routing, in-repo tools, night review, agent-task queue). **Agent Zero** (Python, external) = preferred **headless executor** for rich skills/shell/plugins on the home machine—not OpenClaw as a bundled runtime.
2. **Hardware:** Treat a **Mac mini with ~48 GB unified memory** as the **primary** deployment profile for that home stack (Ollama + optional executor + Docker services).
3. **Bridge:** A future **authenticated** Virgil → executor bridge is **planned**; until implemented, no claim that Agent Zero is integrated.
4. **Self-fix / learn skills:** “Fix itself” means **task queues + human/Cursor review**, not silent production edits. “Skills” means **versioned artifacts + executor**, distinct from conversational memory—see TARGET_ARCHITECTURE for policy table.

**Consequences:** Contributors read TARGET_ARCHITECTURE for **intent**; AGENTS/PROJECT remain **how to run and change** what exists today. New bridge work should add ADRs and security review.

**Links:** [`docs/TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md)

---

## Template

Use when adding a decision:

```markdown
## YYYY-MM-DD — Short title — Accepted

**Context:** …

**Decision:** …

**Consequences:** …

**Links:** (optional PR, issue, doc)
```

---

## 2026-04-02 — OpenClaw as optional execution layer — Accepted

**Context:** Virgil can own goal state, memory, and proactive logic while **multi-channel execution** (messengers, shell, files) stays in a dedicated agent stack such as OpenClaw on the LAN.

**Decision:**

- Virgil **delegates** concrete execution via a thin bridge (`lib/integrations/openclaw-client.ts`, `PendingIntent` queue, `delegateTask` tool) rather than reimplementing OpenClaw’s skill ecosystem in this repo.
- The bridge is **optional**: unset `OPENCLAW_URL` / `OPENCLAW_HTTP_URL` → tools are not registered; chat and memory behave as before.
- **Suggest-only** posture for risky actions: `requiresConfirmation` gates outbound/destructive intents until owner approval (UI or `approveOpenClawIntent`).

**Consequences:** Operators configure HTTP paths to match their OpenClaw gateway. Event-bus processors can call `dispatchVirgilEventToOpenClaw` when pivot Phase 3 streams exist.

**Links:** [docs/openclaw-bridge.md](openclaw-bridge.md)

---

## 2026-04-02 — Proactive pivot: semantic recall strategy (FTS, Mem0, pgvector) — Accepted

**Context:** An external “proactive agent pivot” proposes pgvector + local embeddings as **primary** recall. The repo already has the **2026-01-15** decision in this file — Postgres FTS for memory recall (“do not add a vector database casually”) — and optional **Mem0** semantic search with FTS fallback in application code.

**Decision:**

- **Until pivot Phase 1 is implemented:** The **primary on-Postgres** recall path remains **FTS** as in the 2026-01-15 ADR. **Mem0** remains the optional **hosted semantic** layer when `MEM0_API_KEY` is configured; behavior stays as shipped.
- **Program direction (hybrid):** When pivot Phase 1 is undertaken, prefer **pgvector inside the same Postgres** (e.g. Neon) plus **Ollama embeddings**, with **FTS retained as fallback** and for merge/dedup—**not** a separate managed vector database. Making vector search **rank before** FTS for recall requires a **follow-up ADR** at merge time (explicitly refining “primary” vs “fallback” ordering and migration).
- **Rejected for now:** Mem0-only as the sole semantic path for local-first posture (local Ollama users would not gain on-box semantic recall); pgvector-only without FTS fallback (regresses resilience).

**Consequences:** Pivot work documents this stack in the epic ticket; v2 memory blueprint ticket ([T4](tickets/2026-04-01-v2-t4-memory-migration-blueprint.md)) must be updated if `memory_embeddings` or related tables ship.

**Links:** [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md)

---

## 2026-04-01 — v1 groundwork ticket program for v2 split — Accepted

**Context:** v2 (planned, hardware-dependent) assumes a Next.js UI plus a Python backend with explicit API, tool registry, night work, budgets, and traces. v1 remains the live system until migration; work should **produce migration artifacts** (docs, opt-in JSONL) without pretending v2 is in scope for implementation here.

**Decision:** Track **E10** and tickets **T1–T8** under [docs/tickets/2026-04-01-v2-groundwork-overview.md](tickets/2026-04-01-v2-groundwork-overview.md). Prefer documentation and **opt-in** logging (`V2_*` env flags) over behavior changes to default chat. Persona consolidation flows through `docs/VIRGIL_PERSONA.md` after the human completes the personality workbook.

**Consequences:** Agents pick tickets from the overview; new SSOT docs (`V2_API_CONTRACT.md`, etc.) appear as tickets complete. Gitignore covers `workspace/v2-eval/*.jsonl` interaction/trace/cost logs.

**Links:** [docs/V2_MIGRATION.md](V2_MIGRATION.md), [docs/V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)

---

## 2026-03-31 — Bespoke single-owner scope — fitness v1 — Accepted

**Context:** The assistant is intentionally **one owner’s** personal system, not a multi-tenant SaaS foundation. Fitness is the first domain to stress-test prioritization (recovery, training, mobility, nutrition). Financial safety requires **descriptive** status only—no banking API credentials or plaintext finance tokens in app scope.

**Decision:**

- **Audience:** Single user; commercial multi-tenant SaaS is **out of scope for this repository**—a future commercial product would be a **new codebase**, not an evolution path preserved here.
- **V1 domain:** Fitness-first feedback (variance vs goals, recovery tradeoffs, structural prehab vs reactive stretching) with room to add other personal domains later using the same weekly/blocker scaffold.
- **Feedback:** **Variance-based**—deltas between stated goals and logged adherence; avoid hollow praise. Voice: dry, earnest, systems-level, with **light wit** where it sharpens a point—never sycophantic or cruel.
- **Data:** No programmatic access to banking APIs; no storage of financial auth tokens. Descriptive lifestyle data and **aggregates** (e.g. retirement progress toward a stated target) may inform context. See [docs/OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md).

**Consequences:** Prompts and docs align to owner intent; [docs/PRUNING_CANDIDATES.md](PRUNING_CANDIDATES.md) lists optional removal of demo/business/multi-user paths when the owner confirms they are unused.

**Links:** [docs/OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md)

---

## 2026-03-29 — Self-hosted cron + LAN env SSOT — Accepted

**Context:** Phase Four ops needed Ubuntu-friendly alternatives to Vercel Cron and clearer `AUTH_URL` / `NEXT_PUBLIC_APP_URL` documentation for LAN and Docker.

**Decision:** Document `vercel.json` schedules and equivalent **`curl`** / **`systemd` timer** flows in [AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron); env summary table and deployment notes in [AGENTS.md — Deployment (production)](../AGENTS.md#deployment-production). Cross-link [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) for static IP and single-origin discipline.

**Consequences:** Operators off Vercel must configure host timers and `NEXT_PUBLIC_APP_URL` explicitly for night-review enqueue.

**Links:** P4 ticket [docs/tickets/2026-03-29-virg-p4-production-hardening.md](tickets/2026-03-29-virg-p4-production-hardening.md)

---

## 2026-03-29 — Night insights digest (grouped by run) — Accepted

**Context:** Flat list of night-review memories was hard to scan; users could not act on a whole run at once.

**Decision:** Add [`lib/night-review/digest-display.ts`](../lib/night-review/digest-display.ts) to group by `runId`, dedupe identical content, order by facet; `/night-insights` renders sections with facet badges and per-run **Accept all / Dismiss all** for pending items. Completion-phase rows are excluded from the actionable digest.

**Consequences:** Slightly more client bundle; behavior remains suggest-only for prompts (memory metadata only).

**Links:** E7 in [ENHANCEMENTS.md](ENHANCEMENTS.md)

---

## 2026-03-29 — Product opportunity tool errors — user-safe messages — Accepted

**Context:** GitHub REST failures included response bodies in thrown errors; the chat tool returned `e.message` to the model, risking noisy or sensitive fragments in the UI stream.

**Decision:** Add `sanitizeProductOpportunityToolError` in [`lib/github/product-opportunity-issue.ts`](../lib/github/product-opportunity-issue.ts) and use it in `submitProductOpportunity` catch paths. Document reasoning/no-tools gateway behavior and human-only synthesis workflow in [`docs/github-product-opportunity.md`](github-product-opportunity.md).

**Consequences:** Operators still use server logs for full GitHub diagnostics; users see short, status-class messages.

**Links:** E6 in [ENHANCEMENTS.md](ENHANCEMENTS.md)

---

## 2026-03-29 — Trim-context: per-message overhead + long user compression — Accepted

**Context:** Local chats use `trimMessagesForBudget` with a character-based token estimate. Raw content sums under-counted real chat formatting, and a single huge **user** opening turn could dominate the budget before the recent tail (previously only **assistant** long replies were capped in the middle of trimming).

**Decision:** Add a fixed **~3 token overhead per message** in internal `estimateMessages` totals. Replace assistant-only long-message compression with **role-agnostic** `compressLongMessage` above the same threshold so oversized user and assistant turns are capped before split/keep logic.

**Consequences:** Slightly more aggressive trimming when many small messages are present; long first-user rants no longer crowd out the latest turns as often. Gateway path unchanged (no trim in route).

**Links:** [lib/ai/trim-context.ts](../lib/ai/trim-context.ts), E3 in [ENHANCEMENTS.md](ENHANCEMENTS.md)

---

## 2026-03-29 — Local model class (3B vs 7B) for slim/compact prompts — Accepted

**Context:** Curated presets already used `full` / `slim` / `compact`, but 3B- and 7B-class local weights respond differently; one slim body copy left quality on the table for small models and was heavier than needed for instruction-following on larger locals.

**Decision:** Introduce `LocalModelClass` (`3b` | `7b`) on `ChatModel`, with `inferLocalModelClassFromOllamaTag(tag)` for synthetic fallbacks and discovered Ollama tags (`<=4B` → `3b`, else `7b`). `getResolvedLocalModelClass` feeds `buildSlim*` / `buildCompact*` in `lib/ai/slim-prompt.ts` for local Ollama only; gateway models unchanged.

**Consequences:** Adjusting roster entries can set `localModelClass` explicitly when tags are ambiguous; new slim copy must stay non-sycophantic per voice ADRs.

**Links:** [lib/ai/models.ts](../lib/ai/models.ts), [lib/ai/slim-prompt.ts](../lib/ai/slim-prompt.ts), E2 in [ENHANCEMENTS.md](ENHANCEMENTS.md)

---

## 2026-03-29 — Bundled Ollama in Docker Compose (Ubuntu-first) — Accepted

**Context:** LAN home-server users on Linux needed health-gated startup and a single stack without relying on `host.docker.internal` (Docker Desktop–centric). Cold-start latency should be reducible via optional warmup.

**Decision:** Default [`docker-compose.yml`](../docker-compose.yml) includes an **`ollama`** service with a volume and healthcheck; **`virgil-app`** (renamed from `app`) depends on **healthy** Postgres, Redis, and Ollama. Provide [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml) for host Ollama. Add [`lib/ai/warmup-ollama.ts`](../lib/ai/warmup-ollama.ts) + scripts for `POST /api/generate` with `keep_alive: -1`.

**Consequences:** Docker Desktop users who relied on host Ollama without overrides should use the host-Ollama compose file or adjust env; bundled Ollama publishes **11434** on the host for `pnpm ollama:smoke` / `pnpm warmup:ollama`.

**Links:** [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md), [AGENTS.md](../AGENTS.md#setup-checklist)

---

## 2026-03-29 — Project documentation SSOT — Accepted

**Context:** Agents and humans needed one entrypoint for intent, handoff, and decision traceability without duplicating setup/deploy prose across thin link hubs ([SETUP.md](../SETUP.md), [DEPLOY.md](../DEPLOY.md)) and [AGENTS.md](../AGENTS.md).

**Decision:** Add `docs/PROJECT.md` as the management entrypoint; keep ADRs in this file; AGENTS.md remains the coding SSOT with short Key Decisions linking here.

**Consequences:** Decisions may be duplicated briefly in AGENTS for skimming; authoritative narrative lives here.

---

## 2026-01-20 — Voice and slim prompts — Accepted

**Context:** Local models have tight context budgets; user trust depends on honest behavior.

**Decision:** Do not optimize for sycophancy. Optimize for clarity, usefulness, and respectful pushback. Every token in a slim prompt must earn its place.

**Consequences:** Prompt changes are reviewed for flattery and bloat; slim path stays minimal.

---

## 2026-01-15 — HTTP local auth cookies — Accepted

**Context:** Local dev and Docker often use plain HTTP; cookie security must match origin.

**Decision:** Use `shouldUseSecureAuthCookie()` (and related auth config) for production-shaped local runs so session cookies behave correctly on HTTP.

**Consequences:** LAN and localhost auth documented in [AGENTS.md](../AGENTS.md#setup-checklist); changes to auth must preserve this behavior.

---

## 2026-01-15 — Optional night review job — Accepted

**Context:** Background synthesis of user activity should not block chat latency or run by default.

**Decision:** Night review is **optional**, off unless enabled, with env, routes, and eligibility documented in [workspace/night/README.md](../workspace/night/README.md). Outputs are suggest-only (e.g. Memory rows), not auto-writes to core prompts.

**Consequences:** Operators use cron/QStash per docs; personal users can be eligible without business profile per product rules.

---

## 2026-01-15 — Docker as first-class local stack — Accepted

**Context:** Developers need a repeatable full stack without manual Postgres/Redis install.

**Decision:** Treat `docker compose up --build` as a first-class path alongside `pnpm dev`; document Ollama on host (`host.docker.internal`) and packaging launchers.

**Consequences:** Compose and `.env.docker` stay maintained; see [packaging/README.md](../packaging/README.md).

---

## 2026-01-15 — QStash for reminder scheduling — Accepted

**Context:** Deferred work (reminders) needs a reliable scheduler without blocking the request path.

**Decision:** Keep Upstash QStash as the mechanism for delayed reminder delivery to the app’s API.

**Consequences:** QStash env and quota assumptions documented in [AGENTS.md](../AGENTS.md#deployment-production); local-only dev may omit or mock.

---

## 2026-01-15 — Postgres FTS for memory recall — Accepted

**Context:** Need search over user memories without new infrastructure cost at current scale.

**Decision:** Use Postgres full-text search for memory recall; do **not** add a vector database casually.

**Consequences:** `searchMemories` and related queries stay SQL/FTS-based; revisiting requires a new ADR.

---

## 2026-01-15 — Local models default; gateway optional — Accepted

**Context:** Product goal is usefulness on small local models; hosted APIs are optional power tools.

**Decision:** Default chat and UX paths assume Ollama (or compatible local) models; AI Gateway models are optional and must not become the default assumption in prompts or cost.

**Consequences:** Model roster and capabilities favor local; gateway changes are tested for not regressing local path.

---

## 2026-01-15 — Personal assistant first; business mode optional — Superseded (2026-04-01)

**Context:** Virgil serves individuals first; front-desk features were a subset of users.

**Decision (historical):** Personal assistant mode was default; business/front-desk required a business profile.

**Superseded by:** Removal of business/front-desk tables, tools, and UI. The product is personal-assistant-only.

---

## 2026-04-01 — Personal assistant only; optional gateway multi-agent (AutoGen-style) — Accepted

**Context:** Microsoft AutoGen is Python-first; Virgil is TypeScript/Next.js.

**Decision:** Drop business/front-desk product surface. Add optional **planner + executor** orchestration on the **gateway** chat path using Vercel AI SDK `generateText` + `streamText`, gated by `VIRGIL_MULTI_AGENT_ENABLED`. This is **pattern parity** with AutoGen-style roles, not a dependency on `microsoft/autogen`.

**Consequences:** Extra latency/cost when enabled; local Ollama path unchanged (no planner, no tools on `streamText`).
