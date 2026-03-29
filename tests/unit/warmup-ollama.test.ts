import assert from "node:assert/strict";
import test from "node:test";
import { warmupOllamaModel } from "@/lib/ai/warmup-ollama";

test("warmupOllamaModel POSTs generate with keep_alive -1", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    assert.match(url, /\/api\/generate$/);
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      model: string;
      keep_alive: number;
      stream: boolean;
      prompt: string;
    };
    assert.equal(body.model, "qwen2.5:3b");
    assert.equal(body.keep_alive, -1);
    assert.equal(body.stream, false);
    assert.equal(body.prompt, ".");

    return Promise.resolve(
      new Response(JSON.stringify({ done: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof fetch;

  try {
    await warmupOllamaModel({
      baseUrl: "http://127.0.0.1:11434",
      modelId: "ollama/qwen2.5:3b-turbo",
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("warmupOllamaModel throws on HTTP error", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (() =>
    Promise.resolve(new Response("no", { status: 500 }))) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        warmupOllamaModel({
          baseUrl: "http://127.0.0.1:11434",
          modelId: "ollama/qwen2.5:3b",
        }),
      /HTTP 500/
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
