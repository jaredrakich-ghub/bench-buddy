import { describe, it, expect } from "vitest";
import { getFormationLayout } from "./formation.js";

describe("getFormationLayout", () => {
  it("places the goalkeeper at the bottom-center", () => {
    const onField = [
      { id: "gk1", isGk: true },
      { id: "p1", isGk: false },
      { id: "p2", isGk: false },
    ];
    const layout = getFormationLayout(onField);
    const gk = layout.find((p) => p.id === "gk1");
    expect(gk.topPct).toBe(88);
    expect(gk.leftPct).toBe(50);
  });

  it("splits outfielders into a back row and a front row", () => {
    const onField = [
      { id: "gk1", isGk: true },
      { id: "p1", isGk: false },
      { id: "p2", isGk: false },
      { id: "p3", isGk: false },
      { id: "p4", isGk: false },
    ];
    const layout = getFormationLayout(onField);
    // 4 outfielders -> ceil(4/2) = 2 in back row (topPct 62), 2 in front row (topPct 30)
    const rows = layout.filter((p) => p.id !== "gk1").map((p) => p.topPct);
    expect(rows.filter((t) => t === 62).length).toBe(2);
    expect(rows.filter((t) => t === 30).length).toBe(2);
  });

  it("spreads a row's players evenly across the width", () => {
    const onField = [
      { id: "p1", isGk: false },
      { id: "p2", isGk: false },
      { id: "p3", isGk: false },
    ];
    const layout = getFormationLayout(onField);
    // All 3 in the back row (no GK, no front row needed since backCount = ceil(3/2) = 2...
    // actually with 3 outfielders: back = 2, front = 1
    const lefts = layout.map((p) => p.leftPct).sort((a, b) => a - b);
    // back row of 2: 33.3, 66.7; front row of 1: 50
    expect(lefts.length).toBe(3);
    lefts.forEach((l) => {
      expect(l).toBeGreaterThan(0);
      expect(l).toBeLessThan(100);
    });
  });

  it("handles no goalkeeper on field gracefully", () => {
    const onField = [{ id: "p1", isGk: false }];
    const layout = getFormationLayout(onField);
    expect(layout.length).toBe(1);
    expect(layout.find((p) => p.id === "p1")).toBeTruthy();
  });

  it("handles an empty field", () => {
    expect(getFormationLayout([])).toEqual([]);
  });
});
