# Architecture decisions (ADR-style)

Significant, stable choices for Virgil. New entries go at the **top** (reverse chronological). Summaries also appear in [AGENTS.md Key Decisions](../AGENTS.md#key-decisions); this file is the **traceable** record.

---

## 2026-04-06 — Mobile browser is not a local-LLM compute target (explicit non-goal) — Accepted

**Context:** Primary surfaces include a **phone** (e.g. Pixel in the browser) and a **laptop on the LAN** with home inference (Ollama on a Mac mini, optional OpenClaw). It is easy to revisit whether the **phone** must run **on-device** models or obtain a **direct** path to LAN Ollama so “everything is local,” which drives VPNs, tunnels, split stacks, and scope creep unrelated to the shipped architecture.

**Decision:**

1. For **product and network planning**, the **mobile browser** is an **interaction surface** only: chat inference runs on the **server** that implements `POST /api/chat` (hosted gateway, or self-hosted Next with `OLLAMA_BASE_URL`, etc.). The phone does **not** need to run a **local LLM** and does **not** need LAN reachability to Ollama **by itself**.
2. **Local Ollama** remains a **first-class** choice where the **Next.js process** can open `OLLAMA_BASE_URL` (dev laptop, Docker, LAN-hosted app)—not where only the phone’s browser could theoretically reach the LAN.
3. A **separate** exploratory note ([on-device Gemma / Android spike](tickets/2026-04-06-on-device-gemma-android-spike.md)) describes a **different** shape (client-side inference); it is **not** a commitment to ship that path or to require it for the owner’s phone experience.

**Consequences:** No obligation to design Pixel → home Ollama plumbing for “parity” with laptop local chat. Away-from-home phone use can stay **hosted-primary** without architectural conflict. Revisit only with an explicit ADR if native on-device inference becomes a goal.

**Links:** [docs/TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md) (mobile browser, local LLM), [README.md](../README.md) (Troubleshooting local models), [AGENTS.md](../AGENTS.md) (Ollama / Android note)

---

## 2026-04-06 — Complementarity: OpenClaw breadth, Virgil depth, Hermes-style + ACP as future — Accepted

**Context:** Older docs described OpenClaw as **inspiration only** for workspace/night patterns, while v1 already ships an **optional** HTTP bridge (`delegateTask`, `approveOpenClawIntent`, `PendingIntent` queue — [openclaw-bridge.md](openclaw-bridge.md)). That wording confused contributors. Separately, owner intent positions **multi-channel orchestration** (breadth), **persistent companion state** (Virgil), and a **learning specialist** (depth over time) as **complementary**—with **ACP** as a possible future wire—not as one replaceable product.

**Decision:**

1. **[`docs/PROJECT.md`](PROJECT.md)** and **[`docs/TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) §2, §2b, §3, §5** describe: optional OpenClaw = **integration** for gateway breadth (not bundled in default Compose); Virgil = **brain**; **Agent Zero** remains the documented **Python executor** target (bridge still planned); **Hermes-style** learning and **ACP** are **documented intent only**—no in-repo implementation until scoped.
2. **§3** explicitly distinguishes **in-process** companion tools from **optional OpenClaw** out-of-process delegation and from the **future Agent Zero** bridge.
3. **No Hermes integration, no ACP client, and no new env vars** ship from this ADR.

**Consequences:** Architecture docs align with shipped code; future orchestrator/specialist work is named without implying it exists in the repo.

**Links:** [docs/TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md) §2b, [docs/openclaw-bridge.md](openclaw-bridge.md), [docs/digital-self-bridge.md](digital-self-bridge.md)

---

## 2026-04-05 — Tri-layer product vocabulary (Interaction, Integration, Cognitive) — Accepted

**Context:** Owner framing describes moving from reactive chat toward proactive life management using three layers (interaction gateway, integration with data silos and executors, cognitive state and long-horizon reasoning).

**Decision:**

1. **[`docs/TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) §2a** is the SSOT mapping of that vocabulary to **Virgil (brain)**, **Agent Zero (hands)**, shipped surfaces, E11, and v2 specs.
2. **[`docs/tickets/2026-04-02-proactive-pivot-epic.md`](tickets/2026-04-02-proactive-pivot-epic.md)** lists **Phase 3** engineering touchpoints for the next E11 slice (`feat/pivot-events-nudges`).
3. **[`docs/tickets/2026-04-05-scheduling-symbolic-grounding-spike.md`](tickets/2026-04-05-scheduling-symbolic-grounding-spike.md)** scopes a **non-implementing** spike: bounded scheduling/optimization and symbolic grounding for a future v2 backend—**no v2 code in this repo** until the June 2026 track begins.

**Consequences:** Contributors can use one vocabulary across product essays and code reviews. Scheduling/solver work stays ticketed and out of default v1 scope unless explicitly picked up.

**Links:** [docs/PROJECT.md](PROJECT.md), [docs/PIVOT_EVENTS_AND_NUDGES.md](PIVOT_EVENTS_AND_NUDGES.md), [docs/V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md) (weekly schedule proposal)

---

## 2026-04-05 — Context ingress channels (ingest, share, journal file, inbound email) — Accepted

**Context:** Single-owner deployments need low-friction ways to add `Memory` rows and surface Apple Health batches in chat **without** bloating slim/compact local prompts.

**Decision:**

1. **`POST /api/ingest`** (Bearer `VIRGIL_INGEST_SECRET` → `VIRGIL_INGEST_USER_ID`) accepts a small Zod schema; `metadata` includes `source` and `ingestType`; embedding follows `saveMemoryRecord` (Ollama when configured).
2. **PWA share target** posts multipart to **`/api/ingest/share`** under the **session** user (not the bearer owner id).
3. **Journal file parse** (`VIRGIL_JOURNAL_FILE_PARSE`) reads `VIRGIL_JOURNAL_FILE_PATH` (default `workspace/journal/today.md`) or accepts **POST body** `content` for serverless; cron uses `GET /api/journal/parse` + `CRON_SECRET`; model selection matches **`NIGHT_REVIEW_MODEL`**.
4. **Inbound email** (`VIRGIL_EMAIL_INGEST_ENABLED`) verifies **Svix** (`RESEND_WEBHOOK_SECRET`), loads bodies via Resend **Receiving API**, allowlists `VIRGIL_EMAIL_INGEST_ALLOWED_FROM`, writes to **`VIRGIL_INGEST_USER_ID`**.
5. **Health snapshots** in the system prompt: up to **3** rows in the last **7** days, **hosted + fallback escalation only** (empty on local Ollama primary path).

**Consequences:** More `Memory` rows and occasional Gemini/Ollama calls for journal parse; operators must configure Resend **receiving** on a **verified domain** (sandbox senders are limited).

**Links:** [docs/security/tool-inventory.md](security/tool-inventory.md), [AGENTS.md](../AGENTS.md) env table

---

## 2026-04-05 — Device surfaces as contact channels (documentation, not implementation) — Accepted

**Context:** v2 specs mentioned Home Assistant and pychromecast in passing (one row each in V2_BEHAVIORAL_SPECS.md §5) but did not distinguish output surfaces, input sources, and bidirectional channels. The owner intends smart home devices (Nest Hub, speakers, wall tablets, HA automations) as primary contact surfaces — not just controlled endpoints. ntfy was the only interruptive push channel specced.

**Decision:**

1. **TARGET_ARCHITECTURE.md** now defines a device taxonomy: compute nodes, output surfaces, input sources, and bidirectional devices.
2. **V2_BEHAVIORAL_SPECS.md §5** now includes a "Contact surfaces" table with per-surface protocol, v2 phase, and auth model notes.
3. **V2_ARCHITECTURE.md** adds `home_assistant` to the tool inventory and scopes Phase 2–3 device tools.
4. **No code ships from this decision.** Implementation follows the phase mapping when v2 development begins (June 2026 target).

**Consequences:** v2 implementers have a clear surface inventory to build against. Phase 2 work (HA integration, dashboard route, TTS cast) can be scoped into tickets when the Python backend exists. Voice (Phase 3) is explicitly deferred past initial v2 launch.

**Links:** [docs/TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md), [docs/V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md), [docs/V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)

---

## 2026-04-05 — Ghost of Virgil: hosted-primary v1 posture, local resilience, lanes — Accepted

**Context:** v1 shipped with a **tool-capable default** in code (`DEFAULT_CHAT_MODEL` = gateway id in `lib/ai/models.ts`) while docs still described “local-first.” Local Ollama chat intentionally registers **few tools** (optional OpenClaw only) to protect small models. Operators want **maximum usefulness on free/hobby infra** with **local Ollama** as **resilience** (user choice, outage, policy), not as the primary tool surface.

**Decision:**

1. **Primary path:** Default chat uses **AI Gateway / hosted tool-capable models** for full companion tools (memory, goals, documents, calendar, etc.). **LLM spend** is explicit (Gateway credits, optional `GOOGLE_GENERATIVE_AI_API_KEY`); infra stays on documented free tiers where possible — see [free-tier-feature-map.md](free-tier-feature-map.md).
2. **Local Ollama:** **Fallback and choice** — slim prompts; **thin tool surface** unless a future env-gated experiment expands it. **`VIRGIL_CHAT_FALLBACK=1`** keeps **Ollama failure → Gemini → Gateway** (see separate ADR). Optional **`VIRGIL_GATEWAY_FALLBACK_OLLAMA=1`** adds **gateway failure → Ollama** when the user has a configured `DEFAULT_GATEWAY_FALLBACK_OLLAMA_MODEL` (see [AGENTS.md](../AGENTS.md) env table).
3. **Delegation lanes:** Work is routed into **lanes** (`chat`, `home`, `code`, `research`) so the main model **delegates** to OpenClaw (`delegateTask`), repo agents (`submitAgentTask`), or stays inline — metadata on delegations and prompt guidance in `lib/ai/companion-prompt.ts` / `lib/ai/lanes.ts`. Optional **`VIRGIL_LANE_ROUTER=1`** may add a classifier pass later; off by default.

**Consequences:** Agents optimize for **hosted-primary quality and safety** without blocking **offline/local** use. Review checklists weight **resilience and single-owner safety** over “never touch the local path.”

**Links:** [docs/PROJECT.md](PROJECT.md), [docs/V2_TOOL_MAP.md](V2_TOOL_MAP.md) §1, [lib/ai/chat-fallback.ts](../lib/ai/chat-fallback.ts)

---

## 2026-04-05 — v1 persona SSOT (`docs/VIRGIL_PERSONA.md`) + code sync policy — Accepted

**Context:** Voice rules lived only in TypeScript (`companion-prompt.ts`, `slim-prompt.ts`, `goal-guidance-prompt.ts`). v2 groundwork ticket **T8** required a human-readable contract and reduced drift for migration.

**Decision:**

1. **[`docs/VIRGIL_PERSONA.md`](VIRGIL_PERSONA.md)** is the authoritative v1 persona spec (identity, always/never, local vs hosted, fitness/goals summary, tool behavior, sync policy).
2. Prompt builders **implement** that spec; intentional voice changes start in `VIRGIL_PERSONA.md`, then TypeScript, then `pnpm stable:check` / [`tests/unit/local-context.test.ts`](../tests/unit/local-context.test.ts) as needed.
3. The personality worksheet [`docs/personality/Virgil_personality_synthesis.md`](personality/Virgil_personality_synthesis.md) Part I is filled and cross-links the SSOT; historical excerpts in Parts B–D are illustrative.

**Consequences:** v2 can port `persona.md` from a single Markdown file; contributors have one place to read before editing prompts.

**Links:** [docs/tickets/2026-04-01-v2-t8-persona-ssot-apply-workbook.md](tickets/2026-04-01-v2-t8-persona-ssot-apply-workbook.md), [docs/V2_MIGRATION.md](V2_MIGRATION.md)

---

## 2026-04-04 — v2 behavioral specs SSOT; v1 pivot goals remain separate — Accepted

**Context:** v1 proactive pivot may introduce `Goal` / check-ins alongside `GoalWeeklySnapshot` ([docs/tickets/2026-04-02-pivot-goals-layer-design.md](tickets/2026-04-02-pivot-goals-layer-design.md)). v2 planning added a richer behavioral domain (habits, projects, schedule) for the Python backend.

**Decision:**

1. **SSOT for v2 behavioral requirements:** [docs/V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md) and HTTP route sketches in [docs/V2_BEHAVIORAL_API.md](V2_BEHAVIORAL_API.md). Linked from [docs/PROJECT.md](PROJECT.md) and [docs/V2_ARCHITECTURE.md](V2_ARCHITECTURE.md).
2. **Do not merge** v1 pivot schema with v2 behavioral tables in documentation until an explicit bridge or migration ADR exists. Relationship narrative: [docs/V2_MIGRATION.md](V2_MIGRATION.md) § Behavioral and goal state.

**Consequences:** Implementers can add pivot goals in v1 without implying the v2 SQLite-first model is already in Neon; v2 Python work can proceed from the behavioral specs without conflicting the pivot ticket’s optional `Goal` table design.

---

## 2026-04-04 — Local trim-context: middle-phase drops + tool structural preservation — Accepted

**Context:** Under fixed `maxContextTokens`, long threads keep `first`, a greedy middle segment, and a recent tail. Middle reduction could drop user turns before plain assistant turns, or strip tool-call/tool-result structure when compressing messages.

**Decision:**

1. **`shrinkMiddleTrialToBudget`** removes **removable** assistant messages before **removable** user messages; messages with AI SDK **structural tool parts** (`role: tool`, or `tool-call` / `tool-result` / tool-approval parts in array content) are **not** removable until **last resort** (drop oldest in the trial slice).
2. **`compressLongMessage` / `truncateMessageToBudget`** skip rewriting content for structural tool messages so array parts are not flattened or truncated.

**Consequences:** Local Ollama chats retain tool continuity slightly better under pressure; extreme budgets may still drop structural messages from the oldest end of a middle trial.

**Links:** [lib/ai/trim-context.ts](../lib/ai/trim-context.ts), [docs/tickets/2026-03-29-virg-e3-smart-context-compression.md](tickets/2026-03-29-virg-e3-smart-context-compression.md)

---

## 2026-04-03 — v1 hosted stack vs v2 home stack; v2 Postgres vs SQLite (documentation) — Accepted

**Context:** v1 production is commonly described as **Vercel + Neon + Upstash (Redis + QStash) + Resend + Vercel Blob** (managed free/hobby posture). v2 intent is **Mac mini + local Ollama + Python backend**, leveraging **hardware and open-source** inference. The migration doc historically emphasized **SQLite + Mem0** for greenfield v2, while **migrating from v1** may favor **Postgres on the home host** for schema parity.

**Decision:**

1. **Document** both deployment narratives in [docs/PROJECT.md](PROJECT.md) (“Deployment tracks”) without duplicating env tables (those stay in [AGENTS.md](../AGENTS.md)).
2. **Document** both v2 data tracks in [docs/V2_MIGRATION.md](V2_MIGRATION.md): **greenfield** SQLite/Mem0 vs **migration-first** local/LAN Postgres. This is **positioning and handoff clarity**, not a commitment to implement two production backends in parallel.
3. **Record** v1→v2 friction (contracts, monolithic chat route, auth, background jobs) in [docs/V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md) and link E10 tickets for mitigations.

**Consequences:** Contributors can quote a single place for “what v1 is in production” vs “what v2 aims for”; Python/backend work should still follow E10 **T1–T8** for concrete API and memory artifacts.

**Links:** [docs/PROJECT.md](PROJECT.md), [docs/V2_MIGRATION.md](V2_MIGRATION.md), [docs/V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md), [docs/tickets/2026-04-01-v2-groundwork-overview.md](tickets/2026-04-01-v2-groundwork-overview.md)

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
- **Program direction (hybrid):** When pivot Phase 1 is undertaken, prefer **pgvector inside the same Postgres** (e.g. Neon or Supabase) plus **Ollama embeddings**, with **FTS retained as fallback** and for merge/dedup—**not** a separate managed vector database. Making vector search **rank before** FTS for recall requires a **follow-up ADR** at merge time (explicitly refining “primary” vs “fallback” ordering and migration). Design sketch: [docs/tickets/2026-04-04-pgvector-memory-design.md](tickets/2026-04-04-pgvector-memory-design.md).
- **Rejected for now:** Mem0-only as the sole semantic path for local-first posture (local Ollama users would not gain on-box semantic recall); pgvector-only without FTS fallback (regresses resilience).

**Consequences:** Pivot work documents this stack in the epic ticket; v2 memory blueprint ticket ([T4](tickets/2026-04-01-v2-t4-memory-migration-blueprint.md)) must be updated if `memory_embeddings` or related tables ship.

**Links:** [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md)

---

## 2026-04-04 — E11 Phase 1: recallMemory ordering (pgvector, FTS, Mem0) — Accepted

**Context:** [docs/tickets/2026-04-04-pgvector-memory-design.md](tickets/2026-04-04-pgvector-memory-design.md) ships `Memory.embedding` with Ollama `/api/embeddings` and refines the 2026-04-02 hybrid recall ADR.

**Decision:** For the `recallMemory` tool, try results in this order: **(1)** pgvector similarity on rows with a stored embedding (same Postgres as FTS), **(2)** Postgres FTS on `Memory.tsv`, **(3)** Mem0 when `MEM0_API_KEY` is set. Writes embed via `saveMemoryRecord` (fire-and-forget). Chat route does not duplicate embedding for Mem0-style conversation sync; pgvector searches `Memory` rows only.

**Consequences:** Operators need Postgres with the `vector` extension (Neon, Supabase, local pgvector). `pnpm db:backfill-embeddings` fills null embeddings. Dimension defaults to **768** (`nomic-embed-text`); changing it requires a new migration.

**Links:** [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md)

---

## 2026-04-04 — E11 Phase 2: structured goals (`Goal` + `GoalCheckIn`, option A1) — Accepted

**Context:** [docs/tickets/2026-04-02-pivot-goals-layer-design.md](tickets/2026-04-02-pivot-goals-layer-design.md) compares extending `GoalWeeklySnapshot` vs new tables. Weekly rollup stays authoritative for week-keyed metrics.

**Decision:** Add **`Goal`** and **`GoalCheckIn`** tables (cadence goals, streaks, blockers) alongside existing **`GoalWeeklySnapshot`**. Gateway chat exposes `listGoals` and `checkInGoal` tools; active goals are summarized in the system prompt when present. `GoalWeeklySnapshot` remains the time-series SSOT for weekly metrics.

**Consequences:** Stale-goal polling for future nudges uses `Goal.lastTouchedAt` / check-ins per pivot design; Phase 3 events layer builds on this schema only after the agentic-scope ADR below.

**Links:** [docs/tickets/2026-04-02-pivot-goals-layer-design.md](tickets/2026-04-02-pivot-goals-layer-design.md)

---

## 2026-04-04 — Agentic scope gate (before pivot Phase 3 events/nudges) — Accepted

**Context:** “Agentic” can mean **suggest-only nudges** (aligned with Virgil’s honest, approval-oriented posture) or **autonomous side effects** (tools, writes, external calls without a human confirm step). Phase 3 in [docs/PIVOT_EVENTS_AND_NUDGES.md](PIVOT_EVENTS_AND_NUDGES.md) touches delivery topology and persisted notifications.

**Decision:** **Default v1 posture:** notifications and scheduled nudges are **suggest-only** — they surface in app/chat and may request confirmation before any mutating tool runs. **Autonomous execution** (running tools or external actions without explicit user approval in-product) requires a separate ADR, explicit idempotency/audit, and is **not** the default path implied by QStash nudges alone.

**Consequences:** Implement Phase 3 event/nudge **delivery and persistence** only after this gate; any auto-execute path is out of scope until specified.

**Links:** [docs/PIVOT_EVENTS_AND_NUDGES.md](PIVOT_EVENTS_AND_NUDGES.md), [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md)

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

**Update (E2 follow-up):** When local Ollama uses the **full** companion prompt (`promptVariant: full`, or any path that is not slim/compact), `app/(chat)/api/chat/route.ts` passes `localModelClass` into `buildCompanionSystemPrompt` so 3B- vs 7B-class length guidance matches the slim buckets. Hosted/gateway calls omit `localModelClass`.

**Consequences:** Adjusting roster entries can set `localModelClass` explicitly when tags are ambiguous; new slim copy must stay non-sycophantic per voice ADRs.

**Links:** [lib/ai/models.ts](../lib/ai/models.ts), [lib/ai/slim-prompt.ts](../lib/ai/slim-prompt.ts), [lib/ai/companion-prompt.ts](../lib/ai/companion-prompt.ts), [app/(chat)/api/chat/route.ts](../app/(chat)/api/chat/route.ts), E2 in [ENHANCEMENTS.md](ENHANCEMENTS.md)

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

---

## 2026-04-04 — Chat fallback cascade: Ollama → Gemini → Gateway — Accepted

**Context:** Local Ollama inference is the default, but the server may be asleep, misconfigured, or missing a model. When that happens the user sees an error with no recovery. The owner has a personal Google Generative AI (Gemini) API key and wants to reduce Vercel AI Gateway token costs while keeping a safety net.

**Decision:** Add an opt-in fallback cascade (`VIRGIL_CHAT_FALLBACK=1`) that escalates local Ollama failures through direct Gemini (personal API key via `@ai-sdk/google`), then Vercel AI Gateway as last resort. Constraints:

- **No mid-stream fallback.** Escalation applies only to pre-stream failures (connection refused, missing model, timeout) detected before tokens flow to the client.
- **Escalation tiers use gateway-class prompt and full tool set** (same `buildCompanionSystemPrompt` + all tools the gateway branch uses), so behavior matches hosted-model capabilities.
- **Gemini requires `GOOGLE_GENERATIVE_AI_API_KEY`**; if absent, that tier is skipped and gateway is the only fallback.
- **Fallback model ids are env-configurable** (`VIRGIL_FALLBACK_GEMINI_MODEL`, `VIRGIL_FALLBACK_GATEWAY_MODEL`) with sensible defaults (`gemini-2.5-flash`, `deepseek/deepseek-v3.2`).

**Consequences:** When Ollama is down and fallback is enabled, chat stays available at the cost of one Gemini or gateway inference call. Billing for Gemini is on the owner's personal key. Title generation and night review are out of scope (they use their own model paths). `isFallbackEligibleError` is unit-tested to prevent accidental over-matching.
