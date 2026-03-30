# Cursor Prompt: Add Tool-Use Layer to Virgil Companion

## Context

This is Virgil (Next.js) built on the Vercel AI SDK template (ai-chatbot). It uses:
- Next.js App Router with React Server Components
- Vercel AI SDK for LLM integration (`streamText`, `tool()`)
- shadcn/ui + Tailwind CSS
- Neon Postgres for chat persistence
- Auth.js for authentication
- Vercel AI Gateway for multi-model routing

The goal is to add a tool-use layer that gives Virgil the ability to execute tasks on the user's behalf — making it a companion rather than just a chat interface. The system runs in two environments: locally (full capabilities) and on Vercel (API-only tools).

## What to Build

### Phase 1: Tool Definitions and Registry

Create the directory `lib/ai/tools/` with the following files:

#### `lib/ai/tools/types.ts`
Define shared result types:
- `ToolSuccess`: `{ success: true, data: unknown }`
- `ToolError`: `{ error: string }`
- `ToolResult`: union of the above

#### `lib/ai/tools/filesystem.ts`
Two tools using the AI SDK `tool()` function:

**`readFile`** — reads a local file given a path. Parameters: `path` (string). Safety constraint: resolve the path and validate it starts with one of the comma-separated roots in `process.env.ALLOWED_FILE_ROOTS`. If that env var is empty or unset, allow all paths. Return the file content, resolved path, and byte size. Handle errors gracefully.

**`writeFile`** — writes content to a local file. Parameters: `path` (string), `content` (string). Same path validation as readFile. Create parent directories recursively if they don't exist. Return resolved path, bytes written, success boolean.

Both tools must use dynamic `import('node:fs/promises')` and `import('node:path')` since these won't be available in Vercel's edge runtime.

#### `lib/ai/tools/shell.ts`
One tool:

**`executeShell`** — executes a shell command. Parameters: `command` (string), optional `cwd` (string), optional `timeout` (number, default 30000ms). Safety: block obviously destructive patterns (rm -rf /, mkfs, dd if=, fork bombs) via regex check before execution. Use Node's `child_process.exec` (promisified). Cap maxBuffer at 1MB. Return stdout, stderr, and exit code. On error, still return whatever stdout/stderr was captured.

Use dynamic imports for Node builtins.

#### `lib/ai/tools/jira.ts`
Three tools backed by a shared `jiraFetch` helper function:

The helper authenticates against Jira Cloud REST API v3 using Basic Auth with `process.env.JIRA_BASE_URL`, `process.env.JIRA_EMAIL`, and `process.env.JIRA_API_TOKEN`.

**`getJiraIssue`** — fetch issue by key. Parameters: `issueKey` (string). Return key, summary, status name, assignee display name, description, priority.

**`searchJiraIssues`** — search via JQL. Parameters: `jql` (string), optional `maxResults` (number, default 10). Return total count and array of issue summaries.

**`updateJiraIssue`** — update an issue. Parameters: `issueKey` (string), optional `summary` (string), optional `comment` (string). If summary is provided, PUT to update fields. If comment is provided, POST to add comment using Atlassian Document Format (ADF). Return success boolean.

#### `lib/ai/tools/calendar.ts`
One stub tool:

**`listCalendarEvents`** — parameters: `daysAhead` (number, default 1). For now, return `{ error: 'Calendar integration not yet configured. Needs OAuth setup.' }`. Leave a TODO comment noting it requires Google Calendar API OAuth2 credentials.

#### `lib/ai/tools/index.ts`
Environment-aware tool registry:

- Detect Vercel via `!!process.env.VERCEL`
- Define `localOnlyTools` object containing: readFile, writeFile, executeShell
- Define `universalTools` object containing: getJiraIssue, searchJiraIssues, updateJiraIssue, listCalendarEvents
- Export `getAvailableTools()`: returns universalTools on Vercel, all tools locally
- Export `getToolManifest()`: returns array of `{ name: string, local: boolean }` for UI display

### Phase 2: Chat Route Integration

Find the existing chat API route (likely `app/(chat)/api/chat/route.ts` or similar — wherever `streamText` is called).

Modify it to:
1. Import `getAvailableTools` from `@/lib/ai/tools`
2. Pass `tools: getAvailableTools()` to the `streamText` call
3. Add `maxSteps: 5` to the `streamText` options to enable multi-step tool use (the model calls a tool, receives the result, then can call another tool or respond)

Do NOT change the existing model selection, auth, or persistence logic. This is additive only.

### Phase 3: System Prompt Update

Find the system prompt (likely in `lib/ai/` or passed inline in the chat route). Append the following context to the existing system prompt — do not replace it:

```
You have access to tools that let you interact with the user's local environment and external services. Use them when the user asks you to do something actionable — read files, run commands, check Jira tickets, etc.

Guidelines:
- Always tell the user what you're about to do before calling a tool.
- If a tool returns an error, explain what went wrong and suggest alternatives.
- For shell commands, prefer safe and reversible operations. Never run destructive commands without explicit user confirmation.
- When reading files, summarize the relevant parts rather than dumping the entire content unless asked.
- You can chain multiple tool calls in a single response if a task requires it (e.g., read a file, then write a modified version).
```

### Phase 4: Environment Variables

Add these to `.env.example` and document them:

```env
# Tool: Filesystem — comma-separated allowed root directories
ALLOWED_FILE_ROOTS=

# Tool: Jira
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=

# Tool: Google Calendar (future — requires OAuth)
# GOOGLE_CALENDAR_CLIENT_ID=
# GOOGLE_CALENDAR_CLIENT_SECRET=
# GOOGLE_CALENDAR_REFRESH_TOKEN=
```

## Constraints

- All tool files must use Zod for parameter schemas (already a dependency via AI SDK)
- All Node.js built-in imports must be dynamic (`await import('node:fs/promises')`) for edge runtime compatibility
- Tool execute functions must never throw — always return structured results with an `error` field on failure
- Do not modify existing database schemas, auth flows, or UI components in this phase
- Do not add any new npm dependencies unless absolutely necessary — the AI SDK and Zod already provide everything needed

## Verification

After implementation, the following should work:
1. Start locally with `pnpm dev`
2. Open chat, type "read the file at ./package.json"
3. The model should call the readFile tool and summarize the contents
4. Type "what Jira issues are assigned to me?" — should gracefully error if Jira env vars aren't set, or return results if they are
5. On Vercel deployment, shell and file tools should not appear in the tool set

## What NOT to Build Yet

- Approval/confirmation UI for dangerous operations (Phase 2 feature)
- Calendar OAuth flow
- Tool call history persistence to the database
- Custom UI rendering for tool results (the default AI SDK message rendering is fine for now)
- Any orchestration, state machines, or multi-agent patterns
