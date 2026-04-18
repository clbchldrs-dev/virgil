# Virgil v2.1 — Architecture Plan

> Status: PLANNED — Not in development. Target: June 2026. Primary hardware (Mac Mini M4 Pro) is resolved.
> This document is the single source of truth for v2 design decisions.
> See docs/V2_MIGRATION.md for how v1 transitions to v2.

**Behavioral domain (SPEC):** Goals/habits, project graph, weekly schedule proposals, and morning briefing payload are specified in [docs/V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md). HTTP route sketches: [docs/V2_BEHAVIORAL_API.md](V2_BEHAVIORAL_API.md). Not implemented until the Python backend ships these modules.

**LLM Wiki storage (2026-04-18 ADR):** Durable **LLM Wiki** retrieval targets **operator-controlled Postgres** with **`pgvector`** and **`tsvector`** — see [DECISIONS.md](DECISIONS.md). **Honcho** self-host expects **Postgres + pgvector**; whether wiki tables and Honcho share one database is **TBD at integration**. For durable background work, prefer **Hermes scheduling**, then a **Postgres queue (`FOR UPDATE SKIP LOCKED`)**, before **Temporal**. The SQLite / FTS5 sketch in §8 and the implementation order below describe one v2 implementation path; converge wiki persistence with this ADR when the Hermes-first stack lands.

---

# Virgil v2.1 — Cursor Implementation Prompt

## Context

Virgil is a proactive personal AI assistant built for a single user (Caleb). It ingests context from calendar, task management, and manual input, surfaces actionable nudges before the user asks, and can execute tasks autonomously. The personality is stoic, reserved, and direct — it does work quietly and presents results, not process. For **shipped v1** voice and product intent, prefer [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md) and (when completed) [VIRGIL_PERSONA.md](VIRGIL_PERSONA.md) over this prompt’s shorthand.

**Hardware reality:**
- **Primary host (now):** Mac Mini M4 Pro — 48GB unified memory, 2TB SSD, 12-core CPU, 16-core GPU, 273 GB/s memory bandwidth. Runs the Python backend (event loop, API server, memory layer, ingestion workers, tool execution, night mode scheduler) AND local inference via Ollama. Single box. Always-on. ~30W.
- **Frontend (now):** Existing Next.js app deployed on Vercel (from the `clbchldrs-dev/virgil` repo). Chat UI with auth, shadcn/ui components, Vercel AI SDK. The Python backend is headless — the Next.js frontend is the user-facing interface.
- **Inference — fast tier (now):** Local Ollama on Mac Mini. Default models: `qwen2.5:14b` (fast, ~30 tok/s) and `qwen2.5:32b` (heavier, ~15-20 tok/s). Handles 80-90% of all inference calls at $0 cost.
- **Inference — heavy tier (now):** Gemini API via Google AI Studio. `gemini-2.5-pro` for complex reasoning. Reduced budget (~$25-30/month) since fast tier is local.
- **Inference — Phase 2 (August 2026+):** tiiny.ai Pocket Lab (80GB LPDDR5X, 190 TOPS NPU) takes over heavy local tier. 70B+ models. Gemini becomes emergency-only fallback. Mac Mini continues as services host + fast tier.

The Mac Mini and Vercel frontend connect over Tailscale (or Cloudflare Tunnel). The Python backend exposes a REST/SSE API that the Next.js frontend consumes.

## What to Build

A Python-based agentic backend that runs as a background service on the Mac Mini. It:
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
│   │   ├── router.py         # Routes to local-fast, local-heavy, or gemini-heavy
│   │   ├── base.py           # Abstract inference client interface
│   │   ├── local_client.py   # Ollama client (httpx → localhost:11434)
│   │   ├── gemini_client.py  # Gemini API client
│   │   └── budget.py         # API cost tracking (Gemini only — local is free)
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

Virgil's Python backend. Headless agentic service running on a Mac Mini M4 Pro (48GB, 2TB).
The Next.js frontend (separate repo) talks to this over Tailscale/Tunnel.
Local inference via Ollama handles 80-90% of calls. Gemini API for complex reasoning only.

## North Star

Make Virgil as useful as possible using local inference (Ollama on Mac Mini) as the default,
with Gemini as a paid escalation path for complex reasoning. Advisor + executor, not just a chatbot.
Proactivity is free — don't ration it.

## Rules

