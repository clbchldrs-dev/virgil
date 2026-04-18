import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleIngestSharePost } from "@/lib/ingest/share-route-handler";

describe("handleIngestSharePost", () => {
  it("returns 401 when no session user exists", async () => {
    const response = await handleIngestSharePost(
      new Request("http://localhost/api/ingest/share", { method: "POST" }),
      {
        auth: async () => null,
        saveMemoryRecord: async () => undefined,
      }
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("returns 403 for guest users", async () => {
    const response = await handleIngestSharePost(
      new Request("http://localhost/api/ingest/share", { method: "POST" }),
      {
        auth: async () => ({
          user: {
            id: "guest-1",
            type: "guest",
          },
        }),
        saveMemoryRecord: async () => undefined,
      }
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
  });

  it("returns 400 when shared payload is empty", async () => {
    const form = new FormData();
    const response = await handleIngestSharePost(
      new Request("http://localhost/api/ingest/share", {
        method: "POST",
        body: form,
      }),
      {
        auth: async () => ({
          user: {
            id: "user-1",
            type: "regular",
          },
        }),
        saveMemoryRecord: async () => undefined,
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "empty_share" });
  });

  it("persists share content and redirects with toast signal", async () => {
    const form = new FormData();
    form.set("title", "Useful note");
    form.set("text", "Captured from share sheet");
    form.set("url", "https://example.com/item");

    const calls: Array<{
      userId: string;
      kind: string;
      content: string;
      metadata: Record<string, unknown>;
    }> = [];

    const response = await handleIngestSharePost(
      new Request("http://localhost/api/ingest/share", {
        method: "POST",
        body: form,
      }),
      {
        auth: async () => ({
          user: {
            id: "user-1",
            type: "regular",
          },
        }),
        saveMemoryRecord: (input) => {
          calls.push({
            userId: input.userId,
            kind: input.kind,
            content: input.content,
            metadata: input.metadata ?? {},
          });
          return Promise.resolve(undefined);
        },
      }
    );

    assert.equal(response.status, 307);
    assert.match(
      response.headers.get("location") ?? "",
      /\/\?virgilToast=share_saved$/
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.userId, "user-1");
    assert.equal(calls[0]?.kind, "note");
    assert.match(calls[0]?.content ?? "", /Useful note/);
  });
});
