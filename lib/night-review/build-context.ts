import "server-only";

import type { NightReviewMessageRow } from "@/lib/db/queries";
import type { Memory } from "@/lib/db/schema";
import {
  collectToolTypeCounts,
  extractTextFromParts,
} from "@/lib/night-review/parts-stats";
import type { NightWorkspaceFiles } from "@/lib/night-review/workspace";

const MAX_EXCERPT_CHARS_PER_MESSAGE = 800;
const MAX_TOTAL_EXCERPT_CHARS = 24_000;
const MAX_USER_SNIPPETS_PER_CHAT = 4;
const MAX_CHARS_PER_USER_SNIPPET = 600;

export type NightReviewRollup = {
  windowStartIso: string;
  windowEndIso: string;
  totalMessages: number;
  loadedMessages: number;
  truncated: boolean;
  distinctChats: number;
  messagesByRole: { user: number; assistant: number; other: number };
  toolInvocations: Record<string, number>;
  chatSummaries: {
    chatId: string;
    title: string;
    messageCount: number;
  }[];
};

function mergeToolCounts(
  into: Record<string, number>,
  from: Record<string, number>
) {
  for (const [k, v] of Object.entries(from)) {
    into[k] = (into[k] ?? 0) + v;
  }
}

export function buildRollupFromRows(
  rows: NightReviewMessageRow[],
  totalMessagesInDb: number,
  windowStart: Date,
  windowEnd: Date
): NightReviewRollup {
  const chatStats = new Map<
    string,
    { title: string; count: number; toolCounts: Record<string, number> }
  >();
  const messagesByRole = { user: 0, assistant: 0, other: 0 };
  const toolInvocations: Record<string, number> = {};

  for (const row of rows) {
    const { message, chatId, chatTitle } = row;
    const prev = chatStats.get(chatId) ?? {
      title: chatTitle,
      count: 0,
      toolCounts: {} as Record<string, number>,
    };
    prev.count += 1;
    const tools = collectToolTypeCounts(message.parts);
    mergeToolCounts(prev.toolCounts, tools);
    mergeToolCounts(toolInvocations, tools);
    chatStats.set(chatId, prev);

    const role = message.role;
    if (role === "user") {
      messagesByRole.user += 1;
    } else if (role === "assistant") {
      messagesByRole.assistant += 1;
    } else {
      messagesByRole.other += 1;
    }
  }

  const chatSummaries = [...chatStats.entries()].map(([chatId, s]) => ({
    chatId,
    title: s.title,
    messageCount: s.count,
  }));

  return {
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
    totalMessages: totalMessagesInDb,
    loadedMessages: rows.length,
    truncated: rows.length < totalMessagesInDb,
    distinctChats: chatStats.size,
    messagesByRole,
    toolInvocations,
    chatSummaries,
  };
}

/** Serialize rollup + per-chat tool counts for the model (compact). */
export function formatRollupForPrompt(
  rollup: NightReviewRollup,
  rows: NightReviewMessageRow[]
): string {
  const chatStats = new Map<
    string,
    { title: string; toolCounts: Record<string, number> }
  >();
  for (const row of rows) {
    const tools = collectToolTypeCounts(row.message.parts);
    const prev = chatStats.get(row.chatId) ?? {
      title: row.chatTitle,
      toolCounts: {},
    };
    mergeToolCounts(prev.toolCounts, tools);
    chatStats.set(row.chatId, prev);
  }

  const chatLines = rollup.chatSummaries.map((c) => {
    const tools = chatStats.get(c.chatId)?.toolCounts ?? {};
    const toolStr =
      Object.keys(tools).length > 0 ? ` tools=${JSON.stringify(tools)}` : "";
    return `- ${c.title} (${c.messageCount} msgs)${toolStr}`;
  });

  const toolGlobal = Object.entries(rollup.toolInvocations)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}:${n}`)
    .join(", ");

  return [
    `Window: ${rollup.windowStartIso} .. ${rollup.windowEndIso}`,
    `Messages (DB in window): ${rollup.totalMessages}; loaded for excerpts: ${rollup.loadedMessages}${rollup.truncated ? " (TRUNCATED — oldest rows dropped by cap)" : ""}`,
    `Distinct chats: ${rollup.distinctChats}`,
    `By role: user=${rollup.messagesByRole.user} assistant=${rollup.messagesByRole.assistant} other=${rollup.messagesByRole.other}`,
    `Tool parts (aggregate): ${toolGlobal || "(none)"}`,
    "Chats:",
    ...chatLines,
  ].join("\n");
}

/**
 * Last N user text snippets per chat, capped globally — avoids sending full history.
 */
export function buildExcerptBlock(rows: NightReviewMessageRow[]): string {
  const byChat = new Map<string, { title: string; snippets: string[] }>();

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) {
      continue;
    }
    if (row.message.role !== "user") {
      continue;
    }
    const entry = byChat.get(row.chatId) ?? {
      title: row.chatTitle,
      snippets: [],
    };
    if (entry.snippets.length >= MAX_USER_SNIPPETS_PER_CHAT) {
      continue;
    }
    const text = extractTextFromParts(
      row.message.parts,
      MAX_EXCERPT_CHARS_PER_MESSAGE
    );
    if (!text) {
      continue;
    }
    const clipped =
      text.length > MAX_CHARS_PER_USER_SNIPPET
        ? `${text.slice(0, MAX_CHARS_PER_USER_SNIPPET)}…`
        : text;
    entry.snippets.unshift(clipped);
    byChat.set(row.chatId, entry);
  }

  const lines: string[] = [];
  let totalChars = 0;
  for (const [chatId, { title, snippets }] of byChat) {
    const block = [
      `### ${title} (${chatId.slice(0, 8)}…)`,
      ...snippets.map((s) => `User: ${s}`),
    ].join("\n");
    if (totalChars + block.length > MAX_TOTAL_EXCERPT_CHARS) {
      lines.push("… (excerpts truncated by global char budget)");
      break;
    }
    lines.push(block);
    totalChars += block.length;
  }

  return lines.join("\n\n");
}

export function formatMemoriesForPrompt(
  memories: Memory[],
  maxItems = 30
): string {
  if (memories.length === 0) {
    return "(no memories in window)";
  }
  return memories
    .slice(0, maxItems)
    .map((m) => `- [${m.kind}] ${m.content}`)
    .join("\n");
}

export function buildNightReviewSystemPrompt(
  files: NightWorkspaceFiles
): string {
  return [
    "# Workspace: SOUL",
    files.soul.trim(),
    "",
    "# Workspace: SKILLS (reference)",
    files.skills.trim(),
    "",
    "# Workspace: HEARTBEAT (checklist)",
    files.heartbeat.trim(),
    "",
    'You must respond with a single JSON object matching the schema you were given. Use status "ok" when there is nothing useful to report.',
  ].join("\n");
}

export function buildNightReviewUserContent(input: {
  rollupText: string;
  excerptBlock: string;
  memoriesBlock: string;
}): string {
  return [
    "## Activity rollup",
    input.rollupText,
    "",
    "## User message excerpts (partial)",
    input.excerptBlock || "(no user text in window)",
    "",
    "## Memories created/updated in window",
    input.memoriesBlock,
  ].join("\n");
}
