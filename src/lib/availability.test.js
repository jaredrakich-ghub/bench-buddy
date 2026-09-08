import { describe, it, expect } from "vitest";
import {
  generateAvailabilityToken,
  createAvailabilityRequest,
  isRequestClosed,
  reopenAvailabilityRequest,
  canAnswer,
  buildAnswer,
  summarizeAnswers,
  describeReplyState,
  describeSetupSummary,
  keeperNoteIds,
  hasNoteChip,
  NOTE_CHIP_OPTIONS,
} from "./availability.js";

const NOW = 1_000_000_000_000;

const SQUAD = [
  { id: "p1", name: "Alex", number: 1 },
  { id: "p2", name: "Ben", number: 2 },
  { id: "p3", name: "Charlie", number: 3 },
];

describe("NOTE_CHIP_OPTIONS", () => {
  it("has exactly the three preset chips the README specifies", () => {
    expect(NOTE_CHIP_OPTIONS.map((c) => c.key)).toEqual(["late", "early", "goalkeeper"]);
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

describe("keeperNoteIds / hasNoteChip", () => {
  it("collects only the children who noted 'Can keep goal' this match", () => {
    const answers = {
      p1: { status: "in", noteChips: ["goalkeeper"] },
      p2: { status: "in", noteChips: ["late"] },
      p3: { status: "in", noteChips: ["goalkeeper", "early"] },
    };
    expect(keeperNoteIds(SQUAD, answers)).toEqual(["p1", "p3"]);
  });

  it("is empty when nobody noted it, including when nobody's answered at all", () => {
    expect(keeperNoteIds(SQUAD, {})).toEqual([]);
  });

  it("hasNoteChip looks up a single child's own note without needing the full list", () => {
    const answers = { p1: { status: "in", noteChips: ["late"] } };
    expect(hasNoteChip(answers, "p1", "late")).toBe(true);
    expect(hasNoteChip(answers, "p1", "early")).toBe(false);
    expect(hasNoteChip(answers, "p2", "late")).toBe(false); // never answered at all
  });
});
