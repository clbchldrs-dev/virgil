# Free-tier feature map (v1)

Maps **Virgil features** to **provider quotas** so you can stay within Hobby/free limits. Infra caps are also summarized in [AGENTS.md](../AGENTS.md) § Hobby-to-Pro threshold and [docs/vercel-env-setup.md](vercel-env-setup.md).

| Provider | Typical free / Hobby cap | Features that consume it |
|----------|---------------------------|---------------------------|
| **Vercel Hobby** | 100 GB bandwidth/mo, 1,000 serverless function hours/mo | Every `POST /api/chat`, API routes, page SSR. Heavy chat volume burns **fn-hours** fastest. |
| **Vercel Cron** | 2 jobs on Hobby (limit reached) | Daily digest (`/api/digest`), night-review enqueue (`/api/night-review/enqueue`). More schedules → **host cron** + `curl` + `CRON_SECRET` (see AGENTS.md). |
| **Neon free** (or **Supabase**) | ~512 MB storage, compute hours | All Postgres: chats, messages, `Memory`, reminders metadata, `PendingIntent`, `AgentTask`, etc. |
| **Upstash Redis** | 10K commands/day | Rate limits, stream/resumable support, Mem0 monthly counters. |
| **Upstash QStash** | **500 messages/day** | **Each** reminder fire, digest fan-out, night-review **per user** enqueue, agent-task triage deliveries. Batch features and avoid extra workers per lane without counting messages. |
| **Resend** | 100 emails/day, 3k/mo | Reminder emails, daily digest, optional night-review email. |
| **Vercel Blob** | 1 GB Hobby | Chat attachments / document artifacts. |
| **AI Gateway** | Account / plan credits | **Default chat** and tool calls on gateway models; monitor dashboard usage. |
| **Google Generative AI** (optional key) | Gemini free/paid per Google | `VIRGIL_CHAT_FALLBACK` Gemini tier, optional Gemini chat models, night review when `NIGHT_REVIEW_MODEL=google/…`. |
| **Mem0** (optional) | API plan | `recallMemory` / sync when `MEM0_API_KEY` set; caps via `MEM0_MONTHLY_*_LIMIT`. |

## LLM and fallback paths

| Path | Quota / cost | Notes |
|------|----------------|-------|
| Default **gateway** chat | AI Gateway (+ Vercel fn time) | Full **tools** including `fetchUrl` (allowlisted hosts only). |
| **Ollama** (user-selected) | $0 inference; needs reachable `OLLAMA_BASE_URL` | **Thin tools** (optional OpenClaw only) — see [V2_TOOL_MAP.md](V2_TOOL_MAP.md) §1. |
| **Ollama → Gemini → Gateway** | `VIRGIL_CHAT_FALLBACK=1` | When local fails **pre-stream**; escalation uses full tools. |
| **Gateway → Ollama** | `VIRGIL_GATEWAY_FALLBACK_OLLAMA=1` | When gateway fails **pre-stream**; one retry with `DEFAULT_GATEWAY_FALLBACK_OLLAMA_MODEL` (limited tools). Async stream errors may not trigger this path. |

## Client-only features (no extra SaaS)

| Feature | Cost |
|---------|------|
| **Web Speech TTS** (`NEXT_PUBLIC_VIRGIL_TTS_ENABLED=1`) | Uses the browser **Web Speech API**; no server egress. Optional paid TTS (e.g. ElevenLabs) is a future add-on, not required for v1. |

## Related

- [DEPLOY.md](../DEPLOY.md) — deploy hub (links here for quotas).
- [SETUP.md](../SETUP.md) — local setup hub.
