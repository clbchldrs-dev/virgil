# Code Review Checklist - Startup Hardening

**Reviewer:** Cursor  
**Branch:** feat/startup-hardening  
**Commit:** d246000  

---

## Code Quality

- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] No linting errors (`pnpm lint`)
- [ ] All imports resolve correctly
- [ ] No unused variables or imports

## Logic Review

### `lib/ai/startup-check.ts`

- [ ] `checkOllama()` error detection is comprehensive
  - [ ] Connection errors caught
  - [ ] Timeout handling (AbortSignal.timeout)
  - [ ] "No models" case handled
  - [ ] Status code handling
- [ ] `checkApiKeys()` validation logic
  - [ ] Key lengths reasonable (10+ chars for secrets)
  - [ ] Optional keys don't fail healthcheck
  - [ ] All required keys covered (MEM0, JIRA, Qstash, GitHub, AI Gateway)
- [ ] `performHealthCheck()` caching
  - [ ] 30s TTL appropriate?
  - [ ] Cache key strategy (single cache, not per-baseUrl)?
  - [ ] Thread-safe (using Date.now(), static var)?
- [ ] `assertStartupReady()` error handling
  - [ ] Throws on Ollama unreachable (good)
  - [ ] Logs (not throws) on optional API missing (good)
  - [ ] Error message is user-friendly

### `app/(chat)/api/health/route.ts`

- [ ] Status code mapping makes sense
  - [ ] 200 = healthy ✓
  - [ ] 206 = degraded (partial content) — sensible choice?
  - [ ] 503 = error (service unavailable) ✓
- [ ] Caching behavior
  - [ ] Delegates to startup-check (30s cache reused) ✓
- [ ] Error handling
  - [ ] Try/catch covers all failure cases
  - [ ] Response format consistent with success case

### `app/(chat)/api/admin/reload-config/route.ts`

- [ ] Authentication check
  - [ ] Uses `auth()` from next-auth ✓
  - [ ] Requires logged-in user (not just any request) ✓
  - [ ] Error message clear (401 Unauthorized) ✓
- [ ] Cache clearing
  - [ ] Only clears health check cache (appropriate scope)
  - [ ] Could clear other caches in future (TODOs noted)
- [ ] Response format
  - [ ] Includes timestamp ✓
  - [ ] Message tells user what to do next ✓

### `components/startup-check.tsx`

- [ ] Client-side component (use client) ✓
- [ ] useEffect dependency array
  - [ ] Empty `[]` = runs once on mount ✓
  - [ ] Good
- [ ] Error handling
  - [ ] Fetch failure caught
  - [ ] Console.error for debugging ✓
- [ ] UI
  - [ ] Non-blocking (doesn't prevent chat)
  - [ ] Only shows on error/degraded
  - [ ] Helpful message + link to /api/health
  - [ ] Styling (Tailwind classes exist in project?)

## Integration Points

- [ ] `components/startup-check.tsx` should be added to `app/layout.tsx`
  - [ ] Location: Inside `<SessionProvider>` but before children? (Check guide)
- [ ] `lib/ai/startup-check.ts` exported correctly
  - [ ] All public functions exported
  - [ ] Types exported (HealthCheckResult)
- [ ] New routes properly nested under `app/(chat)/api/`

## Testing

- [ ] Run locally: `pnpm dev` + `curl http://localhost:3000/api/health`
- [ ] Test scenarios:
  - [ ] Ollama running: returns 200 healthy
  - [ ] Ollama stopped: returns 503, error message clear
  - [ ] API key missing: returns 206 degraded (not error)
  - [ ] Missing two API keys: both listed in errors
  - [ ] Timeout scenario: error message includes timeout hint
- [ ] Config reload:
  - [ ] `POST /api/admin/reload-config` requires auth
  - [ ] Unauth request: 401
  - [ ] Auth request: returns 200 reloaded
- [ ] Startup component:
  - [ ] Add to layout, load app
  - [ ] No errors in console
  - [ ] Component mounts (check React devtools)
  - [ ] No UI visible when healthy (correct)
  - [ ] UI appears when degraded (trigger by removing API key)

## Documentation

- [ ] `HARDENING_INTEGRATION.md` is clear and complete
  - [ ] Integration steps are exact (copy/paste ready)
  - [ ] Testing instructions work
  - [ ] Next steps are actionable
- [ ] Code comments are helpful
  - [ ] Each function has JSDoc
  - [ ] Complex logic explained
  - [ ] No redundant comments

## Security

- [ ] `/api/health` is public (OK? no secrets leaked?)
  - [ ] Only shows if keys are configured, not the keys themselves ✓
  - [ ] baseUrl is safe to expose ✓
- [ ] `/api/admin/reload-config` is auth-protected ✓
- [ ] No hardcoded secrets ✓
- [ ] No logging of actual API key values ✓

## Performance

- [ ] Health check caching (30s) prevents spam ✓
- [ ] Ollama check timeout (5s) reasonable?
  - [ ] Not too short (false positives)
  - [ ] Not too long (user waits forever)
  - [ ] Could make configurable? (future enhancement)
- [ ] No N+1 queries or repeated work

## Future-Proofing

- [ ] Comments note where to add fallback chain (model selection)
- [ ] Comments note where to add deeper API validation
- [ ] Comments note where to add alerting
- [ ] Errors are actionable (user knows what to do)

---

## Sign-Off

- [ ] I've reviewed all code above
- [ ] I've run tests locally
- [ ] I'm confident this solves the stated problem
- [ ] No blockers to merge

**Reviewer:** ________________  
**Date:** ________________  
**Comments:** (use space below)

---

## Reviewer Notes

(Cursor: add comments, concerns, suggestions here)
