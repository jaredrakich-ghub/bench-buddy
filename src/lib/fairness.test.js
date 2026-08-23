import { describe, it, expect } from "vitest";
import { getFairnessState } from "./fairness.js";

describe("getFairnessState", () => {
  it("0-2 min spread is Fair", () => {
    [0, 1, 2].forEach((spread) => {
      expect(getFairnessState(spread)).toMatchObject({ key: "fair", ring: "#2E7D53", tilt: 0, label: "Fair", toast: "Subs still fair" });
    });
  });

  it("3-4 min spread is Nearly fair", () => {
    [3, 4].forEach((spread) => {
      expect(getFairnessState(spread)).toMatchObject({
        key: "nearlyFair", ring: "#F5B93B", tilt: 9, label: "Nearly fair", toast: "Nearly even",
      });
    });
  });

  it("5+ min spread needs attention, with no upper bound", () => {
    [5, 6, 40].forEach((spread) => {
      expect(getFairnessState(spread)).toMatchObject({
        key: "needsAttention", ring: "#C4482A", tilt: 21, label: "Needs attention", toast: "Evening it up",
      });
    });
  });

  it("applies the threshold to a fractional spread directly, not rounded", () => {
    expect(getFairnessState(2.4).key).toBe("nearlyFair"); // already past the "fair" ceiling of 2
    expect(getFairnessState(4.9).key).toBe("needsAttention"); // already past the "nearly fair" ceiling of 4
  });
});
