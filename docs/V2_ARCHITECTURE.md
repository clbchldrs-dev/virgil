# Virgil v2.1 — Architecture Plan

> Status: PLANNED — Not in development. Target: June 2026 (hardware-dependent).
> This document is the single source of truth for v2 design decisions.
> See docs/V2_MIGRATION.md for how v1 transitions to v2.

---

# Virgil v2.1 — Cursor Implementation Prompt

## Context

Virgil is a proactive personal AI assistant built for a single user (Caleb). It ingests context from calendar, task management, and manual input, surfaces actionable nudges before the user asks, and can execute tasks autonomously. The personality is stoic, reserved, and direct — it does work quietly and presents results, not process. For **shipped v1** voice and product intent, prefer [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md) and (when completed) [VIRGIL_PERSONA.md](VIRGIL_PERSONA.md) over this prompt’s shorthand.

**Hardware reality:**
- **Services host (now):** A 2012-era Ubuntu box (DDR3, GTX 1070 — irrelevant for inference). Runs the Python backend: event loop, API server, memory layer, ingestion workers, tool execution, night mode scheduler. No local inference.
- **Frontend (now):** Existing Next.js app deployed on Vercel (from the `clbchldrs-dev/virgil` repo). Chat UI with auth, shadcn/ui components, Vercel AI SDK. The Python backend is headless — the Next.js frontend is the user-facing interface.
- **Inference (now through July 2026):** Gemini API via Google AI Studio. Two model tiers: `gemini-2.0-flash` for fast/cheap operations and `gemini-2.5-pro` for complex reasoning.
- **Inference (August 2026+):** tiiny.ai Pocket Lab (80GB LPDDR5X, 190 TOPS NPU) takes over as local inference. Gemini becomes fallback. Phase 2.

The Ubuntu box and Vercel frontend connect over Tailscale (or Cloudflare Tunnel). The Python backend exposes a REST/SSE API that the Next.js frontend consumes.

## What to Build

A Python-based agentic backend that runs as a background service on the Ubuntu box. It:
- Ingests context from calendar, Jira, filesystem, and manual input
- Maintains a local memory layer with priority weighting
- Runs a single orchestrator agent on a continuous event-driven cycle
- Exposes an API for the existing Next.js frontend to consume
- **Executes tools** — can act on the environment, not just advise
- **Runs a night mode** — autonomous work window while Caleb sleeps
- **Loads skills** — modular plugin system for extensible capabilities

Phase 1: **single agent, single loop, no swarm.** Sub-agents and parallelism come later.

---

## Project Structure

```
virgil/
├── pyproject.toml
├── .env.example
├── AGENTS.md                  # Agent handoff doc (read-first for Cursor)
├── README.md
├── virgil/
│   ├── __init__.py
│   ├── main.py               # Entrypoint — starts event loop and API server
│   ├── config.py             # Pydantic settings from .env
│   ├── core/
│   │   ├── __init__.py
│   │   ├── loop.py           # Main continuous loop (event-driven)
│   │   ├── orchestrator.py   # Single agent: ingest → reason → act
│   │   ├── scheduler.py      # Cron-like scheduler for periodic tasks
│   │   └── night.py          # Night mode autonomous work controller
│   ├── inference/
│   │   ├── __init__.py
│   │   ├── router.py         # Routes to fast or heavy model
│   │   ├── gemini_client.py  # Gemini API client
│   │   ├── base.py           # Abstract inference client interface
│   │   └── budget.py         # API cost tracking and rate limiting
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── manager.py        # Unified memory interface
│   │   ├── local_store.py    # SQLite-backed local memory (L1/L2)
│   │   ├── mem0_client.py    # Mem0 API client for L3 cold storage
│   │   └── priority.py       # Priority weighting logic
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── manager.py        # Registers and runs all sources
│   │   ├── google_calendar.py
│   │   ├── jira.py
│   │   ├── filesystem.py
│   │   └── manual.py
│   ├── tools/                 # Tool execution layer — Virgil can ACT
│   │   ├── __init__.py
│   │   ├── registry.py       # Tool discovery, registration, permission model
│   │   ├── base.py           # Abstract tool interface
│   │   ├── jira_comment.py   # Post comments on Jira tickets
│   │   ├── jira_transition.py # Move tickets between statuses
│   │   ├── notify.py         # Push notifications via ntfy.sh
│   │   ├── file_write.py     # Write files to designated output dirs
│   │   ├── shell.py          # Sandboxed shell execution (allowlisted commands only)
│   │   └── web_fetch.py      # Fetch and summarize web pages
│   ├── skills/                # Plugin system — modular capabilities
│   │   ├── __init__.py
│   │   ├── loader.py         # Discovers and loads skills at startup
│   │   ├── base.py           # Abstract skill interface
│   │   └── README.md         # How to create a skill
│   ├── actions/
│   │   ├── __init__.py
│   │   ├── briefing.py       # Daily briefing generator
│   │   ├── nudge.py          # Proactive nudge engine
│   │   └── task_complete.py  # Silent task completion
│   ├── persona/
│   │   ├── __init__.py
│   │   ├── mask.py           # Persona enforcement + system prompt construction
│   │   └── persona.md        # Virgil persona doc (versioned, human-editable)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── server.py         # FastAPI server
│   │   ├── routes.py         # Chat, status, memory, trigger, budget endpoints
│   │   └── models.py         # Pydantic request/response models
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── logger.py         # Structured JSON logging
│   │   ├── traces.py         # Decision trace recorder
│   │   └── metrics.py        # Hit rate, budget, performance tracking
│   └── utils/
│       ├── __init__.py
│       └── tailscale.py      # Network utility — device discovery, health
├── skills/                    # User-created skills directory (outside package)
│   └── example/
│       ├── SKILL.md           # Skill manifest
│       └── skill.py           # Skill implementation
├── tests/
│   ├── test_orchestrator.py
│   ├── test_memory.py
│   ├── test_tools.py
│   ├── test_skills.py
│   ├── test_night_mode.py
│   └── test_ingestion.py
├── data/
│   ├── virgil.db             # SQLite (gitignored)
│   └── traces/               # Decision trace logs (gitignored)
└── docs/
    ├── ARCHITECTURE.md
    └── BACKLOG.md
```

