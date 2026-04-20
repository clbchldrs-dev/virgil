import assert from "node:assert/strict";
import test from "node:test";

const KEYS = [
  "OPENCLAW_URL",
  "OPENCLAW_HTTP_URL",
  "OPENCLAW_EXECUTE_PATH",
  "OPENCLAW_SKILLS_PATH",
  "OPENCLAW_HEALTH_PATH",
  "OPENCLAW_GATEWAY_TOOLS_INVOKE",
  "OPENCLAW_SKILLS_STATIC",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  fn: () => void
) {
  const saved: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      Reflect.deleteProperty(process.env, k);
    } else {
      process.env[k] = v;
    }
  }
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) {
        Reflect.deleteProperty(process.env, k);
      } else {
        process.env[k] = saved[k];
      }
    }
  }
}

import {
  getOpenClawExecutePath,
  getOpenClawHealthPath,
  getOpenClawHttpOrigin,
  getOpenClawSkillsPath,
  getOpenClawStaticSkillNames,
  isOpenClawConfigured,
  mergeOpenClawSkillNameLists,
  usesOpenClawToolsInvokePath,
} from "../../lib/integrations/openclaw-config";

test("isOpenClawConfigured false when both vars unset", () => {
  withEnv({ OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: undefined }, () => {
    assert.equal(isOpenClawConfigured(), false);
  });
});

test("isOpenClawConfigured true with OPENCLAW_URL only", () => {
  withEnv(
    { OPENCLAW_URL: "ws://host:3100", OPENCLAW_HTTP_URL: undefined },
    () => {
      assert.equal(isOpenClawConfigured(), true);
    }
  );
});

test("isOpenClawConfigured true with OPENCLAW_HTTP_URL only", () => {
  withEnv(
    { OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: "http://host:3100" },
    () => {
      assert.equal(isOpenClawConfigured(), true);
    }
  );
});

test("getOpenClawHttpOrigin prefers OPENCLAW_HTTP_URL", () => {
  withEnv(
    {
      OPENCLAW_URL: "ws://other:3100",
      OPENCLAW_HTTP_URL: "http://preferred:4000",
    },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "http://preferred:4000");
    }
  );
});

test("getOpenClawHttpOrigin strips trailing slash", () => {
  withEnv(
    { OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: "http://host:3100/" },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "http://host:3100");
    }
  );
});

test("getOpenClawHttpOrigin normalizes explicit URL with path/query", () => {
  withEnv(
    {
      OPENCLAW_URL: undefined,
      OPENCLAW_HTTP_URL: "https://example.internal:8443/api/skills?x=1",
    },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "https://example.internal:8443");
    }
  );
});

test("getOpenClawHttpOrigin rejects unsupported explicit protocols", () => {
  withEnv(
    { OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: "ftp://host:21" },
    () => {
      assert.equal(getOpenClawHttpOrigin(), null);
    }
  );
});

test("getOpenClawHttpOrigin derives http from ws URL", () => {
  withEnv(
    { OPENCLAW_URL: "ws://host:3100", OPENCLAW_HTTP_URL: undefined },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "http://host:3100");
    }
  );
});

test("getOpenClawHttpOrigin derives https from wss URL", () => {
  withEnv(
    { OPENCLAW_URL: "wss://host:443", OPENCLAW_HTTP_URL: undefined },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "https://host");
    }
  );
  withEnv(
    { OPENCLAW_URL: "wss://host:4430", OPENCLAW_HTTP_URL: undefined },
    () => {
      assert.equal(getOpenClawHttpOrigin(), "https://host:4430");
    }
  );
});

test("getOpenClawHttpOrigin returns null for invalid URL", () => {
  withEnv({ OPENCLAW_URL: "not-a-url", OPENCLAW_HTTP_URL: undefined }, () => {
    assert.equal(getOpenClawHttpOrigin(), null);
  });
});

test("getOpenClawHttpOrigin returns null when both unset", () => {
  withEnv({ OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: undefined }, () => {
    assert.equal(getOpenClawHttpOrigin(), null);
  });
});

test("path helpers return defaults when env unset", () => {
  withEnv(
    {
      OPENCLAW_EXECUTE_PATH: undefined,
      OPENCLAW_SKILLS_PATH: undefined,
      OPENCLAW_HEALTH_PATH: undefined,
    },
    () => {
      assert.equal(getOpenClawExecutePath(), "/api/execute");
      assert.equal(getOpenClawSkillsPath(), "/api/skills");
      assert.equal(getOpenClawHealthPath(), "/health");
    }
  );
});

test("path helpers use env when set", () => {
  withEnv(
    {
      OPENCLAW_EXECUTE_PATH: "/v2/run",
      OPENCLAW_SKILLS_PATH: "/v2/skills",
      OPENCLAW_HEALTH_PATH: "/v2/ping",
    },
    () => {
      assert.equal(getOpenClawExecutePath(), "/v2/run");
      assert.equal(getOpenClawSkillsPath(), "/v2/skills");
      assert.equal(getOpenClawHealthPath(), "/v2/ping");
    }
  );
});

test("usesOpenClawToolsInvokePath when execute path or flag matches", () => {
  withEnv(
    {
      OPENCLAW_GATEWAY_TOOLS_INVOKE: undefined,
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
    },
    () => {
      assert.equal(usesOpenClawToolsInvokePath(), true);
    }
  );
  withEnv(
    {
      OPENCLAW_GATEWAY_TOOLS_INVOKE: "1",
      OPENCLAW_EXECUTE_PATH: "/api/execute",
    },
    () => {
      assert.equal(usesOpenClawToolsInvokePath(), true);
    }
  );
  withEnv(
    {
      OPENCLAW_GATEWAY_TOOLS_INVOKE: undefined,
      OPENCLAW_EXECUTE_PATH: "/api/execute",
    },
    () => {
      assert.equal(usesOpenClawToolsInvokePath(), false);
    }
  );
});

test("getOpenClawStaticSkillNames parses comma list", () => {
  withEnv({ OPENCLAW_SKILLS_STATIC: " web , wiki-embed ,web " }, () => {
    assert.deepEqual(getOpenClawStaticSkillNames(), ["web", "wiki-embed"]);
  });
});

test("mergeOpenClawSkillNameLists dedupes and sorts", () => {
  assert.deepEqual(mergeOpenClawSkillNameLists(["b", "a"], ["a", "c"]), [
    "a",
    "b",
    "c",
  ]);
});
