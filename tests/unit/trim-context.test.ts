import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateTokens,
  trimMessagesForBudget,
} from "../../lib/ai/trim-context";

test("trimMessagesForBudget returns a bounded message list for long threads", () => {
  const messages = Array.from({ length: 20 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `msg-${i}`,
  })) as { role: string; content: string }[];

  const trimmed = trimMessagesForBudget({
    messages,
    systemTokenCount: 50,
    maxContextTokens: 8000,
  });

  assert.ok(trimmed.length >= 2);
  assert.ok(trimmed.length <= messages.length);
});

test("estimateTokens scales with text length", () => {
  assert.ok(estimateTokens("hello world") > 0);
  assert.ok(estimateTokens("x".repeat(350)) >= 100);
});

test("middle trim drops assistant turns before user turns when budget is tight", () => {
  const fatBlock = "x".repeat(400);
  const fat = `assistant-fat-${fatBlock}`;
  const messages = [
    { role: "user", content: "first" },
    { role: "user", content: "user-anchor-early" },
    { role: "assistant", content: fat },
    { role: "user", content: "user-mid" },
    { role: "assistant", content: "a" },
    { role: "user", content: "u" },
    { role: "assistant", content: "a" },
    { role: "user", content: "u" },
    { role: "assistant", content: "a" },
    { role: "user", content: "t1" },
    { role: "assistant", content: "t2" },
    { role: "user", content: "t3" },
    { role: "assistant", content: "t4" },
  ];

  const trimmed = trimMessagesForBudget({
    messages,
    systemTokenCount: 0,
    maxContextTokens: 90,
  });

  const joined = trimmed.map((m) => String(m.content)).join("\n");
  assert.ok(joined.includes("user-anchor-early"));
  assert.ok(!joined.includes(fatBlock));
});

test("middle trim drops plain assistant before assistant with tool-call parts", () => {
  const filler = "x".repeat(500);
  const toolCallAssistant = {
    role: "assistant",
    content: [
      {
        type: "tool-call",
        toolCallId: "tc1",
        toolName: "getWeather",
        input: { location: "NYC" },
      },
    ],
  };
  const messages = [
    { role: "user", content: "first" },
    { role: "assistant", content: filler },
    toolCallAssistant,
    { role: "user", content: "u1" },
    { role: "assistant", content: "a1" },
    { role: "user", content: "u2" },
    { role: "assistant", content: "a2" },
    { role: "user", content: "u3" },
    { role: "assistant", content: "a3" },
    { role: "user", content: "u4" },
    { role: "assistant", content: "a4" },
    { role: "user", content: "u5" },
    { role: "assistant", content: "a5" },
    { role: "user", content: "u6" },
  ];

  const trimmed = trimMessagesForBudget({
    messages,
    systemTokenCount: 0,
    maxContextTokens: 90,
  });

  const serialized = JSON.stringify(trimmed);
  assert.ok(serialized.includes("tool-call"));
  assert.ok(serialized.includes("getWeather"));
  assert.ok(!serialized.includes(filler));
});

test("oversized first user turn is compressed so recent tail can remain", () => {
  const hugeFirst = "U".repeat(1200);
  const trimmed = trimMessagesForBudget({
    messages: [
      { role: "user", content: hugeFirst },
      { role: "assistant", content: "short" },
      { role: "user", content: "middle ask" },
      { role: "assistant", content: "middle reply" },
      { role: "user", content: "latest ask" },
    ],
    systemTokenCount: 0,
    maxContextTokens: 800,
  });

  const firstOut = trimmed[0];
  assert.ok(firstOut);
  assert.equal(firstOut.role, "user");
  assert.ok(
    String(firstOut.content).length < hugeFirst.length,
    "first user blob should be capped"
  );
  assert.ok(String(firstOut.content).includes("..."));
  assert.equal(trimmed.at(-1)?.content, "latest ask");
});