---

## AGENTS.md (create this file at project root)

```markdown
# AGENTS.md — Virgil Backend

Read this file before making changes. For architecture details, see docs/ARCHITECTURE.md.

## What This Is

Virgil's Python backend. Headless agentic service running on a 2012 Ubuntu box.
The Next.js frontend (separate repo) talks to this over Tailscale/Tunnel.

## North Star

Make Virgil as useful as possible on a $75/month Gemini budget without becoming
flattering, bloated, or noisy. Advisor + executor, not just a chatbot.

## Rules

1. Every inference call costs money. If you can solve it in Python, do.
2. Tools must be sandboxed. No unrestricted shell access. Allowlisted commands only.
3. Night mode work must be idempotent — if it crashes at 3am, nothing is corrupted.
4. Skills are isolated. A broken skill cannot crash the core loop.
5. Log every decision, every tool invocation, every dollar spent.
6. The persona is enforced on every response. No exceptions.
7. Tests before features. Each implementation step must have a passing test.

## Handoff checklist (new Cursor chat)

1. Read this file
2. Read docs/ARCHITECTURE.md
3. Check `git log --oneline -10` for recent changes
4. Run `pytest` to verify current state
5. Check `.env.example` for required configuration
6. Review the implementation order in this prompt — pick up where it left off
```

---

## Implementation Spec

### 1. Configuration (`config.py`)

Use Pydantic `BaseSettings` loading from `.env`:

```
GEMINI_API_KEY=
GEMINI_FAST_MODEL=gemini-2.0-flash
GEMINI_HEAVY_MODEL=gemini-2.5-pro
GEMINI_MONTHLY_BUDGET_USD=75.00
GEMINI_NIGHT_BUDGET_USD=25.00
MEM0_API_KEY=
MEM0_USER_ID=caleb
GOOGLE_CALENDAR_CREDENTIALS_PATH=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=DAMC
WATCH_DIRECTORIES=/home/caleb/virgil-drops
SKILLS_DIRECTORIES=/home/caleb/virgil/skills
TAILSCALE_ENABLED=false
BRIEFING_TIME=07:30
NUDGE_INTERVAL_MINUTES=60
NIGHT_WINDOW_START=23:00
NIGHT_WINDOW_END=07:00
NTFY_TOPIC=virgil-caleb
NTFY_SERVER=https://ntfy.sh
LOG_LEVEL=INFO
INFERENCE_PROVIDER=gemini
ALLOWED_SHELL_COMMANDS=git status,git log,ls,cat,wc,df,uptime
```

### 2. The Main Loop (`core/loop.py`)

Event-driven using `asyncio`. Same architecture as previous version but with awareness of night mode:

