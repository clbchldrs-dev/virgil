# Beta on a LAN home server (Ubuntu-first)

Use this when Virgil’s **Docker stack** (Postgres, Redis, **Ollama**, `virgil-app`) runs on a **home PC** (gaming PC or small server) and phones or other PCs on the same network use it over **HTTP**.

**Primary path:** **Ubuntu** + Docker Engine + Compose, with **Ollama bundled in Compose** (see root [`docker-compose.yml`](../docker-compose.yml)). Authoritative env steps: [AGENTS.md — Setup checklist](../AGENTS.md#setup-checklist). Launcher scripts: [packaging/README.md](../packaging/README.md).

**24/7 server path:** Prefer **native Ubuntu** + Docker Engine (this doc). **WSL2** is not a supported production layout here—extra virtualization adds latency vs bare metal; use Ubuntu on the metal or a Linux VM for always-on service.

**Other platforms:** Docker Desktop on Windows/macOS can use the same `docker-compose.yml`, or [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml) if Ollama must run on the host (e.g. GPU on Docker Desktop or drivers you only trust outside the container). For **GPU inside Compose on Linux**, install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) and merge a GPU override (see [`docker-compose.override.example.yml`](../docker-compose.override.example.yml)).

## Topology

**Default stack (recommended on Ubuntu):** Services `postgres`, `redis`, `ollama`, and `virgil-app`. Inside the app container:

```bash
OLLAMA_BASE_URL=http://ollama:11434
```

Compose maps **Ollama port 11434** to the host, so you can run `pnpm ollama:smoke` with `OLLAMA_BASE_URL=http://127.0.0.1:11434` after `docker compose up`.

**Pull models once** into the Ollama volume (example tags match [README.md](../README.md)):

```bash
docker compose exec ollama ollama pull qwen2.5:3b
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

**Host Ollama instead of the bundled container:** use `docker compose -f docker-compose.host-ollama.yml up --build` and set `OLLAMA_BASE_URL` in `.env.docker` (see that file’s header). Do not run two Ollamas on **TCP 11434** at once.

Give the server a **stable LAN IP** (DHCP reservation or static address) so `AUTH_URL` / `NEXT_PUBLIC_APP_URL` do not change.

## Running 24/7 (downtime is OK)

Many people treat the machine as an **always-on home server**: leave Compose running so the companion is available day and night.

- **Downtime happens:** updates, power loss, sleep, GPU driver installs, or you shutting the machine off. Recovery should stay **simple** (see below).
- **Graceful recovery:** After a reboot, start the stack the same way as always (`docker compose up -d` in the repo, [launcher](../packaging/README.md), or **systemd** below). `virgil-app` waits until **Postgres, Redis, and Ollama** are **healthy** before starting. Then open the app URL. `GET /ping` returns `pong` ([`proxy.ts`](../proxy.ts)) for a cheap readiness probe.
- **Compose** uses `restart: unless-stopped` on all services in [`docker-compose.yml`](../docker-compose.yml).

This is **not** five-nines cloud reliability; it is **“good enough when the PC is on.”**

### Sleep vs shutdown (Linux)

For a **24/7 home server** you usually want the shortest path back to a working stack. On typical PC firmware:

- **Suspend to RAM (often called S3 / “sleep”)** powers down most of the machine but keeps **RAM** (and often **GPU VRAM** contents) powered. Wake is **much faster** than a **cold boot** (full shutdown / S5). After resume, verify Docker and Compose (`docker compose ps`) and optionally hit **`/ping`**—some setups need a moment for the network or GPU to settle.
- **Hibernate (S4)** writes RAM to disk and powers off; wake is slower than S3 but faster than a full cold boot from storage spin-up in some cases.
- **Full shutdown** clears volatile state; **Ollama** and the **kernel** start cold, so **time-to-first-token** is worst-case (see [Cold start, time-to-ready, and warmup](#cold-start-time-to-ready-and-warmup-e8)).

**Practical bias:** Prefer **S3-class suspend** when the machine is idle but you want it back quickly; use **full shutdown** for maintenance, travel, or when you want a clean slate. Tune **systemd logind** / desktop power settings so the machine does not **hibernate** unexpectedly if you rely on wake-on-LAN.

## Quick reference: open the companion (local vs LAN vs remote)

Use **one** browser URL per environment. Auth cookies are **origin-bound**—see [LAN origin](#lan-origin-required-for-other-devices) when you are not on `localhost`.

| You are… | Typical URL | Notes |
|----------|-------------|--------|
| On the **same PC** as Docker | `http://localhost:3000` | Fastest for daily use on the server. |
| On **another device** on the **same LAN** | `http://<server-lan-ip>:3000` | Same `AUTH_URL` / `NEXT_PUBLIC_APP_URL` you set for that IP. |
| **Away from home** | No default in-repo URL | Use **Tailscale**, **WireGuard**, etc., then the same HTTP port as at home. |

