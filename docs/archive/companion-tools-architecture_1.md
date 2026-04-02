# Companion Tools Architecture Reference

## Overview

This document defines the tool-use layer for Virgil (companion mode). Tools are built on the Vercel AI SDK's native `tool()` API and registered conditionally based on runtime environment (local vs. Vercel).

## File Structure

```
lib/
  ai/
    tools/
      index.ts              # Environment-aware tool registry
      types.ts              # Shared types for tool results and approval
      filesystem.ts         # Local file read/write
      shell.ts              # Shell command execution
      jira.ts               # Jira API integration
      calendar.ts           # Google Calendar integration
```

## Core Pattern: Tool Definition

Every tool follows this shape using the AI SDK's `tool()` function:

```ts
// lib/ai/tools/filesystem.ts
import { tool } from 'ai';
import { z } from 'zod';

export const readFile = tool({
  description: 'Read the contents of a local file given an absolute or relative path.',
  parameters: z.object({
    path: z.string().describe('Absolute or relative file path to read'),
  }),
  execute: async ({ path }) => {
    const fs = await import('node:fs/promises');
    const resolved = (await import('node:path')).resolve(path);

    // Safety: block paths outside allowed roots
    const allowedRoots = (process.env.ALLOWED_FILE_ROOTS ?? '').split(',').filter(Boolean);
    if (allowedRoots.length > 0) {
      const withinRoot = allowedRoots.some(root => resolved.startsWith(root));
      if (!withinRoot) {
        return { error: `Path ${resolved} is outside allowed roots: ${allowedRoots.join(', ')}` };
      }
    }

    try {
      const content = await fs.readFile(resolved, 'utf-8');
      return { path: resolved, content, bytes: Buffer.byteLength(content) };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

export const writeFile = tool({
  description: 'Write content to a local file. Creates the file if it does not exist. Overwrites if it does.',
  parameters: z.object({
    path: z.string().describe('File path to write to'),
    content: z.string().describe('Content to write'),
  }),
  execute: async ({ path, content }) => {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const resolved = nodePath.resolve(path);

    const allowedRoots = (process.env.ALLOWED_FILE_ROOTS ?? '').split(',').filter(Boolean);
    if (allowedRoots.length > 0) {
      const withinRoot = allowedRoots.some(root => resolved.startsWith(root));
      if (!withinRoot) {
        return { error: `Path ${resolved} is outside allowed roots` };
      }
    }

    try {
      await fs.mkdir(nodePath.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return { path: resolved, bytesWritten: Buffer.byteLength(content), success: true };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

```ts
// lib/ai/tools/shell.ts
import { tool } from 'ai';
import { z } from 'zod';

export const executeShell = tool({
  description: 'Execute a shell command and return stdout/stderr. Use for running scripts, git operations, build commands, and file system operations.',
  parameters: z.object({
    command: z.string().describe('Shell command to execute'),
    cwd: z.string().optional().describe('Working directory for the command'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
  }),
  execute: async ({ command, cwd, timeout }) => {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    // Safety: block obviously dangerous patterns
    const blocked = [/rm\s+-rf\s+\/(?!\S)/, /mkfs/, /dd\s+if=/, /:(){ :|:& };:/];
    if (blocked.some(pattern => pattern.test(command))) {
      return { error: 'Command blocked by safety filter' };
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? process.cwd(),
        timeout: timeout ?? 30000,
        maxBuffer: 1024 * 1024, // 1MB
      });
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout?.trim() ?? '',
        stderr: err.stderr?.trim() ?? '',
        exitCode: err.code ?? 1,
        error: err.message,
      };
    }
  },
});
```

```ts
// lib/ai/tools/jira.ts
import { tool } from 'ai';
import { z } from 'zod';

const jiraFetch = async (path: string, options?: RequestInit) => {
  const baseUrl = process.env.JIRA_BASE_URL; // e.g. https://yoursite.atlassian.net
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !token) {
    throw new Error('Jira credentials not configured');
  }

  const res = await fetch(`${baseUrl}/rest/api/3${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
};

export const getJiraIssue = tool({
  description: 'Get details of a Jira issue by key (e.g., DAMC-233).',
  parameters: z.object({
    issueKey: z.string().describe('Jira issue key like PROJ-123'),
  }),
  execute: async ({ issueKey }) => {
    try {
      const data = await jiraFetch(`/issue/${issueKey}`);
      return {
        key: data.key,
        summary: data.fields.summary,
        status: data.fields.status.name,
        assignee: data.fields.assignee?.displayName ?? 'Unassigned',
        description: data.fields.description,
        priority: data.fields.priority?.name,
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

export const searchJiraIssues = tool({
  description: 'Search Jira issues using JQL query.',
  parameters: z.object({
    jql: z.string().describe('JQL query string'),
    maxResults: z.number().optional().default(10),
  }),
  execute: async ({ jql, maxResults }) => {
    try {
      const data = await jiraFetch(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`);
      return {
        total: data.total,
        issues: data.issues.map((issue: any) => ({
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
        })),
      };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

