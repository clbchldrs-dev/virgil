# Virgil v2 — Behavioral Feature Specs

**Status:** SPEC — Not in development. These features target the v2 Python backend on the Mac Mini.

**Prerequisites:** v2 core loop, memory layer (L1/L2/L3), inference router, Google Calendar API, ntfy integration.

**Related:** [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) (runtime layout), [V2_BEHAVIORAL_API.md](V2_BEHAVIORAL_API.md) (HTTP route sketch), [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md) and [VIRGIL_PERSONA.md](VIRGIL_PERSONA.md) (voice for interventions).

---

## 1. Goal and Habit Tracker with Streak Detection

### Intent

Track recurring commitments and long-term goals. Detect when streaks break or habits slip. Surface interventions via ntfy push notifications before patterns become entrenched. This is not a to-do list — it is a behavioral feedback loop.

### Data model

**`goals` table (Postgres / SQLite L2)**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `name` | TEXT | e.g. "Six-pack abs" |
| `type` | ENUM | `habit` \| `goal` |
| `cadence` | TEXT \| NULL | `daily` \| `weekly:3` \| NULL (goals have no cadence) |
| `active` | BOOLEAN | default true |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**`goal_entries` table**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `goal_id` | FK → goals.id | |
| `date` | DATE | |
| `completed` | BOOLEAN | |
| `note` | TEXT \| NULL | optional context ("skipped — knee pain") |
| `source` | TEXT | `manual` \| `inferred` \| `calendar` |
| `created_at` | TIMESTAMP | |

**`goal_dependencies` table**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `parent_goal_id` | FK → goals.id | e.g. "Six-pack abs" |
| `child_goal_id` | FK → goals.id | e.g. "Fix sleep schedule" |
| `relationship` | TEXT | `requires` \| `supports` |

### Seed data (owner commitments)

**Habits (recurring):**

- 750-word journaling — daily
- Python study (Coddy.tech) — daily
- BJJ/Muay Thai training — `weekly:4` (4x per week target)
- Morning strength training — daily (contingent on sleep schedule)
- Reduce YouTube/Shorts binge — daily (inverse habit: flag if exceeded threshold)

**Goals (milestone-based):**

- Six-pack abs → depends on: fix sleep schedule, morning strength training, nutrition tracking
- Handstand pushups or backflip → depends on: BJJ/Muay Thai consistency, morning strength
- Natalie's LLC (GA Articles of Organization, EIN, Google Business Profile) — discrete steps, no cadence
- Early retirement / solopreneur pivot (~5-year horizon) — meta-goal, decompose later
- natchildersart.com stable — Turso migration, re-upload gallery images

### Streak logic

```python
def evaluate_streak(goal_id: str, window_days: int = 7) -> StreakStatus:
    """
    For daily habits:
      - streak_length: consecutive days completed (current streak)
      - longest_streak: all-time max
      - missed_recently: count of misses in last `window_days`
      - trend: "rising" | "stable" | "declining" (compare last 7d vs prior 7d)

    For weekly:N habits (e.g. weekly:4):
      - current_week_count: completions this Mon-Sun
      - on_pace: bool (current_week_count >= expected_by_today)
      - weekly_average_30d: rolling 4-week average

    Returns StreakStatus with alert_level:
      - "green": on track
      - "yellow": 1 miss in last 3 days (daily) or behind pace (weekly)
      - "red": 2+ misses in last 3 days or 3+ day gap
    """
```

### Intervention rules

| Alert level | Action |
|-------------|--------|
| **yellow** | ntfy push: neutral tone, observation only. Example: "Python practice: last completed 2 days ago." |
| **red** | ntfy push: direct, includes context if available. Example: "Journaling streak broken — 3 days. Last note: 'too tired.' Want to do a 5-minute version tonight?" |
| **red + dependency** | ntfy push: connects to parent goal. Example: "Morning training skipped 4 of last 7 days. This blocks the abs goal. Sleep data shows avg bedtime 1:30am — that's the bottleneck." |

### Inverse habit: YouTube/Shorts

Reduction target, not completion. Tracking options (priority order):

1. **Manual check-in** — Virgil asks via ntfy at 9pm: "How much YouTube today?" Owner replies with rough estimate. Low friction, high compliance risk.
2. **Screen Time API** — If iOS Screen Time sharing or exports are enabled, ingest. More accurate, requires setup.
3. **Calendar inference** — Large unscheduled evening gaps with no other activity logged → potential binge window. Heuristic, not definitive.

Start with option 1; upgrade later.

### Entry sources

