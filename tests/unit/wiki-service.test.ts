import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ingestWikiSource,
  lintWiki,
  queryWiki,
  runDailyWikiMaintenance,
} from "../../lib/wiki/service";

const ROOT_ENV = "VIRGIL_WIKI_ROOT";

async function createWikiRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "virgil-wiki-"));
  await mkdir(path.join(root, "raw"), { recursive: true });
  await mkdir(path.join(root, "wiki", "entities"), { recursive: true });
  await mkdir(path.join(root, "wiki", "sources"), { recursive: true });
  await mkdir(path.join(root, "schema"), { recursive: true });
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

async function withWikiRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await createWikiRoot();
  const prior = process.env[ROOT_ENV];
  process.env[ROOT_ENV] = root;
  try {
    return await fn(root);
  } finally {
    if (prior === undefined) {
      Reflect.deleteProperty(process.env, ROOT_ENV);
    } else {
      process.env[ROOT_ENV] = prior;
    }
  }
}

test("ingestWikiSource writes source page and updates index/log", async () => {
  await withWikiRoot(async (root) => {
    await writeFile(
      path.join(root, "raw", "journal-entry.md"),
      "# Day notes\n\nI worked on Hermes bridge tasks.\nNeed review tomorrow.",
      "utf8"
    );

    const result = await ingestWikiSource("journal-entry.md");
    assert.equal(result.action, "ingest");
    assert.equal(result.indexUpdated, true);
    assert.equal(result.logUpdated, true);

    const sourcePage = await readFile(
      path.join(root, "wiki", "sources", "journal-entry.md"),
      "utf8"
    );
    assert.match(sourcePage, /# Source note: journal-entry\.md/);
    assert.match(sourcePage, /## Provenance/);

    const index = await readFile(path.join(root, "wiki", "index.md"), "utf8");
    assert.match(index, /\[\[sources\/journal-entry\]\]/);

    const log = await readFile(path.join(root, "wiki", "log.md"), "utf8");
    assert.match(log, /ingest \| journal-entry\.md/);
  });
});

test("queryWiki returns snippet matches from wiki pages", async () => {
  await withWikiRoot(async (root) => {
    await writeFile(
      path.join(root, "wiki", "entities", "virgil.md"),
      "# Entity: Virgil\n\nVirgil runs a Hermes bridge.\n\n## Provenance\n- `raw/input.md`",
      "utf8"
    );
    const result = await queryWiki("Hermes bridge");
    assert.equal(result.action, "query");
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0]?.file, "entities/virgil.md");
    assert.match(result.matches[0]?.snippet ?? "", /Hermes bridge/i);
  });
});

test("lintWiki reports provenance and orphan issues", async () => {
  await withWikiRoot(async (root) => {
    await writeFile(
      path.join(root, "wiki", "entities", "orphan.md"),
      "# Entity: Orphan\n\nNo links in. Missing provenance.",
      "utf8"
    );
    await writeFile(
      path.join(root, "wiki", "entities", "linked.md"),
      "# Entity: Linked\n\n## Provenance\n- `raw/input.md`",
      "utf8"
    );
    await writeFile(
      path.join(root, "wiki", "index.md"),
      "# Wiki index\n\n## Entities\n\n- [[entities/linked]]\n",
      "utf8"
    );
    const result = await lintWiki();
    assert.equal(result.action, "lint");
    const orphan = result.issues.find(
      (issue) => issue.file === "entities/orphan.md"
    );
    assert.ok(orphan);
    assert.equal(orphan?.code, "missing_provenance");
    const orphanInbound = result.issues.find(
      (issue) =>
        issue.file === "entities/orphan.md" && issue.code === "orphan_page"
    );
    assert.ok(orphanInbound);
  });
});

test("runDailyWikiMaintenance writes daily review and updates index/log", async () => {
  await withWikiRoot(async (root) => {
    await writeFile(
      path.join(root, "wiki", "entities", "project-alpha.md"),
      "# Project alpha\n\nThis project needs updates.\n\n## Provenance\n- `raw/input.md`",
      "utf8"
    );
    await writeFile(
      path.join(root, "wiki", "index.md"),
      "# Wiki index\n\n## Entities\n\n- [[entities/project-alpha]]\n",
      "utf8"
    );
    const result = await runDailyWikiMaintenance();
    assert.equal(result.action, "daily");
    assert.equal(result.logUpdated, true);
    assert.match(result.reviewPageRelativePath, /^daily\/\d{4}-\d{2}-\d{2}$/);

    const reviewPath = path.join(
      root,
      "wiki",
      `${result.reviewPageRelativePath}.md`
    );
    const review = await readFile(reviewPath, "utf8");
    assert.match(review, /# Daily wiki review:/);
    assert.match(review, /Project signal query/);

    const index = await readFile(path.join(root, "wiki", "index.md"), "utf8");
    assert.match(index, /\[\[daily\/\d{4}-\d{2}-\d{2}\]\]/);

    const log = await readFile(path.join(root, "wiki", "log.md"), "utf8");
    assert.match(log, /daily \| wiki-maintenance/);
  });
});
