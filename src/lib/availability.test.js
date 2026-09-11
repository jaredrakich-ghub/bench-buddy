import { describe, it, expect } from "vitest";
import {
  generateAvailabilityToken,
  createAvailabilityRequest,
  isRequestClosed,
  isRequestStale,
  defaultClosingAt,
  reopenAvailabilityRequest,
  canAnswer,
  buildAnswer,
  summarizeAnswers,
  describeReplyState,
  describeSetupSummary,
  waitingChildren,
  formatMatchWhen,
  formatDateStringFull,
  formatTimeStringAmPm,
  formatFixture,
  buildShareMessage,
  buildNudgeMessage,
  NOTE_CHIP_OPTIONS,
} from "./availability.js";

const NOW = 1_000_000_000_000;

const SQUAD = [
  { id: "p1", name: "Alex", number: 1 },
  { id: "p2", name: "Ben", number: 2 },
  { id: "p3", name: "Charlie", number: 3 },
];

describe("NOTE_CHIP_OPTIONS", () => {
  it("has exactly the two preset chips parents can pick — no goalkeeper note (real-use feedback: not wanted)", () => {
    expect(NOTE_CHIP_OPTIONS.map((c) => c.key)).toEqual(["late", "early"]);
  });
});

describe("generateAvailabilityToken", () => {
  it("returns a real, non-empty, unique string each call", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateAvailabilityToken()));
    expect(seen.size).toBe(50);
    expect([...seen][0].length).toBeGreaterThan(10);
  });
});

describe("createAvailabilityRequest", () => {
  it("builds a fresh, unanswered request with an empty answers map", () => {
    const req = createAvailabilityRequest({ createdBy: "coach-uid", closingAt: NOW + 60_000, squad: SQUAD });
    expect(req.createdBy).toBe("coach-uid");
    expect(req.closingAt).toBe(NOW + 60_000);
    expect(req.revokedAt).toBeNull();
    expect(req.reopenedAt).toBeNull();
    expect(req.squad).toBe(SQUAD);
    expect(req.answers).toEqual({});
    expect(typeof req.token).toBe("string");
  });

  it("mints a different token on every call — regenerating means a genuinely new one", () => {
    const a = createAvailabilityRequest({ createdBy: "coach-uid", closingAt: NOW, squad: SQUAD });
    const b = createAvailabilityRequest({ createdBy: "coach-uid", closingAt: NOW, squad: SQUAD });
    expect(a.token).not.toBe(b.token);
  });
});

describe("isRequestClosed — display framing only, never a gate", () => {
  it("is false before closingAt", () => {
    expect(isRequestClosed({ closingAt: NOW + 1 }, NOW)).toBe(false);
  });

  it("is true at and after closingAt", () => {
    expect(isRequestClosed({ closingAt: NOW }, NOW)).toBe(true);
    expect(isRequestClosed({ closingAt: NOW - 1 }, NOW)).toBe(true);
  });

  it("is false for no request at all", () => {
    expect(isRequestClosed(null, NOW)).toBe(false);
  });
});

describe("isRequestStale — a request whose own match has already happened", () => {
  it("is false before matchAt", () => {
    expect(isRequestStale({ matchAt: NOW + 1 }, NOW)).toBe(false);
  });

  it("is true at and after matchAt", () => {
    expect(isRequestStale({ matchAt: NOW }, NOW)).toBe(true);
    expect(isRequestStale({ matchAt: NOW - 1 }, NOW)).toBe(true);
  });

  it("ignores closingAt/revokedAt entirely — staleness is about the match, not the RSVP window", () => {
    expect(isRequestStale({ matchAt: NOW + 1000, closingAt: NOW - 1000, revokedAt: NOW - 1 }, NOW)).toBe(false);
  });

  it("is false for no request at all, or one with no matchAt", () => {
    expect(isRequestStale(null, NOW)).toBe(false);
    expect(isRequestStale({}, NOW)).toBe(false);
  });
});

describe("defaultClosingAt", () => {
  it("is exactly 24 hours after matchAt", () => {
    expect(defaultClosingAt(NOW)).toBe(NOW + 24 * 60 * 60 * 1000);
  });
});

