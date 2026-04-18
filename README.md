# Virgil

**Product version: Virgil 1.1** — bridge release ([docs/DECISIONS.md](docs/DECISIONS.md), 2026-04-16): optional **Hermes** HTTP delegation (`HERMES_*`), **OpenClaw** compatibility, and gated **LLM Wiki** ops (`VIRGIL_WIKI_*`). A **declared stable v1.0** (deploy and verification bar: [docs/STABILITY_TRACK.md](docs/STABILITY_TRACK.md)) remains the goal before June 2026; the **v2** Python-backend architecture is still planned ([docs/V2_ARCHITECTURE.md](docs/V2_ARCHITECTURE.md)). The repo `package.json` **version** tracks this label.

Virgil is a personal AI assistant with a **hosted-primary** default (AI Gateway tool-capable models) and **local Ollama** as a strong option for privacy, cost, or resilience.

The project is optimized for:

- capable **default** chat (full tools on gateway / non-Ollama path)
- **free/hobby-tier** infra when deployed (see [docs/free-tier-feature-map.md](docs/free-tier-feature-map.md))
- honest, proactive assistance without sycophancy
- **local Ollama** with slim prompts when you pick it or when gateway fallback is enabled
- optional gateway-only multi-agent planning (`VIRGIL_MULTI_AGENT_ENABLED`) when you want an extra orchestration pass

## What Virgil does

- Defaults to **hosted models** via AI Gateway (see `DEFAULT_CHAT_MODEL` in `lib/ai/models.ts`)
- Runs **local Ollama** when you select it in the model picker (slimmer tools on that path by design)
- Stores chat history, memories, and reminders in Postgres
- Uses Redis for rate limits and stream support
- Can run as a normal local dev app or as a one-command Docker stack

## Recommended path

The repository is conventionally cloned as **`virgil`** (folder name). Paths in [AGENTS.md](AGENTS.md) and [packaging/README.md](packaging/README.md) use **placeholders** like `~/Documents/virgil` or “your clone path”—use the real directory on your machine (the one that contains `package.json`).

### Local dev

```bash
cd ~/Documents/virgil   # example only — use your actual clone path
pnpm install
pnpm db:migrate
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Docker Compose

Virgil can run as one stack with **Postgres, Redis, Ollama, and the `virgil-app` container**:

```bash
cp .env.docker.example .env.docker
# edit .env.docker — set AUTH_SECRET, etc.
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The app uses the bundled **`ollama`** service at `http://ollama:11434` by default; **pull models** first, e.g. `docker compose exec ollama ollama pull qwen2.5:3b`.

