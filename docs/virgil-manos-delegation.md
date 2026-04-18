# virgil-manos — delegation (Hermes first, OpenClaw second)

**virgil-manos** is the operator reference host on the LAN (Ubuntu, always-on): **Ollama**, optional **Hermes** HTTP bridge, optional **OpenClaw** gateway. Virgil’s chat tools (`delegateTask`, `embedViaDelegation`, approvals) talk to **one primary** bridge chosen at runtime, with an **optional failover** to the other when both are configured.

## Routing rules (in-app)

1. **Primary backend** — `VIRGIL_DELEGATION_BACKEND` if set to `hermes` or `openclaw`. If **unset**, Virgil prefers **Hermes** when `HERMES_HTTP_URL` is set; otherwise **OpenClaw** when `OPENCLAW_*` is set.
2. **Failover** — When **both** Hermes and OpenClaw URLs are present in env, **`VIRGIL_DELEGATION_FAILOVER` defaults to on** (set to `0` / `false` / `off` to disable). If the primary does not respond to health `ping`, Virgil routes **send** operations to the secondary (Hermes ↔ OpenClaw). Skill lists for `delegateTask` / `embedViaDelegation` validation are the **union** of both catalogs when failover is enabled.
3. **Reachability** — `GET /api/delegation/health` reports per-bridge probes plus `delegationOnline` (true if **either** bridge answers when failover is on). Implement the same **`wiki-embed`** (or `VIRGIL_DELEGATION_EMBED_SKILL`) skill on whichever gateway you treat as primary for embeddings, or on **both** if you rely on failover.

## Recommended env (Mac / laptop running `pnpm dev`, tunnel or LAN to manos)

Use an SSH tunnel or private LAN URL; do not commit real hosts or secrets.

```bash
# Ollama on manos (chat savings)
OLLAMA_BASE_URL=http://<manos-lan-ip>:11434

# Hermes HTTP bridge on manos (primary delegation)
HERMES_HTTP_URL=http://127.0.0.1:8765
# After SSH: ssh -L 8765:127.0.0.1:8765 user@manos
HERMES_EXECUTE_PATH=/api/execute
HERMES_SKILLS_PATH=/api/skills
HERMES_HEALTH_PATH=/health
HERMES_PENDING_PATH=/api/pending
# HERMES_SHARED_SECRET=...   # if the bridge requires Bearer auth off-loopback

# OpenClaw on manos (breadth / compatibility fallback)
OPENCLAW_HTTP_URL=http://127.0.0.1:13100
# Or OPENCLAW_URL=ws://127.0.0.1:13100
OPENCLAW_EXECUTE_PATH=/api/execute
OPENCLAW_SKILLS_PATH=/api/skills
OPENCLAW_HEALTH_PATH=/health

# Explicit Hermes-first (optional; matches default when both are set)
VIRGIL_DELEGATION_BACKEND=hermes

# Failover on when both bridges are configured (optional; default behavior)
# VIRGIL_DELEGATION_FAILOVER=1

# Wiki / hybrid-search embeddings via delegation (same execute contract as delegateTask)
# VIRGIL_DELEGATION_EMBED_SKILL=wiki-embed
```

## Verification

1. From the machine running Virgil: `GET /api/delegation/health` (signed-in session) — confirm `probes.hermes.online`, `probes.openclaw.online`, `failoverEnabled`, and `delegationOnline`.
2. In chat (gateway or local with delegation tools): run a harmless `delegateTask` or `embedViaDelegation` after both gateways implement the advertised skills.

## Related docs

- [openclaw-bridge.md](openclaw-bridge.md) — bridge contract, `wiki-embed`, env table
- [openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md) — loopback + SSH patterns
- [manos-performance.md](manos-performance.md) — Ollama latency tuning on the LAN host
