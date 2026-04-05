# Target architecture — Virgil “brain” + external agent executor

This document **scopes owner intent** for where the product is headed. It does **not** mean every piece below is implemented; the **shipped** stack remains the Next.js app described in [PROJECT.md](PROJECT.md) and [AGENTS.md](../AGENTS.md). Use this file so Cursor sessions and future contributors align with **hardware**, **runtime split**, and **safety gates** before code exists.

---

## 1. Hardware profile (primary home server)

- **Target machine:** Apple **Mac mini** (or equivalent always-on Mac) used as the **primary** host for this project.
- **Memory:** **48 GB unified memory** (Apple Silicon uses unified memory, not discrete “VRAM” like many GPUs). This budget supports **larger local models**, **Ollama**, and **sidecar services** (Postgres/Redis via Docker, optional Python agent) on one box without laptop thermal limits.
- **Operational goal:** The Mini is the **default** place to run **Ollama** (`OLLAMA_BASE_URL` pointing at it for LAN clients or localhost), long-running stacks, and—when built—the **executor** process below.

---

## Device surfaces (planned)

Smart home and mobile devices are **contact surfaces**—places the owner meets Virgil—not only endpoints to control. Group them by **role** so v2 can specify auth, latency, refresh cadence, and phase per channel.

| Role | Definition | Examples | Direction |
|------|------------|----------|-----------|
| **Compute node** | Runs inference or services. Not user-facing. | Mac mini (Ollama, services), Pocket Lab (heavy inference), Vercel (hosted app) | N/A |
| **Output surface** | Displays or speaks Virgil-generated content. User glances or listens; no input beyond dismiss. | Google Nest Hub (dashboard), smart speaker (TTS briefing), wall tablet (goal/calendar display), phone (ntfy push) | Virgil → device |
| **Input source** | Sends context or commands to Virgil. | Phone (chat UI, share target, ingest API), voice via STT (future), Home Assistant automations triggering `/api/ingest`, Apple Watch (health ingest) | Device → Virgil |
| **Bidirectional** | Both input and output. | Phone (chat + ntfy), Nest Hub with voice (display + STT, future), Home Assistant (sensors in, device control out) | Both |

> The v1 codebase supports input sources (chat, `/api/ingest`, `/api/health/ingest`, share target) and one output channel (Resend email via digest/reminders/night review). v2 adds ntfy as a second output channel and Home Assistant as a bidirectional surface. Voice (STT → Virgil → TTS) is a future layer that promotes speakers and hubs from output-only to bidirectional. Each surface should be specced with: auth model, latency tolerance, update frequency, and which v2 phase it ships in.

---

## 2. Two-layer model: Virgil vs Agent Zero

| Layer | Role | Technology (target) |
|-------|------|----------------------|
| **Brain / product** | Chat UI, auth, sessions, Postgres memory, reminders (QStash), gateway/Ollama routing, tools implemented in-repo, night review, agent-task queue to humans/Cursor | **Virgil** — this repository (Next.js, TypeScript) |
| **Hands / computer agent** | Rich **skills**, shell/filesystem, plugins, multi-step local automation **outside** the Next.js sandbox | **[Agent Zero](https://github.com/agent0ai/agent-zero)** (Python), run **headless** on the Mini |

**Rationale:** Virgil stays **maintainable, reviewable, and local-first**. Heavy or open-ended **computer use** belongs in a **dedicated agent runtime** (Agent Zero) rather than reimplementing the entire ecosystem inside `lib/ai/tools/`.

**Not in scope as the default executor:** Bundling **OpenClaw** as the runtime. OpenClaw may still **inspire** patterns (e.g. workspace files under [`workspace/night/`](../workspace/night/README.md)); that is **documentation parity**, not “Virgil ships OpenClaw.”

---

## 3. Bridge (planned, not yet first-class)

To connect the layers safely:

- **Direction:** Virgil → **authenticated** HTTP (or queue) → Agent Zero (or compatible) with **timeouts**, **payload limits**, and **no silent secrets** to the model.
- **Default posture:** **Read-only / advisory** execution unless an explicit policy allows writes (e.g. dedicated git worktree, allowlisted paths).
- **Naming:** A future tool might be described as “delegate to local executor” in code; exact API TBD in implementation ADRs.

Until the bridge exists, **all** tool behavior remains **in-process** in this repo (see [security/tool-inventory.md](security/tool-inventory.md)).

---

## 4. “Fix itself” and “learn new skills” (policy)

These phrases are **product goals**, not permission for unchecked autonomy.

| Concept | Intended meaning | Guardrails |
|---------|------------------|------------|
| **Fix itself (the product)** | Queue improvements, bugs, refactors via **`submitAgentTask`**, GitHub issues, Cursor/human pickup | **Manual approval** before build; no auto-merge to production without review ([AGENTS.md § Agent Task Pickup Convention](../AGENTS.md#agent-task-pickup-convention)) |
| **Learn (memory)** | Preferences and facts in **Memory** / optional **Mem0**; night-review suggestions | **Suggest-only** or user-accepted writes; no silent prompt rewrites |
| **Learn (skills)** | **Versioned** skill artifacts (e.g. markdown/plugin layout compatible with Agent Zero’s skills model), reviewed like code | Lives primarily on the **executor** side or in-repo docs; not “the model free-texts a new tool into prod” |

---

## 5. Relationship to current code

- **Implemented today:** Next.js chat, Ollama + gateway models, companion tools in `lib/ai/tools/`, optional gateway planner ([`lib/ai/orchestration/`](../lib/ai/orchestration/)), Mem0, reminders, night review, agent tasks.
- **Not implemented yet:** Agent Zero process, bridge routes, or Mac-specific install scripts **in this repo**. Those are **follow-on** work tracked via [ENHANCEMENTS.md](ENHANCEMENTS.md) once broken into tickets.

---

## 6. When to update this doc

Update **`docs/TARGET_ARCHITECTURE.md`** when:

- The preferred executor changes (e.g. fork or alternative to Agent Zero).
- Bridge contract is chosen (auth scheme, URL shape).
- Hardware assumptions change (e.g. Linux server instead of Mini).

Pair substantive changes with a dated entry in [DECISIONS.md](DECISIONS.md).
