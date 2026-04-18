# Stable stop handoff (local branch)

Use this when returning after a long pause. **Stability roadmap:** [STABILITY_TRACK.md](STABILITY_TRACK.md).

Last verified with:

- `pnpm stable:check` — pass (lint + TypeScript + unit tests; no DB required)
- `pnpm build` — pass (includes `tsx lib/db/migrate && next build`; needs DB reachable if migrations run)
- Or in one step: `pnpm stable:check:full` (runs `stable:check` then `pnpm build`)

**Latest run (2026-04-18):** `pnpm stable:check` passed after **`tsconfig.json`** stopped including **`.next/dev/types/**/*.ts`** (Turbopack dev stubs were breaking `tsc` with a `getStreamContext` route typing error unrelated to app source). Production builds still use **`.next/types`** from `next build`. Run `pnpm stable:check:full` locally before shipping if you changed DB or build paths.

## Resume commands (copy order)

```bash
cd /path/to/virgil
corepack enable && corepack prepare pnpm@10.32.1 --activate
pnpm install
pnpm stable:check
pnpm build
pnpm dev
```

Optional local stack: see [AGENTS.md](../AGENTS.md) Docker section.

## Checkpoint — delegation + virgil-manos (2026-04)

**Single narrative:** Hermes-first delegation on the LAN, OpenClaw as second-line; optional **failover** when both URLs are set; **`embedViaDelegation`** for synchronous LAN embeddings (`wiki-embed` skill); docs and env for **virgil-manos** as one operator surface ([virgil-manos-delegation.md](virgil-manos-delegation.md), [openclaw-bridge.md](openclaw-bridge.md), AGENTS.md).

**Works in repo (no LAN required for CI):**

- `delegationPing` / `delegationSendIntent` with `routedVia` on failover; merged skill lists for delegate/embed validation.
- Unit tests: `delegation-provider`, `delegation-embeddings`.

**Stub / verify on hardware:**

- Hermes and OpenClaw gateways must expose **`wiki-embed`** (or `VIRGIL_DELEGATION_EMBED_SKILL`) and list it in **`GET …/skills`** when catalogs are non-empty.
- Tunnels and `HERMES_*` / `OPENCLAW_*` origins: see [openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md).

**Flags:** New env vars default safe; production does not require virgil-manos unless you set delegation URLs.

## Known non-blocking notes

- **Untracked** `.cursor/debug-*.log` files: safe to delete or ignore; do not commit.
- If **`pnpm run type-check`** fails with errors under **`.next/dev/types`**, ensure `tsconfig.json` does not include that path (dev-only); run `pnpm stable:check` from repo root.

## Suggested next tasks (when you return)

1. On **virgil-manos:** confirm `GET /api/delegation/health` (signed in) with both probes and `failoverEnabled` as expected.
2. **M2 wiki loop** is closed in the ticket sense; next wiki work is incremental (ingest, pgvector/BM25) per [docs/tickets/2026-04-18-v1-1-m2-wiki-memory-production-loop.md](tickets/2026-04-18-v1-1-m2-wiki-memory-production-loop.md) follow-ups if any.
3. Reconcile **month-long** product priorities with [docs/PROJECT.md](PROJECT.md) when you resume.
