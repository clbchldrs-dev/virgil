# Stable stop handoff (local branch)

Use this when returning after a long pause. **Stability roadmap:** [STABILITY_TRACK.md](STABILITY_TRACK.md).

Last verified with:

- `pnpm stable:check` — pass (lint + TypeScript + unit tests; no DB required)
- `pnpm build` — pass (includes `tsx lib/db/migrate && next build`; needs DB reachable if migrations run)
- Or in one step: `pnpm stable:check:full` (runs `stable:check` then `pnpm build`)

**Latest run:** both `pnpm stable:check` and `pnpm stable:check:full` succeeded on a dev machine with Postgres reachable; Turbopack NFT warning for user-context addressed by splitting path resolution (`lib/ai/user-context-path.ts`, no `fs`) from prompt assembly and removing unused `systemPrompt` in `lib/ai/prompts.ts`.

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

## What was stabilized this round

- **`app/(auth)/auth.ts`**: debug ingest `fetch().catch` handlers use a non-empty block with an intentional comment (satisfies `noEmptyBlockStatements`); error payload formatting aligned with formatter.
- **`proxy.ts`**: same pattern for middleware debug ingest; Biome formatting applied to long `fetch` calls.

## Known non-blocking notes

- **Untracked** `.cursor/debug-*.log` files: safe to delete or ignore; do not commit.

## Suggested next tasks (when you return)

1. Decide whether to remove or gate **debug ingest** `fetch` calls to localhost (dev-only) to reduce noise and accidental coupling.
2. Reconcile **month-long** product priorities (voice, WhatsApp, etc.) with [docs/PROJECT.md](PROJECT.md) when you resume.