**Concise rule:** *local* = localhost on the box; *at home elsewhere* = LAN IP; *elsewhere* = VPN or tunnel first.

## Cold start, time-to-ready, and warmup (E8)

A **cold boot** (power on → Docker → healthy dependencies → first token) can still take **minutes**. On **native Linux**, you avoid the extra VM overhead of Docker Desktop on Windows; remaining time is mostly image pulls, Postgres/Ollama health, Next.js startup, and **loading model weights**.

**What we ship for a faster path:**

- **Health-gated startup:** `virgil-app` starts only after Postgres, Redis, and Ollama pass Docker healthchecks ([`docker-compose.yml`](../docker-compose.yml)).
- **Optional warmup:** after the stack is up, run [`scripts/warmup-ollama.sh`](../scripts/warmup-ollama.sh) or `pnpm warmup:ollama` to call Ollama `POST /api/generate` with `keep_alive: -1` so the default model stays loaded (see [`lib/ai/warmup-ollama.ts`](../lib/ai/warmup-ollama.ts)). Requires the model to exist in the Ollama container (`ollama pull` first).

**Practical mitigations:**

- **SSD** for the system and Docker data.
- **Pin** weights with `docker compose exec ollama ollama pull …` before you care about latency.
- **`docker compose up --build`** after changing `NEXT_PUBLIC_*` (client bundle).

### Manual: measure “time-to-ready” after a clean reboot

Use a wall clock or `date +%s`. Record:

1. **T0:** machine begins boot (power on or `reboot`).
2. **T1:** `docker compose up -d` completes (or systemd unit has started the stack).
3. **T2:** `curl -fsS http://127.0.0.1:3000/ping` returns `pong` (or open the app in a browser until the UI loads).
4. **T3 (optional):** `pnpm warmup:ollama` succeeds, then `pnpm ollama:smoke` with `OLLAMA_BASE_URL=http://127.0.0.1:11434`.

Report **T2−T0** and **T3−T2** as you like; numbers vary by CPU, disk, GPU, and model size.

## systemd (example: start stack on boot)

Edit paths and user. This assumes Docker is enabled (`sudo systemctl enable docker`) and the repo lives at `/srv/virgil` (clone the project into that directory, or adjust paths).

`/etc/systemd/system/virgil-docker.service`:

```ini
[Unit]
Description=Virgil Docker Compose stack
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/virgil
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now virgil-docker.service
```

**Warmup after boot:** Prefer a **separate** `oneshot` or **timer** that runs `scripts/warmup-ollama.sh` once Docker reports healthy containers—avoid racing Compose before Ollama is ready. Alternatively run warmup manually or from cron `@reboot` with a sleep.

## One-time setup (Ubuntu home server)