```python
class VirgilLoop:
    async def run(self):
        await asyncio.gather(
            self.ingestion_manager.start(self.event_queue),
            self.scheduler.start(self.event_queue),
            self.api_server.start(self.event_queue),
            self.night_controller.start(self.event_queue),
            self._process_events(),
        )

    async def _process_events(self):
        while True:
            event = await self.event_queue.get()
            try:
                await self.orchestrator.handle(event)
            except Exception as e:
                logger.error(f"Event handling failed: {e}", exc_info=True)
```

Events are typed dataclasses:

```python
@dataclass
class VirgilEvent:
    source: str          # "calendar", "jira", "filesystem", "chat", "scheduler", "night"
    event_type: str      # "context_update", "user_message", "scheduled_briefing",
                         # "scheduled_nudge", "night_task", "tool_result"
    payload: dict
    timestamp: datetime
    priority: int = 0
```

### 3. The Orchestrator (`core/orchestrator.py`)

Single agent. Decision flow:
1. **Classify**: User message, context update, scheduled task, night task, or tool result?
2. **Retrieve**: Pull relevant memory from L1/L2. L3 on miss.
3. **Reason**: Build prompt with persona + context + event. Route to fast or heavy model.
4. **Plan**: If the response requires action, select tools. If multiple actions needed, sequence them.
5. **Act**: Execute tools, respond to user, store to memory, generate nudge, or do nothing.
6. **Log**: Record full decision trace including tool invocations and results.

Model routing:
- **Fast (flash):** Briefings, conflict detection, simple Q&A, nudge phrasing, memory classification, tool selection for routine actions.
- **Heavy (pro):** Multi-step planning, nuanced drafts, novel problem solving, night mode self-evaluation.

Tool invocation follows a ReAct-style loop: the LLM can request a tool call, the orchestrator executes it, and the result is fed back for the next reasoning step. Cap at 5 tool calls per event to prevent runaway loops.

### 4. Tool Execution Layer (`tools/`)

This is what makes Virgil an agent instead of an advisor.

```python
# tools/base.py
class Tool(ABC):
    name: str
    description: str          # Used in LLM tool-selection prompts
    requires_approval: bool   # If True, queue for user confirmation before executing
    allowed_in_night: bool    # If True, can run during night mode without approval

    @abstractmethod
    async def execute(self, params: dict) -> ToolResult:
        pass

    @abstractmethod
    def schema(self) -> dict:
        """JSON schema for parameters. Used in LLM function-calling."""
        pass

@dataclass
class ToolResult:
    success: bool
    output: str
    side_effects: list[str]   # Human-readable list of what changed
```

```python
# tools/registry.py
class ToolRegistry:
    """Discovers and manages available tools."""
    def __init__(self):
        self.tools: dict[str, Tool] = {}

    def register(self, tool: Tool):
        self.tools[tool.name] = tool

    def get_tool_descriptions(self) -> str:
        """Returns formatted tool descriptions for injection into LLM prompts."""

    def get_night_tools(self) -> list[Tool]:
        """Returns only tools safe for autonomous night execution."""

    async def execute(self, tool_name: str, params: dict) -> ToolResult:
        tool = self.tools[tool_name]
        if tool.requires_approval and not self._is_approved(tool_name, params):
            return ToolResult(success=False, output="Awaiting user approval", side_effects=[])
        result = await tool.execute(params)
        logger.info(f"Tool executed: {tool_name}", params=params, result=result)
        return result
```

**Phase 1 tools:**

| Tool | Description | Approval | Night |
|---|---|---|---|
| `jira_comment` | Post a comment on a Jira ticket | No | Yes |
| `jira_transition` | Move a ticket to a new status | Yes | No |
| `notify` | Send push notification via ntfy.sh | No | Yes |
| `file_write` | Write to `~/virgil-output/` | No | Yes |
| `shell` | Run allowlisted commands only | Yes | No |
| `web_fetch` | Fetch a URL, return text summary | No | Yes |

**Security model:**
- Shell commands are restricted to `ALLOWED_SHELL_COMMANDS` in config. Any command not on the list is rejected before execution.
- File writes are restricted to a single output directory. Path traversal is blocked.
- Tools that modify external state (Jira transitions, shell) require user approval by default. Approval is a flag in the chat UI that the user can toggle.
- All tool executions are logged with full parameters and results.
- Night mode only runs tools where `allowed_in_night=True`.

### 5. Night Mode (`core/night.py`)

