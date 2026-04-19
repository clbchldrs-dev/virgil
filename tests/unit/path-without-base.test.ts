import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractChatIdFromPathname,
  isChatSurfacePath,
  pathnameWithoutBasePath,
} from "@/lib/path-without-base";

describe("pathnameWithoutBasePath", () => {
  it("returns pathname when basePath is empty", () => {
    assert.equal(pathnameWithoutBasePath("/chat/abc", ""), "/chat/abc");
  });

  it("strips basePath prefix", () => {
    assert.equal(
      pathnameWithoutBasePath("/virgil/chat/x", "/virgil"),
      "/chat/x"
    );
  });

  it("maps base-only path to root", () => {
    assert.equal(pathnameWithoutBasePath("/virgil", "/virgil"), "/");
  });
});

describe("isChatSurfacePath", () => {
  it("treats root and /chat/:id as chat surfaces", () => {
    assert.equal(isChatSurfacePath("/"), true);
    assert.equal(isChatSurfacePath("/chat/uuid"), true);
    assert.equal(isChatSurfacePath("/night-insights"), false);
    assert.equal(isChatSurfacePath("/sophon"), false);
    assert.equal(isChatSurfacePath("/command-center"), false);
  });
});

describe("extractChatIdFromPathname", () => {
  it("reads id from /chat/:id", () => {
    assert.equal(extractChatIdFromPathname("/chat/abc-123", ""), "abc-123");
  });

  it("strips basePath before reading id", () => {
    assert.equal(
      extractChatIdFromPathname("/virgil/chat/xyz", "/virgil"),
      "xyz"
    );
  });

  it("returns null when not on a chat route", () => {
    assert.equal(extractChatIdFromPathname("/preferences", ""), null);
    assert.equal(extractChatIdFromPathname(null, ""), null);
  });
});