**Docker Desktop** users who prefer **Ollama on the host** (e.g. GPU): use [`docker-compose.host-ollama.yml`](docker-compose.host-ollama.yml) and set `OLLAMA_BASE_URL` — see [AGENTS.md](AGENTS.md#docker-compose-postgres--redis--ollama--app-in-one-command) and [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md).

## Models

Virgil currently ships with curated local presets for:

- `ollama/qwen2.5:3b`
- `ollama/qwen2.5:3b-turbo`
- `ollama/qwen2.5:7b-instruct`
- `ollama/qwen2.5:7b-lean`

Pull the base runtime tags before chat:

```bash
ollama pull qwen2.5:3b
ollama pull qwen2.5:7b-instruct
```

Hosted models are the **default** in code and UI; use **LAN Ollama** (for example on an always-on home PC) via `OLLAMA_BASE_URL` when you want to **cut AI Gateway token use** while keeping the same app. Optional **OpenClaw** on the LAN handles delegation and skills—not the main chat LLM; see [docs/openclaw-bridge.md](docs/openclaw-bridge.md).

### Troubleshooting local models

Local inference uses **Ollama**, but the **Next.js server** opens that HTTP connection (`OLLAMA_BASE_URL`), not your browser or phone. The browser only picks a model id; it never talks to Ollama directly.

#### Where the app runs vs where Ollama runs

| App host | Ollama on same machine / Docker network | Ollama on LAN only (e.g. `192.168.x.x`) | Works? |
| -------- | --------------------------------------- | ---------------------------------------- | ------ |
| `pnpm dev` / Docker Compose on your PC | Set `OLLAMA_BASE_URL` to that Ollama | Point `OLLAMA_BASE_URL` at LAN IP; firewall allows **11434** | Yes, if the **Next.js process** can open TCP to that URL |
| **Vercel** (serverless) | Not applicable | LAN IPs are **not** reachable from Vercel | **No**, unless Ollama is exposed via an **authenticated** HTTPS reverse proxy or you **self-host** the app on the LAN |
| Self-hosted Next on LAN (same subnet as Ollama) | — | `OLLAMA_BASE_URL=http://<lan-host>:11434` | Yes |

**Android / mobile:** Using Virgil in Chrome on a phone does not change the rule—the **deployment** that serves `/api/chat` must reach Ollama when you use local models **there**. The **phone itself** does not need on-device or LAN-direct Ollama; that is an explicit **non-goal** so you do not over-engineer tunnels or split stacks for mobile—see [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md) (mobile browser) and [docs/DECISIONS.md](docs/DECISIONS.md) (2026-04-06 ADR). For a home-server layout and Vercel/HTTPS notes, see [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md) and [docs/vercel-env-setup.md](docs/vercel-env-setup.md).

- **Docker:** Default Compose uses the bundled `ollama` service. If Ollama runs on the host instead (e.g. GPU), use [`docker-compose.host-ollama.yml`](docker-compose.host-ollama.yml) and set `OLLAMA_BASE_URL` (often `http://host.docker.internal:11434` on Docker Desktop).
- **Quick probe** (from the same machine or container as the app): `curl -sS "${OLLAMA_BASE_URL:-http://127.0.0.1:11434}/api/tags"` should return JSON listing models.
- **Smoke test:** `pnpm ollama:smoke` (optionally with a preset id) exercises the same path as chat.
- **Preflight:** `pnpm dev:check` reminds you that `OLLAMA_BASE_URL` must be reachable from the server process, not only from the browser.

## V2 Python backend (planned)

A v2 architecture targeting June 2026 replaces the Node.js backend with a headless Python service on a **Mac Mini M4 Pro** (48GB unified memory, 2TB SSD). The Next.js frontend stays on Vercel.

Inference is local-first: Ollama on the Mac Mini handles 80-90% of calls at $0 cost, with Gemini API as a paid escalation path for complex reasoning.

Setup for v2 development (when the time comes):

```bash
brew install python@3.11 ollama
ollama pull qwen2.5:14b
ollama pull qwen2.5:32b
```

Postgres and Redis via Docker (OrbStack or Docker Desktop) if v2 needs them. Full architecture: [docs/V2_ARCHITECTURE.md](docs/V2_ARCHITECTURE.md). Hardware decisions: [docs/HARDWARE.md](docs/HARDWARE.md). Migration and v1→v2 risks: [docs/V2_MIGRATION.md](docs/V2_MIGRATION.md), [docs/V1_V2_RISK_AUDIT.md](docs/V1_V2_RISK_AUDIT.md).

## Docs

**SSOT map:** [docs/PROJECT.md](docs/PROJECT.md) lists where each topic lives (same structure as this section—read PROJECT first for intent and links).

- [docs/PROJECT.md](docs/PROJECT.md): **start here** — intent, documentation map, architecture overview, agent handoff (new Cursor chat); **v1 vs v2 deployment tracks** (hosted vs Mac mini)
- [docs/V1_V2_RISK_AUDIT.md](docs/V1_V2_RISK_AUDIT.md): v1 patterns that complicate v2 (and E10 mitigations)
- [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md): **target stack** — Virgil vs Agent Zero, Mac mini hardware profile, bridge (planned), self-improvement gates
- [AGENTS.md](AGENTS.md): **setup and deployment detail** (env, Docker, LAN, cron, Vercel, env var table) plus coding rules and checklists
- [SETUP.md](SETUP.md), [DEPLOY.md](DEPLOY.md): thin link hubs → AGENTS.md (no duplicate tables)
- [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md): LAN / Ubuntu home server — bundled Ollama in Compose, systemd, warmup, local vs remote access
- [docs/HARDWARE.md](docs/HARDWARE.md): hardware decisions (v2 host, inference tiers, retired gear)
- [docs/DECISIONS.md](docs/DECISIONS.md): architecture decision records
- [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md): enhancement backlog and review process
- [docs/github-product-opportunity.md](docs/github-product-opportunity.md): optional GitHub Issues inbox for product feedback (gateway models)
- [docs/digital-self-bridge.md](docs/digital-self-bridge.md): optional **Digital Self** orchestrator (`digital-self/` — Slack/WhatsApp/SMS policy, approvals); `pnpm digital-self:dev` from repo root
- Optional **phase-1 onboarding** (timeline and quick start, cross-linked with each other): [QUICK_START.txt](QUICK_START.txt), [VIRGIL_PHASE1_SETUP.md](VIRGIL_PHASE1_SETUP.md), [VIRGIL_READY_TO_BUILD.md](VIRGIL_READY_TO_BUILD.md)

## Project management and agents

For **product intent** (lightweight companion, cost, iterability), **where documentation lives**, and **handoff steps** for an agent in a fresh chat, read [docs/PROJECT.md](docs/PROJECT.md) first, then [AGENTS.md](AGENTS.md) for implementation rules.

## Core principle

Virgil should be as **capable as possible on the default hosted path** and **honest** on small local models—without becoming flattering, bloated, or expensive. **Stabilization focus:** verification gates (`pnpm stable:check`), persona consistency ([docs/VIRGIL_PERSONA.md](docs/VIRGIL_PERSONA.md)), and chat UI polish.