The autonomous work window. Configurable via `NIGHT_WINDOW_START` / `NIGHT_WINDOW_END`.

```python
class NightController:
    """
    During the night window, Virgil shifts from reactive to proactive.
    Instead of waiting for events, it pulls from a task queue of deferred work.
    Runs on a separate budget allocation (GEMINI_NIGHT_BUDGET_USD).
    """
    async def start(self, event_queue: asyncio.Queue):
        while True:
            if self._is_night_window():
                await self._run_night_cycle(event_queue)
            await asyncio.sleep(60)  # Check every minute

    async def _run_night_cycle(self, event_queue: asyncio.Queue):
        """Execute night tasks in priority order. Stop if budget exhausted."""
        tasks = self._get_night_tasks()
        for task in tasks:
            if not self.budget.can_afford_night():
                logger.info("Night budget exhausted, stopping night cycle")
                break
            event = VirgilEvent(
                source="night",
                event_type="night_task",
                payload={"task_type": task.type, "task_data": task.data},
                timestamp=datetime.now(),
                priority=task.priority,
            )
            event_queue.put_nowait(event)
            await asyncio.sleep(5)  # Pace night work to avoid API rate limits
```

**Night task types (priority order):**

1. **Pre-compute tomorrow's briefing.** Pull calendar and Jira data, generate the briefing text, cache it. When the morning briefing fires, it serves the cached version instantly at $0.

2. **Self-evaluation.** Review the day's decision traces. Compute:
   - Nudge hit rate (nudges acted on / nudges generated)
   - Inference routing accuracy (how often did flash suffice vs. how often was pro needed)
   - Wasted API calls (calls that produced no user-visible output)
   - Tool execution success rate
   Write a daily eval report to memory (category: "self_eval", weight: 0.6, decay: 0.02/day). Over time, this data feeds back into routing heuristics and nudge scoring.

3. **Memory consolidation.** Run the decay function, then:
   - Identify memories accessed frequently but low-weighted → promote
   - Identify high-weighted memories never accessed → flag for demotion
   - Identify duplicate/overlapping memories → merge candidates (use flash model to detect)
   - Prune memories below threshold weight
   Write a consolidation report to traces.

4. **Stale project scan.** Check all `project` category memories for last activity date. If >7 days stale, generate a candidate nudge for morning delivery.

5. **Research tasks.** Process any research requests queued during the day (e.g., "Virgil, look into X when you have time"). Use `web_fetch` tool + flash model to summarize findings. Store results in memory and queue a morning nudge with the summary.

6. **Skill health check.** Verify all loaded skills are functional (call their `health_check()` if implemented). Log failures.

All night tasks must be idempotent. If the process crashes at 3am and restarts, re-running the same tasks produces the same result without corruption.

### 6. Skills/Plugin System (`skills/`)

Modular capabilities that can be added without modifying core code.

```python
# skills/base.py
class Skill(ABC):
    name: str
    description: str
    version: str
    triggers: list[str]       # Event types this skill handles

    @abstractmethod
    async def handle(self, event: VirgilEvent, context: dict) -> SkillResult:
        """Process an event. Return result or None if not applicable."""
        pass

    def health_check(self) -> bool:
        """Optional. Return True if skill is functional."""
        return True

@dataclass
class SkillResult:
    handled: bool             # Did this skill handle the event?
    response: str | None      # Text response if any
    tool_calls: list[dict]    # Tool calls to execute
    memory_writes: list[dict] # Memories to store
```

Each skill is a directory:
```
skills/
└── my_skill/
    ├── SKILL.md              # Manifest: name, description, triggers, config
    ├── skill.py              # Implements Skill interface
    └── config.yaml           # Optional skill-specific config
```

```python
# skills/loader.py
class SkillLoader:
    """Discovers and loads skills from SKILLS_DIRECTORIES."""
    def load_all(self) -> list[Skill]:
        # Walk directories, find SKILL.md + skill.py pairs
        # Import dynamically, validate interface, register
        # Catch and log errors per-skill — a broken skill never crashes the core

    def match(self, event: VirgilEvent) -> list[Skill]:
        """Return skills whose triggers match this event type."""
```

The orchestrator checks skills *after* its own handling. If a skill matches, it runs and can contribute additional responses, tool calls, or memory writes. Skills are isolated — they run in try/except and a failure is logged but never propagated.

**No built-in skills in Phase 1.** Ship the framework and loader. Skills get created as specific use cases emerge. The point is the architecture exists so capabilities can be added without touching core code.

### 7. Inference Router (`inference/router.py`)