- **Manual:** Owner says "I did my journaling" via chat or quick mobile input.
- **Inferred:** Signals — e.g. journal file modified today (filesystem), Google Calendar shows BJJ class → mark training complete.
- **Prompted:** End-of-day check-in (configurable, default 9pm) via ntfy for habits not yet logged.

### Morning briefing integration

Morning briefing (played from phone) includes a streak summary, e.g.:

- "Day 12 of journaling. Python on a 3-day streak. Training: 3 of 4 this week, on pace."
- If red: "Heads up — morning training has dropped off. 2 of last 7 days."

### Night mode responsibilities

- Run `evaluate_streak()` for all active habits.
- Generate alerts for yellow/red items.
- Update dependency-aware alerts (child goal red → parent impact).
- Write streak summary to morning briefing payload.
- Compact old entries (\>90 days) into weekly aggregates in L3 (mem0/Supabase).

---

## 2. Project Graph with Staleness Detection

### Intent

Maintain a lightweight project tracker that Virgil actively monitors. Not a full PM tool — a state-aware graph that answers: what is active, what is stuck, what needs attention, and what is the next concrete action? Night mode scans nightly and surfaces stale items.

### Data model

**`projects` table (Postgres / SQLite L2)**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `name` | TEXT | e.g. "natchildersart.com" |
| `status` | ENUM | `active` \| `blocked` \| `paused` \| `done` |
| `blocked_on` | TEXT \| NULL | freeform: "Vesper data", "manager feedback" |
| `blocked_on_whom` | TEXT \| NULL | `self` \| `natalie` \| `manager` \| `external` |
| `priority` | ENUM | `high` \| `medium` \| `low` |
| `last_touched` | TIMESTAMP | updated on any action or note |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**`project_actions` table**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `project_id` | FK → projects.id | |
| `action` | TEXT | "Next: file GA Articles of Organization" |
| `status` | ENUM | `pending` \| `in_progress` \| `done` \| `skipped` |
| `due_date` | DATE \| NULL | |
| `created_at` | TIMESTAMP | |
| `completed_at` | TIMESTAMP \| NULL | |

**`project_notes` table**

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID, PK | |
| `project_id` | FK → projects.id | |
| `note` | TEXT | |
| `source` | TEXT | `manual` \| `night_review` \| `jira_sync` |
| `created_at` | TIMESTAMP | |

### Seed data

| Project | Status | Priority | Blocked on | Next action |
|---------|--------|----------|------------|-------------|
| DAMC-233 (Legacy Pricing Change) | blocked | high | Manager feedback on v5 | Send follow-up Slack message |
| DAMC-182 (Segmentation Tutorial) | blocked | medium | Vesper data | Check Vesper status |
| natchildersart.com | active | medium | — | Turso migration |
| Natalie's LLC | active | medium | — | File GA Articles of Organization |
| Virgil v2 | active | high | — | Finalize behavioral specs |
| OpenClaw integration | paused | low | Virgil phases 1-3 | Resume after Virgil v2 core |

### Staleness rules

```python
def evaluate_staleness(project: Project) -> StalenessStatus:
    """
    Staleness is based on:
      1. Time since last_touched
      2. Project status (blocked projects have different thresholds)
      3. Priority weighting

    Thresholds:
      - active + high priority:   stale after 3 days untouched
      - active + medium priority: stale after 7 days untouched
      - active + low priority:    stale after 14 days untouched
      - blocked (any priority):   stale after 7 days (the blocker itself is stale)
      - paused:                   no staleness alerts

    Returns StalenessStatus:
      - "fresh": within threshold
      - "aging": within 1 day of threshold
      - "stale": past threshold
      - "abandoned": 2x past threshold (escalated alert)
    """
```

### Blocker escalation

When a project is blocked:

- **Day 0-3:** No action (normal wait time).
- **Day 4-6:** ntfy — e.g. "DAMC-233 has been waiting on manager feedback for 5 days."
- **Day 7+:** ntfy with suggested action — e.g. "DAMC-233 blocked 8 days. Draft a follow-up? Or escalate?"
- If `blocked_on_whom == "self"`: more aggressive — e.g. "natchildersart.com Turso migration is blocked on you. 10 days. Schedule a 2-hour block this Friday?"

### Jira sync (DAMC tickets)

For work projects tied to Jira:

- Poll Jira API for DAMC ticket status changes; update `projects.status` and `last_touched` automatically.
- On new comment (e.g. DAMC-233), update `last_touched` and append `project_note` with `source: jira_sync`.
- Reduces false "stale" nags when tickets are actually moving.

### Morning briefing integration

- Count of active/blocked/stale.
- Top stale item with suggested next action.
- Blocker updates (e.g. Jira comment overnight).

