# Virgil roadmap: Linux 24/7 operations

This document ties together **project intent**, **completed milestones**, and **phased work** toward a reliable, local-first assistant on a **native Ubuntu** home server. Authoritative backlog rows remain in [ENHANCEMENTS.md](ENHANCEMENTS.md); architecture SSOT is [PROJECT.md](PROJECT.md). **Itemized future work** lives in [docs/tickets/](tickets/README.md).

---

## Project intent and current iteration status

**Intent:** Local-first execution of **3B/7B-class** models via **Ollama**, with **tiered prompts** (`full` / `slim` / `compact`) to respect tight context budgets. Personality: **proactive but honest**—clarity over flattery ([AGENTS.md](../AGENTS.md)).

**Architecture (summary):** Chat flows through [`app/(chat)/api/chat/route.ts`](../app/(chat)/api/chat/route.ts); prompts under `lib/ai/*-prompt.ts`; **Postgres FTS** for memory recall (`lib/db/`); **Redis** for rate limits and streams; **Docker Compose** for the local stack ([`docker-compose.yml`](../docker-compose.yml)).

**Milestones already reflected in the codebase / docs**

| Ticket | Enhancement | Status |
|--------|-------------|--------|
| E1 | Dynamic Ollama discovery (`/api/tags`, `lib/ai/ollama-discovery.ts`) | Shipped |
| E4 | Local-model error surfacing (banner, `lib/chat-error-display.ts`) | Shipped |
| E5 | Explicit business mode toggle ([`/preferences`](../app/(chat)/preferences/page.tsx)) | Shipped |
| E8 | Linux-oriented cold-start: health-gated Compose, bundled Ollama, warmup, systemd sample ([beta-lan-gaming-pc.md](beta-lan-gaming-pc.md)) | Shipped |

**Transition driver:** Moving from **Windows / WSL2** recovery patterns to **native Ubuntu** (**systemd**, optional **NVIDIA Container Toolkit**, sleep vs full shutdown tradeoffs) removes virtualization overhead and reduces unnecessary cold-start latency for a 24/7 box.

---

## Phase One: Linux-native transition and cold-start optimization (VIRG-E8 / E8)

**Goal:** Native Ubuntu as the primary operations story; deterministic startup; optional GPU passthrough; docs that favor **suspend (S3-class sleep)** over full shutdown when idle.

| Sub-task | Description | Status |
|----------|-------------|--------|
| **1.1** | Refactor **`docker-compose.yml`**: `service_healthy` dependencies so **`virgil-app`** waits for **Postgres**, **Redis**, and **Ollama** | Shipped |
| **1.2** | **`lib/ai/warmup-ollama.ts`**: dummy inference via `POST /api/generate` with **`keep_alive: -1`**; shell + `pnpm warmup:ollama` | Shipped |
| **1.3** | **systemd** unit example for Compose lifecycle | Documented in [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) |
| **1.4** | **NVIDIA Container Toolkit** for GPU passthrough to the **Ollama** container | Document / commented YAML (host-specific); verify on target hardware |
| **1.5** | **docs/beta-lan-gaming-pc.md**: prioritize **Linux-native sleep (S3-class suspend)** vs full shutdown to preserve faster return-to-service | See [Sleep vs shutdown](beta-lan-gaming-pc.md#sleep-vs-shutdown-linux) |

**Escape hatch:** Host Ollama instead of bundled service — [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml).

---

## Phase Two: Intelligence refinement and context discipline (E2, E3)

**Goal:** Better quality on constrained hardware without sycophantic prompts.

| Ticket | Sub-task | Notes |
|--------|----------|--------|
| **E2** | Per-model prompt variants beyond **full / slim / compact** | Extend [`lib/ai/models.ts`](../lib/ai/models.ts) and chat route prompt selection for **3B vs 7B** behaviors; keep instructions **clear and non-ingratiating** |
| **E3** | **Smarter context compression** | Evolve [`lib/ai/trim-context.ts`](../lib/ai/trim-context.ts) for continuity within aggressive local token budgets |

**Constraints:** No increase in flattery; every token must earn its place ([DECISIONS.md](DECISIONS.md), voice ADRs).

---

## Phase Three: Memory synthesis and feedback integration (E6, E7)

**Goal:** Safer automation and honest synthesis.

| Ticket | Sub-task | Notes |
|--------|----------|--------|
| **E7** | Night-review **UI** (accept / reject) on **`/night-insights`** | Partially shipped; extend UX and **digest merge** for findings (**suggest-only**—no silent overwrite of core prompts) |
| **E6** | Product feedback path: **`submitProductOpportunity`** → GitHub; periodic **synthesis** of external agentic ideas (e.g. OpenClaw) into scope | Ongoing; [github-product-opportunity.md](github-product-opportunity.md) |

---

## Phase Four: 24/7 production hardening and LAN operations

**Goal:** “Always-on” reliability without Vercel-only assumptions.

| Sub-task | Description |
|----------|-------------|
| **4.1** | **Local cron / systemd timers** on Ubuntu to replace **Vercel Cron** for night-review enqueue, digest, etc. (`CRON_SECRET`-authenticated `curl`) — **documented:** [AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron), [AGENTS.md § self-hosted schedules](../AGENTS.md#self-hosted-schedules-no-vercel-cron) |
| **4.2** | **LAN origin hardening:** stable **`AUTH_URL`** / **`NEXT_PUBLIC_APP_URL`** (DHCP reservation, **netplan** static IP or equivalent) so cookies and redirects stay consistent — **documented** in [AGENTS.md](../AGENTS.md#deployment-production) + [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) |
| **4.3** | **Audit** [AGENTS.md Review Checklist](../AGENTS.md#review-checklist): no business-mode leakage into default personal path; new env vars in **AGENTS.md** (Setup + Deployment) — **done** (P4 ticket) |

---

## Related links

- [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) — Ubuntu-first LAN beta, systemd, warmup, time-to-ready  
- [ENHANCEMENTS.md](ENHANCEMENTS.md) — E1–E8 backlog  
- [PROJECT.md](PROJECT.md) — SSOT map and handoff  
- [superpowers/plans/2026-03-29-security-hardening-agents.md](superpowers/plans/2026-03-29-security-hardening-agents.md) — security follow-ups  