1. Every GEMINI call costs money. Local inference is free. Default to local.
   If you can solve it locally or in Python, do. Escalate to Gemini only for
   tasks that demonstrably require frontier reasoning.
2. Tools must be sandboxed. No unrestricted shell access. Allowlisted commands only.
3. Night mode work must be idempotent — if it crashes at 3am, nothing is corrupted.
4. Skills are isolated. A broken skill cannot crash the core loop.
5. Log every decision, every tool invocation, every Gemini dollar spent.
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
GEMINI_HEAVY_MODEL=gemini-2.5-pro
GEMINI_MONTHLY_BUDGET_USD=30.00
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_FAST_MODEL=qwen2.5:14b
OLLAMA_HEAVY_MODEL=qwen2.5:32b
MEM0_API_KEY=
MEM0_USER_ID=caleb
GOOGLE_CALENDAR_CREDENTIALS_PATH=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_PROJECT_KEY=DAMC
WATCH_DIRECTORIES=/Users/caleb/virgil-drops
SKILLS_DIRECTORIES=/Users/caleb/virgil/skills
TAILSCALE_ENABLED=false
BRIEFING_TIME=07:30
NUDGE_INTERVAL_MINUTES=60
NIGHT_WINDOW_START=23:00
NIGHT_WINDOW_END=07:00
NTFY_TOPIC=virgil-caleb
NTFY_SERVER=https://ntfy.sh
LOG_LEVEL=INFO
INFERENCE_PROVIDER=hybrid
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
- **Local fast (Ollama, 14B):** Event classification, memory operations, nudge phrasing, tool selection, briefing generation, simple Q&A, night mode routine tasks. ~30 tok/s. $0.
- **Local heavy (Ollama, 32B):** More nuanced reasoning that doesn't warrant a Gemini call. Draft review, multi-factor classification, research summarization. ~15-20 tok/s. $0.
- **Cloud heavy (Gemini 2.5 Pro):** Multi-step planning, novel problem solving, tasks requiring frontier-model intelligence. Only when local models are insufficient. Budget-tracked.
- **Cloud fast fallback (Gemini 2.0 Flash):** Fallback if Ollama is unresponsive. Not the default path.

Routing decision: The orchestrator defaults to local. It escalates to Gemini only when:
1. The task is explicitly tagged as complex (multi-step planning, novel problems)
2. The local model's response fails a confidence/quality check
3. The user explicitly requests it

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
| `home_assistant` | Read sensors, control devices via Home Assistant REST API | **Yes** — device control is mutating | No (until scoped) |
| `file_write` | Write to `~/virgil-output/` | No | Yes |
| `shell` | Run allowlisted commands only | Yes | No |
| `web_fetch` | Fetch a URL, return text summary | No | Yes |

*Inventory note:* `home_assistant` aligns with **Phase 2** Home Assistant contact surfaces in [V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md); it is listed here for the permission model (approval + night gating), not as a day-one Phase 1 ship item.

**Security model:**
- Shell commands are restricted to `ALLOWED_SHELL_COMMANDS` in config. Any command not on the list is rejected before execution.
- File writes are restricted to a single output directory. Path traversal is blocked.
- Tools that modify external state (Jira transitions, shell) require user approval by default. Approval is a flag in the chat UI that the user can toggle.
- All tool executions are logged with full parameters and results.
- Night mode only runs tools where `allowed_in_night=True`.

### 5. Night Mode (`core/night.py`)

The autonomous work window. Configurable via `NIGHT_WINDOW_START` / `NIGHT_WINDOW_END`.

Night mode runs entirely on local Ollama models. No API budget allocation needed.
All night tasks (briefing pre-compute, self-evaluation, memory consolidation,
stale project scan, research) use the local heavy model (32B).
This means night mode can be as aggressive as needed — no cost constraint.

```python
class NightController:
    """
    During the night window, Virgil shifts from reactive to proactive.
    Instead of waiting for events, it pulls from a task queue of deferred work.
    Runs entirely on local Ollama models — no API cost.
    """
    async def start(self, event_queue: asyncio.Queue):
        while True:
            if self._is_night_window():
                await self._run_night_cycle(event_queue)
            await asyncio.sleep(60)  # Check every minute

    async def _run_night_cycle(self, event_queue: asyncio.Queue):
        """Execute night tasks in priority order using local inference."""
        tasks = self._get_night_tasks()
        for task in tasks:
            event = VirgilEvent(
                source="night",
                event_type="night_task",
                payload={"task_type": task.type, "task_data": task.data},
                timestamp=datetime.now(),
                priority=task.priority,
            )
            event_queue.put_nowait(event)
            await asyncio.sleep(5)  # Pace night work to avoid hammering Ollama
```

