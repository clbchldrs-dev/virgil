import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chatVoteAccessVirgilError,
  documentRowAccessVirgilError,
  suggestionWrongOwnerVirgilError,
} from "@/lib/security/idor";

describe("idor — chat vote", () => {
  const chat = { userId: "owner-1" };

  it("returns not_found when chat missing", () => {
    const err = chatVoteAccessVirgilError({
      chat: null,
      sessionUserId: "owner-1",
      notFoundCode: "not_found:chat",
    });
    assert.equal(err?.type, "not_found");
    assert.equal(err?.surface, "chat");
  });

  it("returns forbidden when chat owned by another user", () => {
    const err = chatVoteAccessVirgilError({
      chat,
      sessionUserId: "other",
      notFoundCode: "not_found:vote",
    });
    assert.equal(err?.type, "forbidden");
    assert.equal(err?.surface, "vote");
  });

  it("allows owner", () => {
    assert.equal(
      chatVoteAccessVirgilError({
        chat,
        sessionUserId: "owner-1",
        notFoundCode: "not_found:vote",
      }),
      null
    );
  });
});

describe("idor — suggestion row", () => {
  it("rejects wrong owner", () => {
    const err = suggestionWrongOwnerVirgilError({ userId: "a" }, "b");
    assert.equal(err?.type, "forbidden");
    assert.equal(err?.surface, "api");
  });

  it("allows owner", () => {
    assert.equal(suggestionWrongOwnerVirgilError({ userId: "a" }, "a"), null);
  });
});

describe("idor — document row", () => {
  const doc = { userId: "u1" };

  it("returns not_found when document missing", () => {
    const err = documentRowAccessVirgilError({
      document: undefined,
      sessionUserId: "u1",
    });
    assert.equal(err?.type, "not_found");
  });

  it("returns forbidden for cross-user", () => {
    const err = documentRowAccessVirgilError({
      document: doc,
      sessionUserId: "u2",
    });
    assert.equal(err?.type, "forbidden");
  });

  it("allows owner", () => {
    assert.equal(
      documentRowAccessVirgilError({
        document: doc,
        sessionUserId: "u1",
      }),
      null
    );
  });
});
