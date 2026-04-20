import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("deployment capabilities panel exposes Run probe now when delegation configured", async () => {
  const source = await readFile(
    new URL(
      "../../components/deployment/capabilities-panel.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /data-testid="deployment-run-probe"/);
  assert.match(source, />[\s\n]*Run probe now[\s\n]*</);
  assert.match(
    source,
    /Ping health first so operator sees fresh route-level status/
  );
  assert.match(source, /Delegation probe refreshed\./);
  assert.match(source, /await fetch\(DELEGATION_HEALTH_URL\)/);
  assert.match(
    source,
    /fetchCapabilities\(`\$\{CAPABILITIES_URL\}\?refresh=1`\)/
  );
});
