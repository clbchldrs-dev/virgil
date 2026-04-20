import assert from "node:assert/strict";
import test from "node:test";
import { agentTaskTriageOutputSchema } from "@/lib/agent-tasks/schema";
import { buildTriageSystemPrompt } from "@/lib/agent-tasks/triage-prompt";

test("triage system prompt forbids workflow authority", () => {
  const p = buildTriageSystemPrompt();
  assert.match(
    p,
    /do \*\*not\*\* control AgentTask workflow status/i,
    "must state triage does not control workflow status"
  );
  assert.match(p, /advisory/i, "must describe output as advisory");
});

test("triage schema rejects legacy approve/reject recommendation values", () => {
  const bad = agentTaskTriageOutputSchema.safeParse({
    alignsWithPrinciples: true,
    alignmentNotes: "x",
    estimatedScope: "small",
    suggestedFiles: [],
    recommendation: "approve",
    summary: "y",
  });
  assert.equal(bad.success, false);
});

test("triage schema accepts well_aligned recommendation", () => {
  const good = agentTaskTriageOutputSchema.safeParse({
    alignsWithPrinciples: true,
    alignmentNotes: "x",
    estimatedScope: "small",
    suggestedFiles: [],
    recommendation: "well_aligned",
    summary: "y",
  });
  assert.equal(good.success, true);
});