Same as previous version. Routes to flash or pro model within Gemini API. Budget tracker enforces $75/month with $25/month carved out for night mode.

Budget tracking now includes:
- Daytime budget: `GEMINI_MONTHLY_BUDGET_USD - GEMINI_NIGHT_BUDGET_USD` = $50/month
- Night budget: `GEMINI_NIGHT_BUDGET_USD` = $25/month
- Daily soft limits: ~$1.67/day daytime, ~$0.83/day night
- If daytime budget exhausted: degrade to flash-only, then quiet mode
- If night budget exhausted: skip remaining night tasks, resume next night

### 8. Memory Layer (`memory/`)

Same three-tier architecture (L1/L2/L3) as previous version. Additions:

New memory categories for night mode:
- `self_eval` (daily evaluation reports): weight 0.6, decay 0.02/day
- `research` (night research results): weight 0.5, decay 0.03/day
- `skill_data` (skill-generated memories): weight varies by skill

Memory consolidation API:
```python
class MemoryManager:
    # ... existing methods ...

    async def consolidate(self) -> ConsolidationReport:
        """Night mode memory maintenance."""
        promoted = await self._promote_underweighted()
        flagged = await self._flag_unused_high_weight()
        merged = await self._merge_duplicates()   # Uses flash model
        pruned = await self._prune_below_threshold(threshold=0.1)
        return ConsolidationReport(promoted, flagged, merged, pruned)
```

### 9. Ingestion, Actions, Persona

Same as previous version. No changes to ingestion sources, briefing/nudge actions, or persona enforcement.

One addition to briefing: check for pre-computed night briefing in cache before generating a new one.

One addition to nudges: morning delivery of night-generated nudges (stale project alerts, research summaries).

### 10. API Server (`api/`)

FastAPI on port 8741. Same endpoints as previous version plus:

- `POST /chat` — Chat with streaming SSE. **This is what the Next.js frontend calls.**
- `GET /status` — Health, budgets, ingestion status, skill status, night mode status.
- `GET /budget` — Detailed cost breakdown.
- `GET /memory` — Memory inspection.
- `POST /memory` — Manual memory write.
- `POST /trigger/{action}` — Manual trigger.
- `GET /traces` — Decision traces.
- `GET /tools` — List registered tools and their status.
- `POST /tools/{name}/approve` — Approve a pending tool execution.
- `GET /skills` — List loaded skills and their health.
- `GET /night/report` — Last night's evaluation and consolidation reports.

**CORS:** Allow the Vercel frontend origin. Configure via `FRONTEND_ORIGIN` env var.

**Auth:** For Phase 1, use a shared API key (`API_SECRET` in config) passed as a Bearer token. The Next.js frontend stores this. No public access.

### 11. Frontend Integration

The existing Next.js app at `clbchldrs-dev/virgil` needs a thin adapter layer to talk to the Python backend instead of (or in addition to) Ollama directly.

**Do not modify the Next.js repo in this Cursor prompt.** Document the API contract here so the frontend can be updated separately:

- Backend URL: `https://{tailscale-hostname}:8741` or via Cloudflare Tunnel
- Auth: `Authorization: Bearer {API_SECRET}`
- Chat: `POST /chat` with `{ "message": "...", "conversation_id": "..." }`, response is SSE stream
- Tool approvals surface in the chat UI as interactive elements (future frontend work)

The Python backend is the source of truth for memory, inference, and tools. The Next.js frontend is a UI layer only.

### 12. Observability (`observability/`)

Same as previous version. Decision traces now include tool invocations:

```json
{
  "timestamp": "2026-04-02T02:30:00Z",
  "trigger": {"source": "night", "type": "night_task"},
  "task_type": "self_evaluation",
  "model": "gemini-2.0-flash",
  "tier": "fast",
  "tokens_used": 1247,
  "estimated_cost_usd": 0.0005,
  "tools_invoked": [],
  "action": "memory_write",
  "output_summary": "Daily eval: 3/5 nudges acted on, 0 wasted calls, flash sufficient 94% of time",
  "latency_ms": 1840
}
```

Night mode produces a structured daily report accessible via `/night/report`.

---

## Implementation Order

Build and test in this exact order. Each step should be a working, testable increment. **Run the AGENTS.md handoff checklist at the start of every Cursor session.**

