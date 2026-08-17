import { describe, it, expect } from "vitest";
import { getFormationLayout, computeTokenSize } from "./formation.js";

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

  it("switches to 3 rows once there are enough outfielders (5+), instead of a lopsided 2-row split", () => {
    const onField = [
      { id: "gk1", isGk: true },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, isGk: false })),
    ];
    const layout = getFormationLayout(onField);
    const rowValues = [...new Set(layout.filter((p) => p.id !== "gk1").map((p) => p.topPct))];
    expect(rowValues.sort((a, b) => a - b)).toEqual([30, 46, 62]);
    // 6 outfielders split evenly across 3 rows of 2.
    const counts = rowValues.map((t) => layout.filter((p) => p.topPct === t).length);
    expect(counts).toEqual([2, 2, 2]);
  });

  it("still uses 2 rows at exactly the 4-outfielder boundary, not 3", () => {
    const onField = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, isGk: false }));
    const layout = getFormationLayout(onField);
    const rowValues = [...new Set(layout.map((p) => p.topPct))];
    expect(rowValues.sort((a, b) => a - b)).toEqual([30, 62]);
  });

  it("keeps every player on the pitch when rows split unevenly (7 outfielders across 3 rows)", () => {
    const onField = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, isGk: false }));
    const layout = getFormationLayout(onField);
    expect(layout.length).toBe(7);
    expect(new Set(layout.map((p) => p.id)).size).toBe(7); // nobody dropped or duplicated
  });
});

describe("computeTokenSize", () => {
  it("uses the full 40px size for a typical 5-a-side game (4 or fewer outfielders)", () => {
    expect(computeTokenSize(4)).toBe(40);
    expect(computeTokenSize(1)).toBe(40);
  });

  it("shrinks tokens for a mid-size game (5-6 outfielders)", () => {
    expect(computeTokenSize(5)).toBe(34);
    expect(computeTokenSize(6)).toBe(34);
  });

  it("shrinks tokens further for a larger game (7+ outfielders)", () => {
    expect(computeTokenSize(7)).toBe(28);
    expect(computeTokenSize(10)).toBe(28);
  });
});