**Night task types (priority order):**

1. **Pre-compute tomorrow's briefing.** Pull calendar and Jira data, generate the briefing text, cache it. When the morning briefing fires, it serves the cached version instantly at $0.

2. **Self-evaluation.** Review the day's decision traces. Compute:
   - Nudge hit rate (nudges acted on / nudges generated)
   - Inference routing accuracy (how often did local suffice vs. how often was Gemini needed)
   - Wasted Gemini calls (calls that produced no user-visible output or could have been handled locally)
   - Tool execution success rate
   Write a daily eval report to memory (category: "self_eval", weight: 0.6, decay: 0.02/day). Over time, this data feeds back into routing heuristics and nudge scoring.

3. **Memory consolidation.** Run the decay function, then:
   - Identify memories accessed frequently but low-weighted → promote
   - Identify high-weighted memories never accessed → flag for demotion
   - Identify duplicate/overlapping memories → merge candidates (use local fast model to detect)
   - Prune memories below threshold weight
   Write a consolidation report to traces.

4. **Stale project scan.** Check all `project` category memories for last activity date. If >7 days stale, generate a candidate nudge for morning delivery.

5. **Research tasks.** Process any research requests queued during the day (e.g., "Virgil, look into X when you have time"). Use `web_fetch` tool + local heavy model (32B) to summarize findings. Store results in memory and queue a morning nudge with the summary.

6. **Skill health check.** Verify all loaded skills are functional (call their `health_check()` if implemented). Log failures.

All night tasks must be idempotent. If the process crashes at 3am and restarts, re-running the same tasks produces the same result without corruption.

**Behavioral features (planned):** When implemented, night mode also runs streak evaluation for habits, staleness evaluation for projects (see [V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md)), generates ntfy alerts, and assembles the structured morning briefing payload. Weekly schedule proposal generation is part of the same document.

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

Routes to local-fast (Ollama 14B), local-heavy (Ollama 32B), or cloud-heavy (Gemini 2.5 Pro). Defaults to local. Escalates to Gemini only when local is insufficient or unavailable.

Budget tracking:
- Local inference: unmetered, no tracking needed
- Gemini monthly budget: $30/month soft target (most calls are local now)
- Gemini night budget: $0 (night mode runs entirely on local models)
- Daily Gemini soft limit: ~$1/day
- If Gemini budget exhausted: no degradation — local models handle everything, heavy reasoning quality drops but Virgil never goes quiet
- Budget tracker only counts Gemini API calls. Local inference is free and unlimited.

Fallback behavior:
- If Ollama is unresponsive: fast tier degrades to Gemini 2.0 Flash
- If Gemini is down: heavy tier degrades to the best local model available (32B)
- Virgil never goes fully silent

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
        merged = await self._merge_duplicates()   # Uses local fast model
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

