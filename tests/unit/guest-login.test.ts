import assert from "node:assert/strict";
import test from "node:test";

import { isGuestLoginEnabled } from "@/lib/guest-login";

test("guest login off when env unset", () => {
  const prev = process.env.VIRGIL_GUEST_LOGIN_ENABLED;
  try {
    delete process.env.VIRGIL_GUEST_LOGIN_ENABLED;
    assert.equal(isGuestLoginEnabled(), false);
  } finally {
    if (prev === undefined) {
      delete process.env.VIRGIL_GUEST_LOGIN_ENABLED;
    } else {
      process.env.VIRGIL_GUEST_LOGIN_ENABLED = prev;
    }
  }
});

test("guest login off when 0", () => {
  const prev = process.env.VIRGIL_GUEST_LOGIN_ENABLED;
  try {
    process.env.VIRGIL_GUEST_LOGIN_ENABLED = "0";
    assert.equal(isGuestLoginEnabled(), false);
  } finally {
    if (prev === undefined) {
      delete process.env.VIRGIL_GUEST_LOGIN_ENABLED;
    } else {
      process.env.VIRGIL_GUEST_LOGIN_ENABLED = prev;
    }
  }
});

test("guest login on for 1 true yes", () => {
  const prev = process.env.VIRGIL_GUEST_LOGIN_ENABLED;
  try {
    process.env.VIRGIL_GUEST_LOGIN_ENABLED = "1";
    assert.equal(isGuestLoginEnabled(), true);
    process.env.VIRGIL_GUEST_LOGIN_ENABLED = "true";
    assert.equal(isGuestLoginEnabled(), true);
    process.env.VIRGIL_GUEST_LOGIN_ENABLED = "yes";
    assert.equal(isGuestLoginEnabled(), true);
  } finally {
    if (prev === undefined) {
      delete process.env.VIRGIL_GUEST_LOGIN_ENABLED;
    } else {
      process.env.VIRGIL_GUEST_LOGIN_ENABLED = prev;
    }
  }
});
