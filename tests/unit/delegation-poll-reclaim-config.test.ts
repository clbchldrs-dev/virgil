import assert from "node:assert/strict";
import test from "node:test";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void | Promise<void>
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const v = patch[key];
    if (v === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = v;
    }
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(patch)) {
      const p = prev[key];
      if (p === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = p;
      }
    }
  });
}

test("getDelegationProcessingReclaimAfterMs defaults to 15 minutes", async () => {
  await withEnv(
    { VIRGIL_DELEGATION_PROCESSING_RECLAIM_AFTER_MS: undefined },
    async () => {
      const { getDelegationProcessingReclaimAfterMs } = await import(
        "../../lib/integrations/delegation-poll-config"
      );
      assert.equal(getDelegationProcessingReclaimAfterMs(), 900_000);
    }
  );
});

test("getDelegationProcessingReclaimAfterMs parses env", async () => {
  await withEnv(
    { VIRGIL_DELEGATION_PROCESSING_RECLAIM_AFTER_MS: "120000" },
    async () => {
      const { getDelegationProcessingReclaimAfterMs } = await import(
        "../../lib/integrations/delegation-poll-config"
      );
      assert.equal(getDelegationProcessingReclaimAfterMs(), 120_000);
    }
  );
});

test("getDelegationProcessingReclaimAfterMs rejects too-small values", async () => {
  await withEnv(
    { VIRGIL_DELEGATION_PROCESSING_RECLAIM_AFTER_MS: "30000" },
    async () => {
      const { getDelegationProcessingReclaimAfterMs } = await import(
        "../../lib/integrations/delegation-poll-config"
      );
      assert.equal(getDelegationProcessingReclaimAfterMs(), 900_000);
    }
  );
});
