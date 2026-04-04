# Stable stop handoff (local branch)

Use this when returning after a long pause. Last verified with:

- `pnpm check` — pass
- `pnpm build` — pass (includes `tsx lib/db/migrate && next build`; needs DB reachable if migrations run)
- `node --test --import tsx tests/unit/*.test.ts` — all unit tests pass

## Resume commands (copy order)

```bash
cd /path/to/virgil
corepack enable && corepack prepare pnpm@10.32.1 --activate
pnpm install
pnpm check
pnpm build
node --test --import tsx tests/unit/*.test.ts
pnpm dev
```

Optional local stack: see [AGENTS.md](../AGENTS.md) Docker section.

## What was stabilized this round

- **`app/(auth)/auth.ts`**: debug ingest `fetch().catch` handlers use a non-empty block with an intentional comment (satisfies `noEmptyBlockStatements`); error payload formatting aligned with formatter.
- **`proxy.ts`**: same pattern for middleware debug ingest; Biome formatting applied to long `fetch` calls.

## Known non-blocking notes

- **Next build** may log a Turbopack NFT warning tracing through `next.config.ts` → `lib/ai/prompts.ts` (filesystem read for `user-context.md`). Build still completed successfully.
- **Untracked** `.cursor/debug-*.log` files: safe to delete or ignore; do not commit.

## Suggested next tasks (when you return)

1. Decide whether to remove or gate **debug ingest** `fetch` calls to localhost (dev-only) to reduce noise and accidental coupling.
2. Address the **Turbopack NFT** warning by narrowing dynamic `readFileSync` usage in prompts (or documenting an ignore) if it becomes noisy.
3. Reconcile **month-long** product priorities (voice, WhatsApp, etc.) with [docs/PROJECT.md](PROJECT.md) when you resume.