describe("reopenAvailabilityRequest", () => {
  it("records reopenedAt when pushing a already-passed closing time later", () => {
    const req = { closingAt: NOW - 1000, reopenedAt: null };
    const reopened = reopenAvailabilityRequest(req, NOW + 60_000, NOW);
    expect(reopened.closingAt).toBe(NOW + 60_000);
    expect(reopened.reopenedAt).toBe(NOW);
  });

  it("leaves reopenedAt untouched when the closing time hadn't passed yet — this is just a normal edit", () => {
    const req = { closingAt: NOW + 60_000, reopenedAt: null };
    const edited = reopenAvailabilityRequest(req, NOW + 120_000, NOW);
    expect(edited.reopenedAt).toBeNull();
  });
});

describe("canAnswer — the token's own gate", () => {
  it("is true for a live, unrevoked request regardless of closing time", () => {
    expect(canAnswer({ revokedAt: null, closingAt: NOW - 1000 })).toBe(true); // closed, still answerable
  });

  it("is false once revoked", () => {
    expect(canAnswer({ revokedAt: NOW - 1 })).toBe(false);
  });

  it("is false with no request at all", () => {
    expect(canAnswer(null)).toBe(false);
  });
});

describe("buildAnswer", () => {
  it("sets answeredAt and changedAt to now on a first answer", () => {
    const answer = buildAnswer({ status: "in", noteChips: ["late"], noteText: "Traffic" }, null, NOW);
    expect(answer).toEqual({ status: "in", noteChips: ["late"], noteText: "Traffic", answeredAt: NOW, changedAt: NOW });
  });

  it("carries the original answeredAt forward on a re-answer, only changedAt moves", () => {
    const reAnswer = buildAnswer({ status: "out", noteChips: [], noteText: "" }, NOW - 5000, NOW);
    expect(reAnswer.answeredAt).toBe(NOW - 5000);
    expect(reAnswer.changedAt).toBe(NOW);
  });

  it("defaults noteChips/noteText when omitted", () => {
    const answer = buildAnswer({ status: "in" }, null, NOW);
    expect(answer.noteChips).toEqual([]);
    expect(answer.noteText).toBe("");
  });
});

describe("summarizeAnswers / describeReplyState", () => {
  it("counts in/out/waiting correctly against the full squad", () => {
    const answers = { p1: { status: "in" }, p2: { status: "out" } };
    expect(summarizeAnswers(SQUAD, answers)).toEqual({ total: 3, inCount: 1, outCount: 1, answeredCount: 2, waitingCount: 1 });
  });

  it("reply state says nobody's answered when the map is empty", () => {
    expect(describeReplyState(SQUAD, {})).toBe("Nobody has answered yet.");
  });

  it("reply state counts once someone has", () => {
    expect(describeReplyState(SQUAD, { p1: { status: "in" } })).toBe("1 of 3 answered");
  });
});

describe("describeSetupSummary", () => {
  it("returns null when nobody has answered yet — 1d has nothing to summarize", () => {
    expect(describeSetupSummary(SQUAD, {})).toBeNull();
  });

  it("names a single out child", () => {
    const answers = { p1: { status: "in" }, p2: { status: "out" }, p3: { status: "in" } };
    expect(describeSetupSummary(SQUAD, answers)).toBe("3 of 3 answered your link. Ben is out.");
  });

  it("mentions waiting children when some haven't replied", () => {
    const answers = { p1: { status: "in" } };
    expect(describeSetupSummary(SQUAD, answers)).toBe("1 of 3 answered your link. 2 haven't replied.");
  });

  it("caps named 'out' children and folds the rest into a '+N more'", () => {
    const bigSquad = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, number: i + 1 }));
    const answers = Object.fromEntries(bigSquad.map((p) => [p.id, { status: "out" }]));
    expect(describeSetupSummary(bigSquad, answers)).toBe(
      "5 of 5 answered your link. Player 0, Player 1, Player 2 +2 more are out."
    );
  });
});

