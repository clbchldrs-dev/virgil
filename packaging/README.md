# Desktop-style launcher (Virgil + Docker)

Virgil’s “single stack” is **Docker Compose** (Postgres, Redis, **Ollama**, Next.js in **`virgil-app`**). These scripts reduce friction: they check Docker, bootstrap **`.env.docker`**, ensure **`AUTH_SECRET`**, start the stack, wait until the app responds, and open your browser.

**Practical target:** install [Docker Desktop](https://docs.docker.com/desktop/) (or [OrbStack](https://orbstack.dev/) on macOS) or **Docker Engine on Linux**, then run the launcher. The default **[`docker-compose.yml`](../docker-compose.yml)** includes a bundled **Ollama** container; pull model weights with `docker compose exec ollama ollama pull …` before expecting chat to work.

## Compose layouts

| File | Use |
|------|-----|
| [`docker-compose.yml`](../docker-compose.yml) | Default: `postgres`, `redis`, `ollama`, `virgil-app`. App waits for all three dependencies to be **healthy**. |
| [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml) | Postgres + Redis + `virgil-app` only; **Ollama on the host** (`OLLAMA_BASE_URL`, e.g. `host.docker.internal`). |
| [`docker-compose.override.example.yml`](../docker-compose.override.example.yml) | Hints for local overrides; cannot remove the bundled `ollama` service — use the host-Ollama file instead. |

## Prerequisites

- **Docker** with Compose v2 (`docker compose`, not legacy `docker-compose`).
- **Local models:** with the default compose, **Ollama runs in Docker**; pull tags into that container (see [README.md](../README.md)). If you use **`docker-compose.host-ollama.yml`**, install [Ollama](https://ollama.com/) on the host and set **`OLLAMA_BASE_URL`**. Cloud-only usage still needs **`AI_GATEWAY_API_KEY`** and related keys in `.env.docker` — see [AGENTS.md](../AGENTS.md#setup-checklist).
- **pnpm** (optional): if `pnpm` is on your PATH, the launcher runs **`scripts/virgil-preflight.ts`** in strict mode before `docker compose up`. Without pnpm, the shell scripts still ensure `AUTH_SECRET` and start the stack.

## First run

From the **project root** (the folder that contains `package.json`—often named `virgil`). **Do not** type `/path/to/virgil` literally; substitute your real path (e.g. `~/Documents/virgil`).

**macOS / Linux / Git Bash on Windows**

```bash
chmod +x packaging/launch-virgil.sh packaging/stop-virgil.sh packaging/Virgil.command   # once
./packaging/launch-virgil.sh
```

**npm script (Unix-like shell)**

```bash
pnpm launch:desktop
```

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File .\packaging\launch-virgil.ps1
```

On first run, if **`.env.docker`** is missing, it is copied from **`.env.docker.example`**. If **`AUTH_SECRET`** is empty, a random value is written in place so sessions stay stable across restarts.

Fill in API keys in **`.env.docker`** as needed (same spirit as `.env.local` in [AGENTS.md](../AGENTS.md#setup-checklist)).

## Desktop icon

The companion starts when the **launcher** runs (same as [First run](#first-run)). A desktop icon is just how your OS invokes that launcher.

### Tier 1 — Double-click wrappers (recommended)

These live in **`packaging/`** and `cd` to the repo root automatically, so you can copy or symlink them to the desktop.

**macOS — `packaging/Virgil.command`**

1. Once: `chmod +x packaging/Virgil.command` (Git may clear the executable bit on clone — re-run if double-click does nothing).
2. Double-click **`Virgil.command`** in Finder, or symlink it to the desktop (replace the left path with your real repo root):
   ```bash
   ln -s ~/Documents/virgil/packaging/Virgil.command ~/Desktop/Virgil.command
   ```
3. First launch may prompt to allow Terminal to run the script (System Settings → Privacy & Security).

**Windows — `packaging/Virgil.bat`**

1. Double-click **`Virgil.bat`**, or create a shortcut: right‑click → Send to → Desktop (create shortcut). Edit the shortcut if you need “Start in” to stay empty—the `.bat` changes to the repo root itself.
2. Optional: pin **`Virgil.bat`** to the taskbar or Start menu from that shortcut.

Both wrappers call **`launch-virgil.sh`** (macOS) or **`launch-virgil.ps1`** (Windows), which start Docker Compose and open the browser.

### macOS Dock — `packaging/macos/Virgil.app`

Use this when you want a **real `.app`** you can **drag to the Dock** and **Keep in Dock** (Finder shows its own icon instead of Terminal’s).

1. Open **`packaging/macos/`** in Finder and drag **`Virgil.app`** to the Dock (or double-click to run once, then right‑click the Dock icon → **Options** → **Keep in Dock**).
2. The launcher walks upward from the app bundle until it finds **`packaging/launch-virgil.sh`** and **`docker-compose.yml`**, so the app must stay **inside your clone** at **`packaging/macos/Virgil.app`** (moving only the `.app` to `/Applications` will not find the repo). If you need the app elsewhere, set **`VIRGIL_ROOT`** to the repo root in your environment, or use **`Virgil.command`** / a symlink instead.
3. **Custom icon (e.g. skull):** copy your image in Finder (**Edit → Copy**). **Get Info** on **`Virgil.app`**, click the **small icon** at the top of the info window, then **Edit → Paste**.

First launch may require **System Settings → Privacy & Security** approval if Gatekeeper prompts.

### Tier 0 — Manual shortcuts (no repo files)

If you prefer a shortcut that points at the existing scripts directly:

- **macOS:** Automator “Application” running a shell script, or an alias whose target is **`~/Documents/virgil/packaging/launch-virgil.sh`** (replace with your clone path; run via Terminal/bash).
- **Windows:** Shortcut → **Target:** `powershell.exe` → **Arguments:** `-ExecutionPolicy Bypass -File "C:\Users\You\Documents\virgil\packaging\launch-virgil.ps1"` → **Start in:** `C:\Users\You\Documents\virgil` (repo root, where `docker-compose.yml` lives).
- **Linux:** A `.desktop` file with `Exec=bash -lc '/home/you/virgil/packaging/launch-virgil.sh'` (use your real path); mark executable and `desktop-file-install` or place in `~/.local/share/applications/`.

LAN / custom open URL: still use **`VIRGIL_OPEN_URL`** or **`NEXT_PUBLIC_APP_URL`** as in [docs/beta-lan-gaming-pc.md](../docs/beta-lan-gaming-pc.md).

### Open URL override

- Set **`VIRGIL_OPEN_URL`** (e.g. `http://192.168.1.50:3000`) if the launcher should wait for and open something other than **`NEXT_PUBLIC_APP_URL`** / **`http://localhost:3000`**.

### Stop

```bash
./packaging/stop-virgil.sh
```

```powershell
.\packaging\stop-virgil.ps1
```

Equivalent: `docker compose down` from the project root.

## Preflight only (optional)

```bash
pnpm virgil:preflight
pnpm virgil:preflight:strict
```

Loads **`.env.docker`** and reports required/optional variables for Docker-local mode. **`--strict`** fails if **`AUTH_SECRET`** is missing.

Add **`--ensure-auth`** to generate and persist **`AUTH_SECRET`** if empty (Node-only; the shell launchers already do this without Node).

## Troubleshooting

| Symptom | What to check |
| -------- | --------------- |
| Port in use | **3000** (`virgil-app`), **5432** (Postgres), **6379** (Redis), **11434** (bundled Ollama). Stop conflicting services or change mapped ports in `docker-compose.yml`. |
| Auth / cookies | Use **`localhost`** (not `127.0.0.1`) unless you set **`AUTH_URL`** / **`NEXT_PUBLIC_APP_URL`** for that origin. LAN access: see [AGENTS.md](../AGENTS.md#docker-compose-postgres--redis--ollama--app-in-one-command). |
| Ollama unreachable | Default stack uses the **`ollama`** container (`OLLAMA_BASE_URL=http://ollama:11434` in **`virgil-app`**). Host-Ollama layout: [`docker-compose.host-ollama.yml`](../docker-compose.host-ollama.yml) and `OLLAMA_BASE_URL` (e.g. `host.docker.internal` on Docker Desktop). |
| App never becomes ready | `docker compose logs -f virgil-app` and ensure **`.env.docker`** has the keys your features need. |

## Background jobs, cron, and QStash (local Docker)

- **Vercel Cron does not run** when you only run the stack locally. Scheduled routes that rely on Vercel’s platform cron will not fire automatically.
- **QStash** and other cloud queue features expect production-style URLs and secrets; treat local Docker as **dev** unless you configure those services explicitly.
- **Night review / digest** and similar flows: use **host `cron`** (macOS/Linux) or **Task Scheduler** (Windows) to `curl` your enqueue endpoints with **`CRON_SECRET`**, for example:

```bash
curl -sS -X POST "http://localhost:3000/api/your-cron-path" \
  -H "Authorization: Bearer $CRON_SECRET"
```

(Replace the path with the route your app documents; keep the secret out of shell history where possible.)

See [AGENTS.md](../AGENTS.md#setup-checklist) for full credential and LAN setup.

## Phase 2 — Native shell (optional, not in v1)

A thin **Tauri 2** or **Electron** wrapper could run the same steps as the launchers: run **`docker compose`** as a child process, show **logs**, **Start / Stop**, **Open Virgil**, and link to Docker/Ollama install docs when checks fail. The wrapper should stay **thin** and still shell out to Docker rather than reimplementing orchestration. macOS distribution would add **codesign + notarization** if you ship outside developer machines.

---

More context: [AGENTS.md](../AGENTS.md#docker-compose-postgres--redis--ollama--app-in-one-command) → **Host Ollama instead of the bundled container**.