**Behavioral REST routes (planned):** Goals, projects, and schedule endpoints are specified in [V2_BEHAVIORAL_API.md](V2_BEHAVIORAL_API.md) and [V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md). They are a companion surface to chat — see [V2_API_CONTRACT.md](V2_API_CONTRACT.md) for `POST /chat` parity.

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
  "model": "qwen2.5:14b",
  "tier": "local-fast",
  "tokens_used": 1247,
  "estimated_cost_usd": 0.0,
  "tools_invoked": [],
  "action": "memory_write",
  "output_summary": "Daily eval: 3/5 nudges acted on, 0 wasted Gemini calls, local sufficient 94% of time",
  "latency_ms": 1840
}
```

Night mode produces a structured daily report accessible via `/night/report`.

---

## Implementation Order

Build and test in this exact order. Each step should be a working, testable increment. **Run the AGENTS.md handoff checklist at the start of every Cursor session.**

1. **Config + project scaffold + AGENTS.md.** `pyproject.toml`, `.env.example`, `AGENTS.md` at root. Verify Python 3.11+ on Mac Mini.
2. **Inference clients + router.** Implement `local_client.py` (Ollama via httpx to localhost:11434) and `gemini_client.py`. Router defaults to local, escalates to Gemini for complex tasks. Verify both fast and heavy local models respond. Verify Gemini fallback works when Ollama is stopped. Budget tracker for Gemini calls only.
3. **Memory layer.** SQLite schema, L1/L2, FTS5 search. Mem0 stub. Tests.
4. **Persona.** `persona.md` + `mask.py`. Verify persona prepended to all calls.
5. **API server.** FastAPI with `/chat` endpoint. Minimal fallback HTML UI for testing (the real UI is the Next.js app). CORS configured for frontend origin.
6. **Event loop + orchestrator.** Event queue wired up. Orchestrator handles `user_message` events. Decision traces logged.
7. **Budget tracking.** Full `budget.py`. Gemini-only cost tracking (local is unmetered). Exposed via `/budget`.
8. **Tool framework.** `base.py`, `registry.py`. Register a single test tool (`notify` — send a push via ntfy.sh). Verify orchestrator can invoke tools via ReAct loop.
9. **Core tools.** `jira_comment`, `file_write`, `web_fetch`, `shell` (sandboxed). Tests for each. Permission model enforced.
10. **Scheduler.** Briefing and nudge scheduling. Placeholder output initially.
11. **Ingestion: filesystem watcher.** Drop `.md`, see it ingested.
12. **Ingestion: Jira.** Poll, ingest tickets. Verify in briefing.
13. **Ingestion: Google Calendar.** Poll or webhook. Verify in briefing.
14. **Briefing action.** Real context, local fast model. $0/briefing.
15. **Nudge action.** Pure Python detection, local model phrasing. Tool-enhanced: nudge can include a "suggested action" that Virgil executes on approval.
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
    "httpx>=0.27",                # Also used for Ollama REST API client
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
- **Local-first inference with cloud escalation.** Default to local Ollama. Escalate to Gemini only when the task requires frontier reasoning. When in doubt, use local.
- **Gemini budget: $30/month soft cap.** Night mode is fully local. Budget tracker enforces. If Gemini budget exhausted, local models handle everything — heavy reasoning quality drops but Virgil never goes quiet.
- **Mem0 budget: 800 API calls/week max.** Local cache first. Write-through. Read-on-miss.
- **Minimize Gemini calls.** Detection logic in Python. Local models for phrasing and classification. Gemini only for complex reasoning.
- **Tools are sandboxed.** No unrestricted shell. Allowlisted commands. Restricted file paths. Approval gates on destructive actions.
- **Night mode is idempotent.** Crash-safe. Re-runnable. No corruption risk. Runs entirely on local models — no cost constraint.
- **Skills are isolated.** A broken skill cannot crash the core loop. Errors are caught and logged.
- **Persona is sacred.** Every response passes through the mask.
- **Log everything.** Every decision, tool call, Gemini dollar spent, memory access.
- **AGENTS.md is the handoff.** Every new Cursor session starts by reading it.

---

## What Phase 2 Looks Like (Do Not Build Yet)

- **tiiny.ai migration (August 2026+):** `tiiny_client.py` implementing `InferenceClient`. Router shifts heavy-local tier from Mac Mini Ollama (32B) to Pocket Lab (70B+). Mac Mini continues as always-on services host and fast tier (14B). Gemini drops to emergency-only fallback. Monthly API spend approaches $0. Two-device architecture: Mac Mini (services + fast inference) <-> Pocket Lab (heavy inference). Devices communicate over Tailscale mesh or local network.
- **Sub-agents:** Each action type becomes an independent agent.
- **Parallel execution:** Task queue (Celery/BullMQ) for concurrent agent work.
- **Tool approval UI:** Interactive tool approval in the Next.js chat interface.
- **Mobile push refinement:** Rich notifications with action buttons (approve/reject tool calls from phone).
- **Self-modifying skills:** Virgil can create new skills during night mode based on patterns it detects in usage. Human review required before activation.

**Device surface tools (Phase 2–3):** `ha_sensor_read` (read HA entity states as context — e.g., presence, temperature), `ha_device_control` (set scenes, lights, locks — requires approval), `tts_cast` (send TTS audio to a named speaker via pychromecast), `dashboard_push` (update a named dashboard widget — e.g., goal progress card). Voice input (`stt_listen`) is Phase 3 and requires a separate STT service (local Whisper or cloud).
