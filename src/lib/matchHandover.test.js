import { describe, it, expect } from "vitest";
import {
  initialExpiresAt,
  expiresAtOnFullTime,
  isHandoverActive,
  canWriteMatch,
  canControlClock,
} from "./matchHandover.js";

const NOW = 1_000_000_000_000; // an arbitrary fixed instant, so "now" never has to be Date.now() in a test

function activeHandover(overrides = {}) {
  return {
    level: "subs",
    createdAt: NOW - 1000,
    createdBy: "coach-uid",
    stopsAtFullTime: true,
    expiresAt: NOW + 60_000,
    revokedAt: null,
    requireEmailClaim: true,
    claimToken: "tok",
    claim: {
      email: "parent@example.com",
      claimedAt: NOW - 500,
      claimedByUid: "parent-uid",
      deviceBoundAt: NOW - 500,
      revokedAt: null,
    },
    ...overrides,
  };
}

describe("initialExpiresAt", () => {
  it("is kickoff plus a 4 hour hard cap", () => {
    const kickoffAt = 500_000;
    expect(initialExpiresAt(kickoffAt)).toBe(kickoffAt + 4 * 60 * 60 * 1000);
  });
});

describe("expiresAtOnFullTime", () => {
  it("brings the expiry forward to now when stopsAtFullTime is on", () => {
    const h = activeHandover({ expiresAt: NOW + 60_000 });
    expect(expiresAtOnFullTime(h, NOW)).toBe(NOW);
  });

  it("leaves the expiry unchanged when stopsAtFullTime is off", () => {
    const h = activeHandover({ stopsAtFullTime: false, expiresAt: NOW + 60_000 });
    expect(expiresAtOnFullTime(h, NOW)).toBe(NOW + 60_000);
  });

  it("does not extend an expiry that's already earlier than now", () => {
    // A late full-time call shouldn't accidentally push expiry later than
    // an already-passed hard cap.
    const h = activeHandover({ expiresAt: NOW - 5_000 });
    expect(expiresAtOnFullTime(h, NOW)).toBe(NOW - 5_000);
  });
});

describe("isHandoverActive", () => {
  it("is true for a genuinely active handover", () => {
    expect(isHandoverActive(activeHandover(), NOW)).toBe(true);
  });

  it("is false when there is no handover at all", () => {
    expect(isHandoverActive(null, NOW)).toBe(false);
  });

  it("is false once the handover itself is revoked", () => {
    expect(isHandoverActive(activeHandover({ revokedAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("is false once expired", () => {
    expect(isHandoverActive(activeHandover({ expiresAt: NOW - 1 }), NOW)).toBe(false);
  });

  it("is false at the exact expiry instant (>=, not >)", () => {
    expect(isHandoverActive(activeHandover({ expiresAt: NOW }), NOW)).toBe(false);
  });

  it("is false when nobody has claimed it yet", () => {
    expect(isHandoverActive(activeHandover({ claim: null }), NOW)).toBe(false);
  });

  it("is false once this specific holder is revoked, even if the handover itself is not", () => {
    const h = activeHandover();
    h.claim.revokedAt = NOW - 1;
    expect(isHandoverActive(h, NOW)).toBe(false);
  });
});

describe("canWriteMatch — subs, injuries, swaps, keeper changes", () => {
  it("the coach can always write, handover or not", () => {
    expect(canWriteMatch("coach", null, NOW)).toBe(true);
    expect(canWriteMatch("coach", activeHandover(), NOW)).toBe(true);
  });

  it("the parent can write only while a handover is genuinely active", () => {
    expect(canWriteMatch("parent", activeHandover(), NOW)).toBe(true);
  });

  it("the parent cannot write with no handover, or a revoked/expired one", () => {
    expect(canWriteMatch("parent", null, NOW)).toBe(false);
    expect(canWriteMatch("parent", activeHandover({ revokedAt: NOW - 1 }), NOW)).toBe(false);
    expect(canWriteMatch("parent", activeHandover({ expiresAt: NOW - 1 }), NOW)).toBe(false);
  });

  // Real-use intent, not just a permission check: both can act on the same
  // match at the same time — this is what makes "last write wins per
  // player" a meaningful rule to have at all.
  it("both the coach and an active holder can write at once", () => {
    const h = activeHandover();
    expect(canWriteMatch("coach", h, NOW)).toBe(true);
    expect(canWriteMatch("parent", h, NOW)).toBe(true);
  });
});

describe("canControlClock — the one exclusive, single-owner control", () => {
  it("the coach owns the clock when there is no active handover", () => {
    expect(canControlClock("coach", null, NOW)).toBe(true);
    expect(canControlClock("parent", null, NOW)).toBe(false);
  });

  it("the parent owns the clock exclusively once their handover is active", () => {
    const h = activeHandover();
    expect(canControlClock("parent", h, NOW)).toBe(true);
    expect(canControlClock("coach", h, NOW)).toBe(false);
  });

  it("ownership is unconditional on level — 'subs' does not keep the clock with the coach", () => {
    // This is the specific real-use correction this model encodes: level is
    // display-only, so a "subs" level handover still hands the clock over,
    // exactly like "full" does.
    const h = activeHandover({ level: "subs" });
    expect(canControlClock("parent", h, NOW)).toBe(true);
    expect(canControlClock("coach", h, NOW)).toBe(false);
  });

  it("ownership reverts to the coach the instant the handover is no longer active", () => {
    const revoked = activeHandover({ revokedAt: NOW - 1 });
    expect(canControlClock("coach", revoked, NOW)).toBe(true);
    expect(canControlClock("parent", revoked, NOW)).toBe(false);
  });
});
