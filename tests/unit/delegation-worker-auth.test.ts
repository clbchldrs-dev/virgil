import assert from "node:assert/strict";
import test from "node:test";

test("wrong bearer returns 401 without leaking configured secret", async () => {
  const prev = process.env.VIRGIL_DELEGATION_WORKER_SECRET;
  process.env.VIRGIL_DELEGATION_WORKER_SECRET =
    "virgil-worker-secret-value-xyz";

  try {
    const { unauthorizedUnlessDelegationWorker } = await import(
      "@/lib/api/delegation-worker-auth"
    );
    const res = unauthorizedUnlessDelegationWorker(
      new Request("https://example.com/api/delegation/worker/claim", {
        headers: { Authorization: "Bearer wrong-token-not-the-secret" },
      })
    );
    assert.ok(res);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.deepEqual(body, { error: "unauthorized" });
    const text = JSON.stringify(body);
    assert.equal(text.includes("virgil-worker-secret-value-xyz"), false);
  } finally {
    if (prev === undefined) {
      process.env.VIRGIL_DELEGATION_WORKER_SECRET = undefined;
    } else {
      process.env.VIRGIL_DELEGATION_WORKER_SECRET = prev;
    }
  }
});

test("correct bearer returns null", async () => {
  const prev = process.env.VIRGIL_DELEGATION_WORKER_SECRET;
  process.env.VIRGIL_DELEGATION_WORKER_SECRET = "matching-secret-abc";

  try {
    const { unauthorizedUnlessDelegationWorker } = await import(
      "@/lib/api/delegation-worker-auth"
    );
    const denied = unauthorizedUnlessDelegationWorker(
      new Request("https://example.com/api/delegation/worker/claim", {
        headers: { Authorization: "Bearer matching-secret-abc" },
      })
    );
    assert.equal(denied, null);
  } finally {
    if (prev === undefined) {
      process.env.VIRGIL_DELEGATION_WORKER_SECRET = undefined;
    } else {
      process.env.VIRGIL_DELEGATION_WORKER_SECRET = prev;
    }
  }
});