1. Install [Docker Engine](https://docs.docker.com/engine/install/ubuntu/) and the Compose plugin (`docker compose version`).
2. Clone the repo and create **`.env.docker`** from [`.env.docker.example`](../.env.docker.example).
3. Set **`AUTH_SECRET`** (`openssl rand -base64 32`) and keys your features need (same spirit as [AGENTS.md Step 1](../AGENTS.md#step-1--fill-credentials-in-envlocal)).
4. `docker compose up --build`, then **pull models** into the Ollama container (see [Topology](#topology)).
5. Migrations run on container start unless you run `pnpm db:migrate` separately against `POSTGRES_URL`.

**Windows / macOS (Docker Desktop):** still supported; use the launchers in [packaging/README.md](../packaging/README.md). If you need **host** Ollama with GPU, prefer [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml).

## LAN origin (required for other devices)

Browsers on **other machines** must use `http://<server-lan-ip>:3000`, not `localhost`.

1. Set **`AUTH_URL`** and **`NEXT_PUBLIC_APP_URL`** to the **exact origin** clients use (same host, port, scheme):

   ```bash
   AUTH_URL=http://192.168.x.x:3000
   NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000
   ```

   Put these in a **project-root `.env`** (gitignored) or **`.env.docker`** — see [AGENTS.md § LAN](../AGENTS.md#access-from-another-device-on-your-lan-eg-gaming-pc-as-server).

2. **Rebuild** after changing `NEXT_PUBLIC_APP_URL`:

   ```bash
   docker compose up --build
   ```

3. On the **server only**, you may use `http://localhost:3000` if that matches your env; other devices use the **LAN IP**.

## Firewall (typical)

- **TCP 3000** — web UI.
- **TCP 11434** — only if other LAN machines must talk to Ollama **on the host**; the bundled container still publishes 11434 unless you remove the mapping.

## First start (launcher)

From the repo root:

- **PowerShell (Windows):** `powershell -ExecutionPolicy Bypass -File .\packaging\launch-virgil.ps1`
- **Bash:** `pnpm launch:desktop` or `./packaging/launch-virgil.sh`

Set **`VIRGIL_OPEN_URL=http://<lan-ip>:3000`** if the launcher should open the LAN URL — [packaging/README.md § Open URL override](../packaging/README.md#open-url-override).

## Background jobs on LAN Docker

**Vercel Cron does not run** on a self-hosted stack. Night review, digest, and similar routes need **manual scheduling** (`cron` or **systemd timer** on Linux, Task Scheduler on Windows) calling your URL with `CRON_SECRET`, or leave them off for early beta. Details: [packaging/README.md § Background jobs](../packaging/README.md#background-jobs-cron-and-qstash-local-docker).

## Verification checklist

| Step | Check |
|------|--------|
| Reachability | From another device: `http://<ip>:3000` |
| Auth | Register or log in; session persists (same origin) |
| Chat | Send a message using a **local** Ollama model |
| Models | `docker compose exec ollama ollama list` — pull missing tags if chat errors |
| Smoke | `OLLAMA_BASE_URL=http://127.0.0.1:11434 pnpm ollama:smoke` |
| Warmup (optional) | `OLLAMA_BASE_URL=http://127.0.0.1:11434 pnpm warmup:ollama` |

## Data and secrets

- Postgres: **`pgdata`** volume. Ollama weights: **`ollama_data`** volume ([`docker-compose.yml`](../docker-compose.yml)).
- Never commit `.env`, `.env.docker`, or `.env.local` with real secrets.

## Troubleshooting

| Symptom | See |
|---------|-----|
| Cookies / login broken | Origin must match exactly. [AGENTS.md LAN](../AGENTS.md#access-from-another-device-on-your-lan-eg-gaming-pc-as-server) |
| Ollama unreachable from `virgil-app` | Default `http://ollama:11434` inside Compose; ensure `ollama` service is healthy (`docker compose ps`). |
| Host Ollama layout | [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml) + `OLLAMA_BASE_URL` |
| Port conflicts | 3000, 5432, 6379, 11434 — [packaging README](../packaging/README.md#troubleshooting) |

## Related

- [docs/PROJECT.md](PROJECT.md) — intent and SSOT map  
- [AGENTS.md — Deployment (production)](../AGENTS.md#deployment-production) — when moving from LAN beta to Vercel or hybrid  