export const updateJiraIssue = tool({
  description: 'Update a Jira issue. Can change summary, description, status, or add a comment.',
  parameters: z.object({
    issueKey: z.string().describe('Jira issue key'),
    summary: z.string().optional().describe('New summary/title'),
    comment: z.string().optional().describe('Comment to add'),
  }),
  execute: async ({ issueKey, summary, comment }) => {
    try {
      if (summary) {
        await jiraFetch(`/issue/${issueKey}`, {
          method: 'PUT',
          body: JSON.stringify({ fields: { summary } }),
        });
      }
      if (comment) {
        await jiraFetch(`/issue/${issueKey}/comment`, {
          method: 'POST',
          body: JSON.stringify({
            body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] }
          }),
        });
      }
      return { success: true, issueKey };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
```

```ts
// lib/ai/tools/calendar.ts
import { tool } from 'ai';
import { z } from 'zod';

// Placeholder — requires OAuth2 setup with Google Calendar API
// For MVP: use Google Calendar API with a service account or OAuth refresh token

export const listCalendarEvents = tool({
  description: 'List upcoming calendar events for a given date range.',
  parameters: z.object({
    daysAhead: z.number().optional().default(1).describe('Number of days ahead to look'),
  }),
  execute: async ({ daysAhead }) => {
    // TODO: Implement Google Calendar API call
    // Requires: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN
    return { error: 'Calendar integration not yet configured. Needs OAuth setup.' };
  },
});
```

## Environment-Aware Tool Registry

```ts
// lib/ai/tools/index.ts
import { readFile, writeFile } from './filesystem';
import { executeShell } from './shell';
import { getJiraIssue, searchJiraIssues, updateJiraIssue } from './jira';
import { listCalendarEvents } from './calendar';

const isVercel = !!process.env.VERCEL;

// Tools that require local runtime (filesystem, shell access)
const localOnlyTools = {
  readFile,
  writeFile,
  executeShell,
};

// Tools that work via API calls in any environment
const universalTools = {
  getJiraIssue,
  searchJiraIssues,
  updateJiraIssue,
  listCalendarEvents,
};

export function getAvailableTools() {
  if (isVercel) {
    return { ...universalTools };
  }
  return { ...universalTools, ...localOnlyTools };
}

// For the UI: expose tool metadata so the frontend can show
// which tools are available in the current environment
export function getToolManifest() {
  const tools = getAvailableTools();
  return Object.keys(tools).map(name => ({
    name,
    local: name in localOnlyTools,
  }));
}
```

## Chat Route Integration

In your existing chat API route (likely `app/(chat)/api/chat/route.ts` or similar), the tools plug into the `streamText` call:

```ts
import { getAvailableTools } from '@/lib/ai/tools';

// Inside your route handler, where streamText is called:
const result = streamText({
  model: yourModel,
  system: systemPrompt, // see cursor prompt for system prompt additions
  messages,
  tools: getAvailableTools(),
  maxSteps: 5, // allow multi-step tool use (model calls tool, sees result, responds)
  // onStepFinish for logging/telemetry (optional)
});
```

The `maxSteps` parameter is critical — it lets the model chain tool calls. Without it, the model can call a tool but can't respond to the result in the same turn.

## Environment Variables to Add

```env
# .env.local additions

# File system tool safety
ALLOWED_FILE_ROOTS=/home/caleb/projects,/home/caleb/notes

# Jira
JIRA_BASE_URL=https://yoursite.atlassian.net
JIRA_EMAIL=your-email@intuit.com
JIRA_API_TOKEN=your-api-token

# Google Calendar (deferred — requires OAuth flow)
# GOOGLE_CALENDAR_CLIENT_ID=
# GOOGLE_CALENDAR_CLIENT_SECRET=
# GOOGLE_CALENDAR_REFRESH_TOKEN=
```

## Approval Layer (Phase 2)

The AI SDK supports `experimental_toToolCallUIState` and custom tool result handling. For MVP, the simplest approval pattern:

1. Shell and write operations return a `{ requiresApproval: true, action: 'write', params: {...} }` instead of executing
2. Frontend renders an approve/reject UI
3. On approval, a follow-up API call executes the pending action

This is not in the initial cursor prompt — get the tools working with auto-execute first, then add the approval gate.
