# Virgil Startup Hardening Integration Guide

This document describes the new startup validation system that prevents model config failures.

## What Changed

### New Files

1. **`lib/ai/startup-check.ts`** — Core validation logic
   - `performHealthCheck()` — Checks Ollama + API keys (cached 30s)
   - `assertStartupReady()` — Throws on critical failures (Ollama down)
   - `clearHealthCheckCache()` — Clears cache after config reload

2. **`app/(chat)/api/health/route.ts`** — Health check endpoint
   - `GET /api/health` returns detailed status
   - Status codes: 200 (healthy), 206 (degraded), 503 (error)

3. **`app/(chat)/api/admin/reload-config/route.ts`** — Config reload endpoint
   - `POST /api/admin/reload-config` clears caches without full restart
   - Requires authentication

4. **`components/startup-check.tsx`** — Client-side check component
   - Displays banner on degraded/error status
   - Non-blocking: doesn't prevent chat

## Integration Steps

### 1. Add Startup Check to Layout

Edit `app/layout.tsx`:

```tsx
import { StartupCheck } from '@/components/startup-check';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={...} lang="en" suppressHydrationWarning>
      <head>{/* ... */}</head>
      <body className="antialiased">
        <ThemeProvider {...}>
          <SessionProvider {...}>
            <StartupCheck /> {/* ADD THIS LINE */}
            {/* rest of layout */}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2. (Optional) Run Server-Side Startup Check

If you want to fail fast at server startup:

Edit `lib/auth-secret.ts` or create `lib/startup.ts`:

```tsx
import { assertStartupReady } from './ai/startup-check';

// Call this early in your initialization
await assertStartupReady().catch((error) => {
  console.error('Startup check failed:', error.message);
  process.exit(1);
});
```

But this is **optional**. The client-side check + health endpoint are usually enough.

## Testing

### Test Locally

```bash
# Start app
pnpm dev

# In another terminal, check health
curl http://localhost:3000/api/health

# Should see:
# {
#   "status": "healthy",
#   "ollama": { "reachable": true, "baseUrl": "http://127.0.0.1:11434" },
#   "apis": { "mem0": { "configured": false, "valid": true }, ... }
#   "errors": []
# }
```

### Test Ollama Failure

```bash
# Stop Ollama, then check health
curl http://localhost:3000/api/health

# Should see status: "error" and detailed error in ollama.error
```

### Test Config Reload

```bash
# Change an env var, don't restart
# (In production, update Vercel env vars)

# Then:
curl -X POST http://localhost:3000/api/admin/reload-config \
  -H "Content-Type: application/json"

# Should see: { "status": "reloaded", ... }
```

## How It Helps Your VPS

### Before (Haiku Token Budget)

1. Change `OLLAMA_BASE_URL` or `AI_GATEWAY_API_KEY`
2. App boots fine (no validation)
3. First chat fails cryptically
4. You SSH in, rebuild

### After

1. Change env var
2. App boots, client runs `/api/health`
3. If Ollama is down, you see error immediately
4. Fix Ollama, reload config via `/api/admin/reload-config`
5. No rebuild needed

## Cache Behavior

- Health check cached for **30 seconds**
- Prevents spam on repeated requests
- Cleared by `/api/admin/reload-config`
- Cleared on next check after 30s

## Next Steps

1. **Integrate into layout** (step 1 above)
2. **Test locally** with Ollama startup scenarios
3. **Deploy to Vercel**
4. **Monitor** `/api/health` in production (add to uptime checker)

Optional enhancements:
- Add Slack/email alert when health degrades
- Add dashboard widget showing health status
- Implement deeper API key validation (test actual calls)
- Add model warmup on startup
