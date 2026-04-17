# virgil-manos — LAN inference performance

**virgil-manos** is the operator reference host (Ubuntu, always-on) for **Ollama** and optionally **OpenClaw**. This doc lists practical steps to measure and improve latency from the machine that runs **Next.js** (laptop, Docker host, or Vercel—note Vercel cannot reach a private LAN IP).

## 1. Baseline

From the repo root, with `OLLAMA_BASE_URL` pointing at Manos (e.g. `http://192.168.1.50:11434`):

```bash
pnpm ollama:smoke
```

Note **first_token_ms**, **total_ms**, and **output_tokens_per_s_stream** (generation-only). Compare before/after any change.

## 2. Model and disk

- Keep only the tags you use (`ollama list`); pull the exact base tags from [AGENTS.md](../AGENTS.md) (e.g. `qwen2.5:3b`, `qwen2.5:7b-instruct`).
- Prefer **one** “daily driver” small model for chat when cost/latency matters; use larger tags for review-heavy jobs only.
- NVMe + enough free disk avoids pull and layer thrash.

## 3. GPU vs CPU

If the machine has an NVIDIA GPU, install the vendor stack and use Ollama’s GPU path so **TTFT** and tokens/sec improve versus CPU-only. Docker: see [docker-compose.host-ollama.yml](../docker-compose.host-ollama.yml) and ticket notes on NVIDIA toolkit.

## 4. Warmth (cold start)

Models unload under memory pressure. To keep weights hot on Manos:

- One-shot: `pnpm warmup:ollama` from a dev machine with `OLLAMA_BASE_URL` set to Manos (optional `WARMUP_MODEL=ollama/qwen2.5:3b`).
- Always-on server: `systemd` timer or cron on Manos calling `curl`/`ollama run` on a tiny prompt on the same schedule as your heaviest usage window.

Script reference: [`scripts/warmup-ollama.sh`](../scripts/warmup-ollama.sh).

## 5. Networking

- The app server must use the **LAN IP** hostname for `OLLAMA_BASE_URL`, not a path that hairpins incorrectly through NAT.
- OpenClaw: prefer SSH tunnel per [openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md) instead of exposing the gateway broadly.

## 6. App-side load

- Night review and agent-task triage fan out via QStash; staggering is already documented in AGENTS.md. Avoid stacking many heavy cron jobs at the same second on the same host that runs Ollama.

## Related

- [operator-integrations-runbook.md](operator-integrations-runbook.md) — env by host.
- [beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) — LAN access checklist.
