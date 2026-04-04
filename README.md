# Virgil

Virgil is a local-first personal AI assistant built to get the most useful behavior possible out of lightweight models.

The project is optimized for:

- low recurring cost
- strong local-model performance on 3B/7B-class models
- honest, proactive assistance instead of bloated prompts or hosted-model dependence
- optional gateway-only multi-agent planning (`VIRGIL_MULTI_AGENT_ENABLED`) when you want an extra orchestration pass

## What Virgil does

- Runs locally with Ollama by default
- Supports hosted models through AI Gateway when you want them
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

Hosted models remain available, but the default direction of the project is local-first.

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
- Optional **phase-1 onboarding** (timeline and quick start, cross-linked with each other): [QUICK_START.txt](QUICK_START.txt), [VIRGIL_PHASE1_SETUP.md](VIRGIL_PHASE1_SETUP.md), [VIRGIL_READY_TO_BUILD.md](VIRGIL_READY_TO_BUILD.md)

## Project management and agents

For **product intent** (lightweight companion, cost, iterability), **where documentation lives**, and **handoff steps** for an agent in a fresh chat, read [docs/PROJECT.md](docs/PROJECT.md) first, then [AGENTS.md](AGENTS.md) for implementation rules.

## Core principle

Virgil should be as helpful as possible on small local models without becoming flattering, bloated, or expensive.
