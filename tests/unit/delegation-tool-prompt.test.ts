import assert from "node:assert/strict";
import test from "node:test";

import { buildDelegationToolFailurePromptSnippet } from "../../lib/integrations/delegation-tool-prompt";

test("delegation tool prompt snippet documents structured fields and retry policy", () => {
  const s = buildDelegationToolFailurePromptSnippet();
  assert.match(s, /\*\*error\*\*/);
  assert.match(s, /\*\*errorCode\*\*/);
  assert.match(s, /\*\*retryable\*\*/);
  assert.match(s, /provided_skill_not_advertised/);
  assert.match(s, /resolved_skill_not_advertised/);
  assert.match(s, /embedViaDelegation/);
  assert.match(s, /embed_skill_not_advertised/);
  assert.match(s, /delegation_backend_offline/);
  assert.match(s, /approveDelegationIntent/);
});
