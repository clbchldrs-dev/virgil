import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleBackgroundJobsRunPost } from "@/lib/reliability/background-job-run-handler";

describe("handleBackgroundJobsRunPost", () => {
  it("returns 500 when signing keys are missing", async () => {
    const response = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        hasSigningKeys: () => false,
        verifySignature: async () => true,
        processJobById: async () => undefined,
      }
    );

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "qstash_signing_keys_missing",
    });
  });

  it("returns 401 for missing or invalid signature", async () => {
    const missingSig = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => true,
        processJobById: async () => undefined,
      }
    );
    assert.equal(missingSig.status, 401);

    const invalidSig = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        headers: { "upstash-signature": "bad" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => false,
        processJobById: async () => undefined,
      }
    );
    assert.equal(invalidSig.status, 401);
    assert.deepEqual(await invalidSig.json(), {
      ok: false,
      error: "invalid_signature",
    });
  });

  it("returns 400 for invalid payloads and 200 for success", async () => {
    const invalidJson = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        headers: { "upstash-signature": "ok" },
        body: "{",
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => true,
        processJobById: async () => undefined,
      }
    );
    assert.equal(invalidJson.status, 400);

    const missingJobId = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        headers: { "upstash-signature": "ok" },
        body: JSON.stringify({}),
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => true,
        processJobById: async () => undefined,
      }
    );
    assert.equal(missingJobId.status, 400);

    const calls: string[] = [];
    const success = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        headers: { "upstash-signature": "ok" },
        body: JSON.stringify({ jobId: "job-123" }),
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => true,
        processJobById: (jobId) => {
          calls.push(jobId);
          return Promise.resolve();
        },
      }
    );
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { ok: true, jobId: "job-123" });
    assert.deepEqual(calls, ["job-123"]);
  });

  it("returns 500 with diagnostics when job processing fails", async () => {
    const response = await handleBackgroundJobsRunPost(
      new Request("http://localhost/api/background/jobs/run", {
        method: "POST",
        headers: { "upstash-signature": "ok" },
        body: JSON.stringify({ jobId: "job-fail" }),
      }),
      {
        hasSigningKeys: () => true,
        verifySignature: async () => true,
        processJobById: () => Promise.reject(new Error("worker_failed")),
      }
    );

    assert.equal(response.status, 500);
    const body = (await response.json()) as {
      ok: boolean;
      error: string;
      jobId: string;
      message: string;
    };
    assert.equal(body.ok, false);
    assert.equal(body.error, "job_processing_failed");
    assert.equal(body.jobId, "job-fail");
    assert.equal(body.message, "worker_failed");
  });
});