### Night mode responsibilities

- Run `evaluate_staleness()` for all non-paused projects.
- ntfy alerts for stale/abandoned items.
- Blocked projects: optional signals if blocker may have changed (Jira, calendar with blocker).
- Write project summary to morning briefing payload.

---

## 3. Schedule Proposal (Weekly)

### Intent

Every Sunday evening, Virgil drafts a proposed schedule for the upcoming week. It accounts for fixed commitments (calendar, in-office days), recurring habits, goal priorities, and project next-actions. Owner reviews and approves (or edits) before Virgil pushes events to Google Calendar.

### Inputs

| Source | Data |
|--------|------|
| Google Calendar API | Existing events Mon-Sun |
| Goal/habit tracker | Recurring commitments |
| Project graph | Top projects by priority × staleness, estimated time blocks |
| Memory (L2) | Patterns: Thursday in-office, Friday deep work, typical wake/sleep |
| Weather API (optional) | Outdoor activities |

### Schedule template (owner structure)

**WEEKDAY (Mon-Wed, Fri):** 07:30 wake → 07:30-08:15 morning strength → 08:15-08:45 journaling → 08:45-09:00 Python → 09:00-17:00 work (meetings from calendar) → 17:30-19:00 BJJ/MT if training day → 19:00-21:00 open → 21:00-22:00 wind-down → 22:30 target bedtime.

**THURSDAY (in-office):** Same structure + commute; no deep work blocks; training may shift.

**FRIDAY (deep work):** 09:00-12:00 deep work (highest-priority project); 13:00-17:00 deep work 2 or meetings; evening training.

**WEEKEND:** Flexible; suggest one project block, one recovery, one social block; Sunday evening = weekly review.

### Proposal generation logic

```python
def generate_weekly_proposal(week_start: date) -> WeeklyProposal:
    """
    1. Pull all existing calendar events for the week.
    2. Identify fixed slots (meetings, BJJ class times, in-office Thursday).
    3. Place non-negotiables first:
       - Journaling: daily, morning
       - Python study: daily, morning (after journaling)
       - Training: 4 slots across the week, prefer consistent times
       - Morning strength: daily, first block after wake
    4. Assign project work blocks:
       - Sort projects by: (priority * staleness_factor)
       - Assign top project to Friday deep work
       - Distribute remaining across open evening/weekend slots
       - Blocked projects get no time blocks (but blocker follow-up actions do)
    5. Protect decompression:
       - At least 1 hour/day unscheduled evening time
       - Weekend: at least one half-day fully unscheduled
    6. Flag conflicts:
       - Training + meeting overlap → manual resolution
       - Project deadline within the week → escalate time allocation
    7. Return structured proposal with confidence levels per slot.
    """
```

### Approval flow

- Deliver Sunday ~8pm via ntfy + deep link to chat UI.
- Owner replies: "Approve" → push events to Google Calendar; natural-language edits → re-present; unapproved proposals expire Monday 6am; one reminder Sunday 10pm if not approved.
- Mid-week: "reschedule Friday deep work to Saturday" → update internal plan and Calendar.

### Google Calendar integration

- **Write** to a dedicated "Virgil" calendar (not primary) for easy visual distinction and bulk delete.
- **Read** all relevant calendars (primary + work).
- Event descriptions include metadata: `source: virgil`, `project: …`, `type: deep_work`.
- On conflicting primary-calendar events mid-week → ntfy: e.g. "New meeting conflicts with your BJJ slot Tuesday. Reschedule training?"

### Night mode responsibilities

- Sunday night: auto-generate next week's proposal if not already generated.
- Nightly: compare today's plan vs. actual; log completion to goal/habit tracker where possible.
- If a scheduled project block was skipped, note on project and factor into next week's proposal.

---

## 4. Cross-cutting concerns

### Morning briefing payload

```python
@dataclass
class MorningBriefing:
    date: date
    weather: str                          # "72°F, partly cloudy"
    calendar_summary: list[str]           # today's events, concise
    habit_streaks: list[HabitStatus]      # green/yellow/red per habit
    stale_projects: list[ProjectAlert]    # anything stale or abandoned
    blocker_updates: list[str]           # e.g. "Jira comment on DAMC-233 overnight"
    top_priorities: list[str]             # today's 2-3 focus items from schedule
    nudge: str | None                     # contextual push, e.g. "LLC aging 14 days"
```

Rendered to text; TTS (ElevenLabs for important content, Piper for routine); playable on phone via frontend or audio notification.

### Memory integration

