import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  handleBotIdForChatPost,
  isUnverifiedBotChatClient,
} from "@/lib/security/botid-chat";

describe("botid-chat", () => {
  it("allows null / bypassed / humans / verified bots", () => {
    assert.equal(isUnverifiedBotChatClient(null), false);
    assert.equal(
      isUnverifiedBotChatClient({
        bypassed: true,
        isBot: true,
        isHuman: false,
        isVerifiedBot: false,
      }),
      false
    );
    assert.equal(
      isUnverifiedBotChatClient({
        bypassed: false,
        isBot: false,
        isHuman: true,
        isVerifiedBot: false,
      }),
      false
    );
    assert.equal(
      isUnverifiedBotChatClient({
        bypassed: false,
        isBot: true,
        isHuman: false,
        isVerifiedBot: true,
      }),
      false
    );
  });

  it("flags unverified bots", () => {
    assert.equal(
      isUnverifiedBotChatClient({
        bypassed: false,
        isBot: true,
        isHuman: false,
        isVerifiedBot: false,
      }),
      true
    );
  });

  it("handleBotIdForChatPost blocks when enforce and suspicious", () => {
    const bot = {
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    };
    assert.equal(handleBotIdForChatPost({ bot, enforce: true }), "block");
  });

  it("handleBotIdForChatPost allows when not enforcing", () => {
    const bot = {
      bypassed: false,
      isBot: true,
      isHuman: false,
      isVerifiedBot: false,
    };
    assert.equal(handleBotIdForChatPost({ bot, enforce: false }), "allow");
  });
});
