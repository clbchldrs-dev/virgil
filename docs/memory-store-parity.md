# Memory store parity (local ↔ production)

Virgil stores **`Memory`** and chat data in **Postgres** (`POSTGRES_URL`). Web, mobile, and terminal-driven tools should all read and write the **same** database when you want a single context surface.

## 1. Shared Postgres (recommended default)

1. Copy the **same** connection string Vercel uses into local **`.env.local`** (Neon/Supabase **pooler** for the Next.js server).
2. Run **`pnpm db:migrate`** when migrations change. If the pooler rejects DDL, use the provider’s **direct** `5432` URL for migrations only.
3. Prefer a **Neon branch** instead of production if you need a safe sandbox; merge or promote when satisfied.

No extra application code is required: `pnpm dev` uses `lib/db/client.ts` like production.

## 2. Memory bridge HTTP API (no DB credentials on the client)

When a machine should **not** hold `POSTGRES_URL`, enable the bridge:

| Variable | Purpose |
|----------|---------|
| `VIRGIL_MEMORY_BRIDGE_ENABLED` | Set to `1` |
| `VIRGIL_MEMORY_BRIDGE_SECRET` | `openssl rand -base64 32` |
| `VIRGIL_MEMORY_BRIDGE_USER_ID` | Your `User.id` UUID (same owner as web sessions) |

**Endpoint:** `POST /api/memory/bridge`  
**Auth:** `Authorization: Bearer $VIRGIL_MEMORY_BRIDGE_SECRET`

### Search (vector + FTS, same order as `recallMemory`)

```json
{ "op": "search", "query": "retirement goals", "kind": "goal", "limit": 8 }
```

Response: `{ "memories": [ { "id", "content", "kind", … } ] }`

### Save

```json
{
  "op": "save",
  "kind": "note",
  "content": "Remembered from terminal.",
  "metadata": { "client": "curl" }
}
```

Response: `{ "memory": { … } }`. Rows get `metadata.source = "memory-bridge"` (merged with your metadata).

Set the same three variables on **Vercel** (and locally if you hit localhost) before calling the route.

## 3. Terminal helper

From the repo root, with `.env.local` loaded:

```bash
pnpm memory:bridge search "your query"
pnpm memory:bridge save note "Plain text to store"
```

Uses `VIRGIL_MEMORY_BRIDGE_BASE_URL` if set, else `NEXT_PUBLIC_APP_URL`, else `http://localhost:3000`.

## Security

Treat **`VIRGIL_MEMORY_BRIDGE_SECRET`** like **`CRON_SECRET`**: high privilege, rotate if leaked, never commit. The bridge is **single-owner** (fixed `userId`), not multi-tenant.