- Habit entries older than 90 days: compact to weekly aggregates → L3 (Supabase).
- Project notes: full text in L2; summarized in L3.
- Schedule history: keep 4 weeks in L2; summarize patterns in L3 (e.g. "Saturday project blocks often skipped").
- All systems feed conversational context: "You asked about the LLC — 14 days since last action. Next step is filing the Articles of Organization."

### Personality layer

Interventions follow [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md) and [VIRGIL_PERSONA.md](VIRGIL_PERSONA.md):

- Direct, not cheerleading.
- Suggest, don't command.
- Context-aware (reference the why).
- Quiet when green; escalate proportionally (yellow → observe, red → suggest, abandoned → confront).

---

## 5. Virgil v2 — Free tech stack additions (reference)

Compiled from planning sessions, April 2026. **$0 recurring** unless noted; one-time costs flagged.

### Memory layer

| Item | Role |
|------|------|
| **Supabase (free tier)** | Cloud pgvector for mem0 OSS (L3 cold storage). ~500MB; watch embedding dimensions. |
| **mem0 OSS** | Extraction, storage, retrieval; local embeddings option. |

### Inference

| Item | Role |
|------|------|
| **Groq (free tier)** | Middle tier — faster than local 7B, rate-limited. |
| **Google AI Studio / Gemini API** | Heavy fallback; discipline routing to stay on free tier when possible. |

### Notifications and messaging

| Item | Role |
|------|------|
| **ntfy.sh** | Primary push channel (`tools/notify.py`). |
| **Pushover (optional)** | Richer UX; ~$5 one-time app purchase. |

### Scheduled execution

| Item | Role |
|------|------|
| **QStash / Upstash** | Deferred jobs, keep-alive pings. |
| **GitHub Actions** | Periodic tasks off the Mac Mini. |

### Web search and content

| Item | Role |
|------|------|
| **SearXNG (self-hosted)** | Meta-search without API keys. |
| **Jina Reader API (free tier)** | URL → markdown text. |

### Document ingestion

| Item | Role |
|------|------|
| **Unstructured.io (free tier)** | PDF/DOCX/HTML → text for memory pipeline. |

### Voice and audio

| Item | Role |
|------|------|
| **ElevenLabs (free tier)** | High-value TTS; tight monthly budget. |
| **Piper TTS (self-hosted)** | Routine/unlimited fallback. |
| **pychromecast / googlehomepush** | Optional cast to Home/Hub (briefing primary path is phone). |

### Device control

| Item | Role |
|------|------|
| **Home Assistant (self-hosted)** | Unified device abstraction (`tools/home_assistant.py`). |

### Observability

| Item | Role |
|------|------|
| **Grafana Cloud (free tier)** | Metrics/logs/traces. |
| **Better Stack / Logtail (optional)** | Lighter log aggregation. |

### Networking

| Item | Role |
|------|------|
| **Cloudflare Tunnel** | Remote access without open ports. |
| **Tailscale** | Mesh VPN (already in scope). |

### Calendar and tasks

| Item | Role |
|------|------|
| **Google Calendar API** | Read/write (dedicated Virgil calendar for writes). |
| **Jira Cloud API** | DAMC sync into project graph. |

**Cost summary:** Recurring $0 (excluding optional Gemini paid tier). One-time hardware/API fees as listed in original planning notes (e.g. Nest SDM $5, optional Zigbee dongle ~$15, Pushover app ~$5).

---

## 6. Implementation phases (Python backend)

When the v2 codebase exists, prefer this order (depends on core loop, memory, Calendar read/write, ntfy):

1. **Schema and repositories** — Tables per this spec; migrations in the Python package.
2. **Deterministic evaluators** — `evaluate_streak` and `evaluate_staleness` as pure, clock-injected functions with unit tests; seed data as fixtures.
3. **HTTP API** — Routes in [V2_BEHAVIORAL_API.md](V2_BEHAVIORAL_API.md); auth aligned with v2 single-user model (e.g. Bearer `API_SECRET`).
4. **Night mode hooks** — Batch evaluators, ntfy payloads, persist `MorningBriefing` for the next day.
5. **Schedule pipeline** — `generate_weekly_proposal`, conflict detection, approval state machine, Calendar writes to the Virgil calendar.
6. **Memory compaction** — \>90d habit rollup, project note summaries, schedule pattern summaries → L3.

---

## 7. Open decisions

- **Timezone** — IANA timezone for week boundaries (`weekly:4`, Mon–Sun). Align with owner calendar defaults.
- **Inverse habit** — MVP = manual check-in only; defer Screen Time and heuristics.
- **v1 vs v2 goals** — Avoid duplicate SSOT; see [V2_MIGRATION.md](V2_MIGRATION.md) § Behavioral and goal state.