1. **Config + project scaffold + AGENTS.md.** `pyproject.toml`, `.env.example`, `AGENTS.md` at root. Verify Python 3.11+ on Ubuntu box.
2. **Gemini client + inference router.** Verify flash and pro calls work. Budget tracker stub.
3. **Memory layer.** SQLite schema, L1/L2, FTS5 search. Mem0 stub. Tests.
4. **Persona.** `persona.md` + `mask.py`. Verify persona prepended to all calls.
5. **API server.** FastAPI with `/chat` endpoint. Minimal fallback HTML UI for testing (the real UI is the Next.js app). CORS configured for frontend origin.
6. **Event loop + orchestrator.** Event queue wired up. Orchestrator handles `user_message` events. Decision traces logged.
7. **Budget tracking.** Full `budget.py`. Daytime and night budget split. Exposed via `/budget`.
8. **Tool framework.** `base.py`, `registry.py`. Register a single test tool (`notify` — send a push via ntfy.sh). Verify orchestrator can invoke tools via ReAct loop.
9. **Core tools.** `jira_comment`, `file_write`, `web_fetch`, `shell` (sandboxed). Tests for each. Permission model enforced.
10. **Scheduler.** Briefing and nudge scheduling. Placeholder output initially.
11. **Ingestion: filesystem watcher.** Drop `.md`, see it ingested.
12. **Ingestion: Jira.** Poll, ingest tickets. Verify in briefing.
13. **Ingestion: Google Calendar.** Poll or webhook. Verify in briefing.
14. **Briefing action.** Real context, flash model, < $0.01/briefing.
15. **Nudge action.** Pure Python detection, Gemini phrasing. Tool-enhanced: nudge can include a "suggested action" that Virgil executes on approval.
16. **Skills framework.** `loader.py`, `base.py`, skill directory structure. Load and run a test skill. Verify isolation (broken skill doesn't crash core).
17. **Night mode.** `night.py` with configurable window. Implement tasks in order: pre-compute briefing → self-evaluation → memory consolidation → stale project scan → research queue.
18. **Observability.** Full traces, metrics, `/status`, `/night/report`. Nudge feedback in UI.
19. **Mem0 integration.** Wire L3, budget tracking, write-through, read-on-miss.
20. **Frontend integration docs.** Document the full API contract for the Next.js frontend adapter.

---

## Dependencies

```toml
[project]
name = "virgil"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "httpx>=0.27",
    "aiosqlite>=0.20",
    "pydantic-settings>=2.5",
    "watchdog>=4.0",
    "sse-starlette>=2.0",
    "google-api-python-client",
    "google-auth-oauthlib",
    "google-genai",
    "mem0ai",
    "structlog",
    "pyyaml",                    # Skill config files
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio", "ruff"]
```

---

## Key Constraints

- **No swarm, no sub-agents, no parallelism in Phase 1.** One agent, one loop.
- **Cloud-dependent inference with local resilience.** If Gemini is down, Virgil continues ingesting and updating memory. Queues pending actions for when API returns.
- **Gemini budget: $75/month hard cap.** $50 daytime, $25 night. Budget tracker enforces. Degrade to flash → quiet mode when exhausted.
- **Mem0 budget: 800 API calls/week max.** Local cache first. Write-through. Read-on-miss.
- **Minimize inference calls.** Detection logic in Python. Gemini only for phrasing and reasoning.
- **Tools are sandboxed.** No unrestricted shell. Allowlisted commands. Restricted file paths. Approval gates on destructive actions.
- **Night mode is idempotent.** Crash-safe. Re-runnable. No corruption risk.
- **Skills are isolated.** A broken skill cannot crash the core loop. Errors are caught and logged.
- **Persona is sacred.** Every response passes through the mask.
- **Log everything.** Every decision, tool call, dollar spent, memory access.
- **AGENTS.md is the handoff.** Every new Cursor session starts by reading it.

---

## What Phase 2 Looks Like (Do Not Build Yet)

- **tiiny.ai migration (August 2026):** `local_client.py` implementing `InferenceClient`. Router prefers local for fast tier. Budget drops toward $0/month.
- **Sub-agents:** Each action type becomes an independent agent.
- **Parallel execution:** Task queue (Celery/BullMQ) for concurrent agent work.
- **Tool approval UI:** Interactive tool approval in the Next.js chat interface.
- **Mobile push refinement:** Rich notifications with action buttons (approve/reject tool calls from phone).
- **Self-modifying skills:** Virgil can create new skills during night mode based on patterns it detects in usage. Human review required before activation.
- **Heavy local inference:** 70B+ models on tiiny.ai for the heavy tier. Gemini becomes emergency-only.
