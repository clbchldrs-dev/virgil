import assert from "node:assert/strict";
import test from "node:test";
import {
  getLastUserTurnSnippet,
  getPlannerModelId,
  isVirgilMultiAgentEnabled,
  mergePlannerOutlineIntoSystemPrompt,
} from "@/lib/ai/orchestration/multi-agent";
import { VIRGIL_SYSTEM_PERSONA_DIVIDER } from "@/lib/ai/virgil-system-markers";

test("isVirgilMultiAgentEnabled respects env", () => {
  const prev = process.env.VIRGIL_MULTI_AGENT_ENABLED;
  try {
    process.env.VIRGIL_MULTI_AGENT_ENABLED = "1";
    assert.equal(isVirgilMultiAgentEnabled(), true);
    process.env.VIRGIL_MULTI_AGENT_ENABLED = "true";
    assert.equal(isVirgilMultiAgentEnabled(), true);
    process.env.VIRGIL_MULTI_AGENT_ENABLED = "0";
    assert.equal(isVirgilMultiAgentEnabled(), false);
    Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_ENABLED");
    assert.equal(isVirgilMultiAgentEnabled(), false);
  } finally {
    if (prev === undefined) {
      Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_ENABLED");
    } else {
      process.env.VIRGIL_MULTI_AGENT_ENABLED = prev;
    }
  }
});

test("getPlannerModelId uses override when set", () => {
  const prev = process.env.VIRGIL_MULTI_AGENT_PLANNER_MODEL;
  try {
    process.env.VIRGIL_MULTI_AGENT_PLANNER_MODEL = "openai/gpt-4o-mini";
    assert.equal(
      getPlannerModelId("anthropic/claude-3-5-sonnet"),
      "openai/gpt-4o-mini"
    );
    Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_MODEL");
    assert.equal(
      getPlannerModelId("moonshotai/kimi-k2-0905"),
      "moonshotai/kimi-k2-0905"
    );
  } finally {
    if (prev === undefined) {
      Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_MODEL");
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_MODEL = prev;
    }
  }
});

test("mergePlannerOutlineIntoSystemPrompt inserts outline after persona frame when divider present", () => {
  const base = `Persona only.${VIRGIL_SYSTEM_PERSONA_DIVIDER}Memory and tool section.`;
  const merged = mergePlannerOutlineIntoSystemPrompt(base, "1. Do X\n2. Do Y");
  const outlineAt = merged.indexOf("Executor outline");
  const sessionAt = merged.indexOf("Memory and tool section.");
  assert.ok(outlineAt !== -1);
  assert.ok(sessionAt !== -1);
  assert.ok(
    outlineAt < sessionAt,
    "outline should appear after persona divider and before session/tool body"
  );
  assert.match(merged, /Do X/);
});

test("mergePlannerOutlineIntoSystemPrompt appends outline when divider missing", () => {
  const merged = mergePlannerOutlineIntoSystemPrompt(
    "Base.",
    "1. Do X\n2. Do Y"
  );
  assert.match(merged, /^Base\./);
  assert.match(merged, /Executor outline/);
  assert.match(merged, /Do X/);
});

test("mergePlannerOutlineIntoSystemPrompt ignores empty outline", () => {
  assert.equal(mergePlannerOutlineIntoSystemPrompt("Only.", "  \n  "), "Only.");
});

test("getLastUserTurnSnippet reads string user content", () => {
  const s = getLastUserTurnSnippet([
    { role: "assistant", content: "hi" },
    { role: "user", content: "last ask" },
  ]);
  assert.equal(s, "last ask");
});

test("getLastUserTurnSnippet reads text parts", () => {
  const s = getLastUserTurnSnippet([
    {
      role: "user",
      content: [{ type: "text" as const, text: "part a" }],
    },
  ]);
  assert.equal(s, "part a");
});
