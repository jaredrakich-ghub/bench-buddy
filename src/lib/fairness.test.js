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
});