describe("waitingChildren / buildNudgeMessage", () => {
  it("collects only children with no answer entry at all — in/out both count as answered", () => {
    const answers = { p1: { status: "in" }, p2: { status: "out" } };
    expect(waitingChildren(SQUAD, answers)).toEqual([SQUAD[2]]);
  });

  it("is the whole squad when nobody's answered yet", () => {
    expect(waitingChildren(SQUAD, {})).toEqual(SQUAD);
  });

  it("names one waiting child plainly", () => {
    expect(buildNudgeMessage(["Charlie"])).toBe("Still waiting to hear from Charlie — could you tap the link above and let me know?");
  });

  it("joins two names with 'and', no Oxford comma needed", () => {
    expect(buildNudgeMessage(["Ben", "Charlie"])).toBe(
      "Still waiting to hear from Ben and Charlie — could you tap the link above and let me know?"
    );
  });

  it("joins three or more with commas and a final 'and'", () => {
    expect(buildNudgeMessage(["Alex", "Ben", "Charlie"])).toBe(
      "Still waiting to hear from Alex, Ben and Charlie — could you tap the link above and let me know?"
    );
  });
});

describe("formatMatchWhen / formatFixture / buildShareMessage", () => {
  // A fixed local time, not tied to any particular timezone assumption in
  // the test runner — Sat 13 Sep 2025, 9:30 am.
  const MATCH_AT = new Date(2025, 8, 13, 9, 30).getTime();

  it("formats the date/time as 'Sat 13 Sep · 9:30 am'", () => {
    expect(formatMatchWhen(MATCH_AT)).toBe("Sat 13 Sep · 9:30 am");
  });

  it("pads single-digit minutes and handles the noon/midnight 12-hour edge", () => {
    const fivePastNoon = new Date(2025, 8, 13, 12, 5).getTime();
    expect(formatMatchWhen(fivePastNoon)).toBe("Sat 13 Sep · 12:05 pm");
    const midnight = new Date(2025, 8, 13, 0, 0).getTime();
    expect(formatMatchWhen(midnight)).toBe("Sat 13 Sep · 12:00 am");
  });

  it("formatDateStringFull spells out the weekday and year from a raw 'YYYY-MM-DD' input string", () => {
    expect(formatDateStringFull("2026-09-12")).toBe("Saturday, 12 Sep 2026");
  });

  it("formatDateStringFull is blank for an incomplete or empty date string", () => {
    expect(formatDateStringFull("")).toBe("");
    expect(formatDateStringFull("2026-09")).toBe("");
  });

  it("formatTimeStringAmPm converts a raw 'HH:MM' input string to 12-hour with am/pm", () => {
    expect(formatTimeStringAmPm("09:30")).toBe("9:30 am");
    expect(formatTimeStringAmPm("00:00")).toBe("12:00 am");
    expect(formatTimeStringAmPm("12:05")).toBe("12:05 pm");
    expect(formatTimeStringAmPm("23:59")).toBe("11:59 pm");
  });

  it("formatTimeStringAmPm is blank for an empty time string", () => {
    expect(formatTimeStringAmPm("")).toBe("");
  });

  it("formatFixture includes the opponent when given, falls back to just the team name otherwise", () => {
    expect(formatFixture("Tigers FC", "Rovers")).toBe("Tigers FC v Rovers");
    expect(formatFixture("Tigers FC", "")).toBe("Tigers FC");
  });

  it("buildShareMessage matches the design's own copy exactly, with location", () => {
    const msg = buildShareMessage({ teamName: "Tigers FC", opponent: "Rovers", matchAt: MATCH_AT, location: "Hillcrest Park" });
    expect(msg).toBe(
      "Tigers FC v Rovers, Sat 13 Sep · 9:30 am at Hillcrest Park. Tap your child and let me know if they're in — takes ten seconds."
    );
  });

  it("buildShareMessage drops the 'at <location>' clause when no location was entered", () => {
    const msg = buildShareMessage({ teamName: "Tigers FC", opponent: "", matchAt: MATCH_AT, location: "" });
    expect(msg).toBe("Tigers FC, Sat 13 Sep · 9:30 am. Tap your child and let me know if they're in — takes ten seconds.");
  });
});
