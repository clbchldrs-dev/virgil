import assert from "node:assert/strict";
import test from "node:test";

test("companion prompt tells the model Jira is unavailable when jiraEnabled is false", async () => {
  const { buildCompanionSystemPrompt } = await import(
    "../../lib/ai/companion-prompt"
  );
  const p = buildCompanionSystemPrompt({
    ownerName: null,
    memories: [],
    requestHints: {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
    },
    supportsTools: true,
    jiraEnabled: false,
  });
  assert.match(p, /Jira is not configured/i);
  assert.match(p, /do not attempt to call getJiraIssue/i);
  assert.doesNotMatch(p, /Use getJiraIssue, searchJiraIssues/);
});

test("companion prompt documents Jira tools when jiraEnabled is true", async () => {
  const { buildCompanionSystemPrompt } = await import(
    "../../lib/ai/companion-prompt"
  );
  const p = buildCompanionSystemPrompt({
    ownerName: null,
    memories: [],
    requestHints: {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
    },
    supportsTools: true,
    jiraEnabled: true,
  });
  assert.match(p, /Use getJiraIssue, searchJiraIssues, and updateJiraIssue/);
});

test("artifacts prompt lists Jira in examples only when jiraEnabled", async () => {
  const { buildArtifactsPrompt } = await import("../../lib/ai/prompts");
  assert.match(
    buildArtifactsPrompt({ jiraEnabled: true }),
    /readFile, Jira, calendar/
  );
  assert.doesNotMatch(
    buildArtifactsPrompt({ jiraEnabled: false }),
    /readFile, Jira, calendar/
  );
  assert.match(
    buildArtifactsPrompt({ jiraEnabled: false }),
    /readFile, calendar/
  );
});
