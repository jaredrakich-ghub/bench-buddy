import { describe, it, expect } from "vitest";
import { getFairnessState } from "./fairness.js";

describe("getFairnessState", () => {
  it("within 1 interval's worth of gap is always Fair, regardless of interval length", () => {
    expect(getFairnessState(0, 5).key).toBe("fair");
    expect(getFairnessState(5, 5).key).toBe("fair"); // exactly 1 interval
    expect(getFairnessState(7, 7).key).toBe("fair"); // longer interval, still just 1 interval's worth
  });

  it("2 intervals' worth is Fair when that's still <=10 real minutes (short sub windows)", () => {
    // 2 x 5 = 10 — the given boundary example.
    expect(getFairnessState(10, 5).key).toBe("fair");
    // 2 x 4 = 8
    expect(getFairnessState(8, 4).key).toBe("fair");
  });

  it("2 intervals' worth is Nearly fair once that exceeds 10 real minutes (longer sub windows)", () => {
    // 2 x 6 = 12
    expect(getFairnessState(12, 6)).toMatchObject({ key: "nearlyFair", ring: "#F5B93B", tilt: 9, label: "Nearly fair", toast: "Nearly even" });
    // 2 x 7 = 14
    expect(getFairnessState(14, 7).key).toBe("nearlyFair");
  });

  it("3+ intervals' worth of gap always needs attention, regardless of interval length", () => {
    expect(getFairnessState(15, 5)).toMatchObject({
      key: "needsAttention", ring: "#C4482A", tilt: 21, label: "Needs attention", toast: "Evening it up",
    });
    expect(getFairnessState(12, 4).key).toBe("needsAttention"); // 3 x 4 = 12, short interval doesn't earn a pass past 3 intervals
    expect(getFairnessState(30, 7).key).toBe("needsAttention");
  });

  it("Fair state carries the expected mark values", () => {
    expect(getFairnessState(0, 5)).toMatchObject({ key: "fair", ring: "#2E7D53", tilt: 0, label: "Fair", toast: "Subs still fair" });
  });

  // gameMinutes omitted (2-arg calls) above are the pre-existing,
  // interval-only behavior — every real caller in the app always has a
  // plan to derive gameMinutes from, so this is purely a defensive
  // fallback, not a real code path.
  it("without gameMinutes, behaves exactly as before — a 2-arg call is not a broken call", () => {
    expect(getFairnessState(12, 6, undefined).key).toBe("nearlyFair");
  });
});

// Real-use feedback, validated against real generated plans (both engines)
// before landing: interval-scaled bands alone can't tell "this spread in a
// short game" apart from "the same spread in a long game" the way a share
// of the whole game can. Owner's own thresholds (<=20% fair, 21-29%
// nearly fair, >=30% needs attention) only take over when they disagree
// with the interval-scaled bands — every case below uses real numbers
// verified against an actual generated plan, not invented ones.
describe("getFairnessState — combined with gameMinutes", () => {
  it("agrees with the interval-only bands when both already agree — no change", () => {
    // 0-min spread: both bands trivially agree it's fair, any game length.
    expect(getFairnessState(0, 5, 45).key).toBe("fair");
  });

  // Real generated-plan numbers (5-a-side, 7 players, 20-min game, 9-10 min
  // subs): a 10-min spread reads "Fair" by the interval bands alone
  // (spread == intervalLen == 10) — but that's literally half of a
  // 20-minute game, one kid playing it all while another gets half. The
  // % dimension (50%) correctly overrides it to "needs attention".
  it("escalates past the interval-only verdict for a severe spread in a short game", () => {
    expect(getFairnessState(10, 10, 20).key).toBe("needsAttention");
  });

  // Real generated-plan numbers (5-a-side, 7 players, 60-min game, 7-min
  // subs): an 8-min spread reads "Nearly fair" by the interval bands alone
  // (2 intervals' worth, over the 10-min short-window ceiling) — but
  // that's only 13% of a full 60-minute game. The % dimension correctly
  // pulls it back down to "Fair".
  it("relaxes past the interval-only verdict for a modest spread in a long game", () => {
    expect(getFairnessState(8, 6.666666666666667, 60).key).toBe("fair");
  });

  // Real generated-plan numbers (7-a-side, 9 players, 40-min game, 6-min
  // subs): a 12-min spread is 2 intervals' worth over the short-window
  // ceiling (interval bands: "needs attention") AND 30% of the game (% own
  // bands: also "needs attention") — both genuinely agree here, not a
  // coincidence of the combination rule papering over a real disagreement.
  it("stays needs-attention when both bands independently agree it's genuinely unfair", () => {
    expect(getFairnessState(12, 5.714285714285714, 40).key).toBe("needsAttention");
  });
});
