# Virgil

Virgil is a local-first personal AI assistant built to get the most useful behavior possible out of lightweight models.

The project is optimized for:

- low recurring cost
- strong local-model performance on 3B/7B-class models
- honest, proactive assistance instead of bloated prompts or hosted-model dependence
- an optional business/front-desk mode when you explicitly configure it

## What Virgil does

- Runs locally with Ollama by default
- Supports hosted models through AI Gateway when you want them
- Stores chat history, memories, reminders, and optional business data in Postgres
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

## Optional business mode

Virgil is a personal assistant by default.

If you complete onboarding, it can also act as a business front desk with intake, escalation, and opportunity capture. Those business-specific tools stay out of the default personal path unless you opt in.

## Docs

**SSOT map:** [docs/PROJECT.md](docs/PROJECT.md) lists where each topic lives (same structure as this section—read PROJECT first for intent and links).

- [docs/PROJECT.md](docs/PROJECT.md): **start here** — intent, documentation map, architecture overview, agent handoff (new Cursor chat)
- [AGENTS.md](AGENTS.md): **setup and deployment detail** (env, Docker, LAN, cron, Vercel, env var table) plus coding rules and checklists
- [SETUP.md](SETUP.md), [DEPLOY.md](DEPLOY.md): thin link hubs → AGENTS.md (no duplicate tables)
- [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md): LAN / Ubuntu home server — bundled Ollama in Compose, systemd, warmup, local vs remote access
- [docs/DECISIONS.md](docs/DECISIONS.md): architecture decision records
- [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md): enhancement backlog and review process
- [docs/github-product-opportunity.md](docs/github-product-opportunity.md): optional GitHub Issues inbox for product feedback (gateway models)

## Project management and agents

For **product intent** (lightweight companion, cost, iterability), **where documentation lives**, and **handoff steps** for an agent in a fresh chat, read [docs/PROJECT.md](docs/PROJECT.md) first, then [AGENTS.md](AGENTS.md) for implementation rules.

## Core principle

Virgil should be as helpful as possible on small local models without becoming flattering, bloated, or expensive.
