import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { GET as dailyGet } from "@/app/api/wiki/daily/route";
import { POST as wikiOpsPost } from "@/app/api/wiki/ops/route";

const ROOT_ENV = "VIRGIL_WIKI_ROOT";

async function createWikiRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "virgil-wiki-routes-"));
  await mkdir(path.join(root, "raw"), { recursive: true });
  await mkdir(path.join(root, "wiki", "entities"), { recursive: true });
  await mkdir(path.join(root, "wiki", "sources"), { recursive: true });
  await writeFile(
    path.join(root, "wiki", "index.md"),
    "# Wiki index\n\n## Entities\n\n- _none yet_\n",
    "utf8"
  );
  await writeFile(
    path.join(root, "wiki", "log.md"),
    "# Wiki operation log (append-only)\n",
    "utf8"
  );
  return root;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key);
  } else {
    process.env[key] = value;
  }
}

test("wiki ops route enforces feature and bearer gates", async () => {
  const prevEnabled = process.env.VIRGIL_WIKI_OPS_ENABLED;
  const prevSecret = process.env.CRON_SECRET;
  const prevRoot = process.env[ROOT_ENV];

  try {
    process.env.VIRGIL_WIKI_OPS_ENABLED = "0";
    process.env.CRON_SECRET = "test-secret";
    process.env[ROOT_ENV] = await createWikiRoot();

    const disabledResponse = await wikiOpsPost(
      new Request("http://localhost/api/wiki/ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "lint" }),
      })
    );
    assert.equal(disabledResponse.status, 403);

    process.env.VIRGIL_WIKI_OPS_ENABLED = "1";
    const unauthorizedResponse = await wikiOpsPost(
      new Request("http://localhost/api/wiki/ops", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "lint" }),
      })
    );
    assert.equal(unauthorizedResponse.status, 401);
  } finally {
    restoreEnv("VIRGIL_WIKI_OPS_ENABLED", prevEnabled);
    restoreEnv("CRON_SECRET", prevSecret);
    restoreEnv(ROOT_ENV, prevRoot);
  }
});

test("wiki ops ingest writes source page, index, and log", async () => {
  const prevEnabled = process.env.VIRGIL_WIKI_OPS_ENABLED;
  const prevSecret = process.env.CRON_SECRET;
  const prevRoot = process.env[ROOT_ENV];

  const root = await createWikiRoot();
  await writeFile(
    path.join(root, "raw", "capture.md"),
    "# Capture\n\nSaved from a channel.",
    "utf8"
  );

  try {
    process.env.VIRGIL_WIKI_OPS_ENABLED = "1";
    process.env.CRON_SECRET = "test-secret";
    process.env[ROOT_ENV] = root;

    const response = await wikiOpsPost(
      new Request("http://localhost/api/wiki/ops", {
        method: "POST",
        headers: {
          authorization: "Bearer test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "ingest",
          sourceRelativePath: "capture.md",
        }),
      })
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.action, "ingest");
    assert.equal(body.sourceRelativePath, "capture.md");

    const sourcePage = await readFile(
      path.join(root, "wiki", "sources", "capture.md"),
      "utf8"
    );
    assert.match(sourcePage, /## Provenance/);

    const index = await readFile(path.join(root, "wiki", "index.md"), "utf8");
    assert.match(index, /\[\[sources\/capture\]\]/);

    const log = await readFile(path.join(root, "wiki", "log.md"), "utf8");
    assert.match(log, /ingest \| capture\.md/);
  } finally {
    restoreEnv("VIRGIL_WIKI_OPS_ENABLED", prevEnabled);
    restoreEnv("CRON_SECRET", prevSecret);
    restoreEnv(ROOT_ENV, prevRoot);
  }
});

test("wiki daily route enforces auth and returns maintenance artifact", async () => {
  const prevEnabled = process.env.VIRGIL_WIKI_DAILY_ENABLED;
  const prevSecret = process.env.CRON_SECRET;
  const prevRoot = process.env[ROOT_ENV];

  const root = await createWikiRoot();
  await writeFile(
    path.join(root, "wiki", "entities", "project-gamma.md"),
    "# Project gamma\n\nProject signal text.\n\n## Provenance\n- `raw/capture.md`",
    "utf8"
  );
  await writeFile(
    path.join(root, "raw", "capture.md"),
    "# Raw source\n\nImmutable for daily route checks.",
    "utf8"
  );

  try {
    process.env.VIRGIL_WIKI_DAILY_ENABLED = "1";
    process.env.CRON_SECRET = "test-secret";
    process.env[ROOT_ENV] = root;

    const unauthorized = await dailyGet(
      new Request("http://localhost/api/wiki/daily")
    );
    assert.equal(unauthorized.status, 401);

    const okResponse = await dailyGet(
      new Request("http://localhost/api/wiki/daily", {
        headers: { authorization: "Bearer test-secret" },
      })
    );
    assert.equal(okResponse.status, 200);

    const body = await okResponse.json();
    assert.equal(body.action, "daily");
    assert.match(body.reviewPageRelativePath, /^daily\/\d{4}-\d{2}-\d{2}$/);

    const review = await readFile(
      path.join(root, "wiki", `${body.reviewPageRelativePath}.md`),
      "utf8"
    );
    assert.match(review, /Daily wiki review/);

    const rawAfter = await readFile(
      path.join(root, "raw", "capture.md"),
      "utf8"
    );
    assert.match(rawAfter, /Immutable for daily route checks/);
  } finally {
    restoreEnv("VIRGIL_WIKI_DAILY_ENABLED", prevEnabled);
    restoreEnv("CRON_SECRET", prevSecret);
    restoreEnv(ROOT_ENV, prevRoot);
  }
});
