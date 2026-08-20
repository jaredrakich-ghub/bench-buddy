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
    expect(gk.topPct).toBe(78);
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
    // 4 outfielders -> ceil(4/2) = 2 in back row (topPct 56), 2 in front row (topPct 18)
    const rows = layout.filter((p) => p.id !== "gk1").map((p) => p.topPct);
    expect(rows.filter((t) => t === 56).length).toBe(2);
    expect(rows.filter((t) => t === 18).length).toBe(2);
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

  it("stretches a row of 2 further from the center circle than a naive even split would", () => {
    // 4 outfielders, no GK -> 2 rows of 2 (perRow = ceil(4/2) = 2) — a
    // genuine row of 2, unlike 2 outfielders total (which lands one per row).
    const onField = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, isGk: false }));
    const layout = getFormationLayout(onField);
    const backRowLefts = layout.filter((p) => p.topPct === 56).map((p) => p.leftPct).sort((a, b) => a - b);
    // Naive even split would be 33.3/66.7 — stretched, they should sit
    // further out than that on both sides.
    expect(backRowLefts[0]).toBeLessThan(33.3);
    expect(backRowLefts[1]).toBeGreaterThan(66.7);
  });

  it("leaves a lone player in a row centered — nothing to stretch away from", () => {
    const onField = [{ id: "p1", isGk: false }];
    const layout = getFormationLayout(onField);
    expect(layout[0].leftPct).toBe(50);
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
    // The 3-row case uses its own front/back-row pair (18/61, not the
    // 2-row case's 18/56) — see formation.js's own comment on why.
    expect(rowValues.sort((a, b) => a - b)).toEqual([18, 39.5, 61]);
    // 6 outfielders split evenly across 3 rows of 2.
    const counts = rowValues.map((t) => layout.filter((p) => p.topPct === t).length);
    expect(counts).toEqual([2, 2, 2]);
  });

  it("gives the goalkeeper its own bottom clearance in the 3-row case (not the 2-row's 78)", () => {
    const onField = [
      { id: "gk1", isGk: true },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, isGk: false })),
    ];
    const layout = getFormationLayout(onField);
    const gk = layout.find((p) => p.id === "gk1");
    // Independently tuned from the outfield rows' own front/back pair —
    // real-device feedback wanted the outfield group to move without
    // moving the goalkeeper, so this is no longer derived from
    // frontRowTopPct by a symmetry formula.
    expect(gk.topPct).toBe(87);
  });

  it("still uses 2 rows at exactly the 4-outfielder boundary, not 3", () => {
    const onField = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, isGk: false }));
    const layout = getFormationLayout(onField);
    const rowValues = [...new Set(layout.map((p) => p.topPct))];
    expect(rowValues.sort((a, b) => a - b)).toEqual([18, 56]);
  });

  it("keeps every player on the pitch when rows split unevenly (7 outfielders across 3 rows)", () => {
    const onField = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, isGk: false }));
    const layout = getFormationLayout(onField);
    expect(layout.length).toBe(7);
    expect(new Set(layout.map((p) => p.id)).size).toBe(7); // nobody dropped or duplicated
  });
});

describe("computeTokenSize", () => {
  it("uses the full 48px size for a typical 5-a-side game (4 or fewer outfielders)", () => {
    expect(computeTokenSize(4)).toBe(48);
    expect(computeTokenSize(1)).toBe(48);
  });

  it("shrinks tokens for a mid-size game (5-6 outfielders)", () => {
    expect(computeTokenSize(5)).toBe(40);
    expect(computeTokenSize(6)).toBe(40);
  });

  it("shrinks tokens further for a larger game (7+ outfielders)", () => {
    expect(computeTokenSize(7)).toBe(34);
    expect(computeTokenSize(10)).toBe(34);
  });
});
