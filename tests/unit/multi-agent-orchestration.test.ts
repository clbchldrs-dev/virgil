import assert from "node:assert/strict";
import test from "node:test";
import {
  getLastUserTurnSnippet,
  getPlannerModelId,
  isVirgilMultiAgentEnabled,
  mergePlannerOutlineIntoSystemPrompt,
  resolvePlannerStages,
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
  const prevChain = process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN;
  try {
    Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_CHAIN");
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
    if (prevChain === undefined) {
      Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_CHAIN");
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN = prevChain;
    }
  }
});

test("resolvePlannerStages uses planner chain when set", () => {
  const prevChain = process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN;
  const prevStageTok = process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS;
  const prevDefault = process.env.VIRGIL_MULTI_AGENT_PLANNER_MAX_OUTPUT_TOKENS_DEFAULT;
  try {
    process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN =
      "google/gemini-2.5-flash-lite, openai/gpt-4o-mini ";
    process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS = "256, 512";
    const stages = resolvePlannerStages("anthropic/claude-3-5-sonnet");
    assert.equal(stages.length, 2);
    assert.equal(stages[0]?.modelId, "google/gemini-2.5-flash-lite");
    assert.equal(stages[0]?.maxOutputTokens, 256);
    assert.equal(stages[1]?.modelId, "openai/gpt-4o-mini");
    assert.equal(stages[1]?.maxOutputTokens, 512);
  } finally {
    if (prevChain === undefined) {
      Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_CHAIN");
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN = prevChain;
    }
    if (prevStageTok === undefined) {
      Reflect.deleteProperty(
        process.env,
        "VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS"
      );
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS = prevStageTok;
    }
    if (prevDefault === undefined) {
      Reflect.deleteProperty(
        process.env,
        "VIRGIL_MULTI_AGENT_PLANNER_MAX_OUTPUT_TOKENS_DEFAULT"
      );
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_MAX_OUTPUT_TOKENS_DEFAULT =
        prevDefault;
    }
  }
});

test("resolvePlannerStages applies single token cap to every stage", () => {
  const prevChain = process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN;
  const prevStageTok = process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS;
  try {
    process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN = "a/x,b/y";
    process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS = "400";
    const stages = resolvePlannerStages("z/z");
    assert.equal(stages[0]?.maxOutputTokens, 400);
    assert.equal(stages[1]?.maxOutputTokens, 400);
  } finally {
    if (prevChain === undefined) {
      Reflect.deleteProperty(process.env, "VIRGIL_MULTI_AGENT_PLANNER_CHAIN");
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN = prevChain;
    }
    if (prevStageTok === undefined) {
      Reflect.deleteProperty(
        process.env,
        "VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS"
      );
    } else {
      process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS = prevStageTok;
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
