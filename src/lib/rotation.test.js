import { describe, it, expect } from "vitest";
import {
  intervalAtElapsed,
  computeIntervals,
  buildCarryState,
  generatePlan,
  computeMinutesSummary,
} from "./rotation.js";

describe("intervalAtElapsed", () => {
  const plan = [
    { startMin: 0, endMin: 10 },
    { startMin: 10, endMin: 20 },
    { startMin: 20, endMin: 30 },
  ];

  it("returns the index of the interval containing the elapsed time", () => {
    expect(intervalAtElapsed(plan, 0)).toBe(0);
    expect(intervalAtElapsed(plan, 5 * 60)).toBe(0);
    expect(intervalAtElapsed(plan, 10 * 60)).toBe(1);
    expect(intervalAtElapsed(plan, 25 * 60)).toBe(2);
  });

  it("falls back to the last interval once elapsed time runs past the end of the plan", () => {
    expect(intervalAtElapsed(plan, 999 * 60)).toBe(2);
  });

  it("returns 0 for an empty or missing plan", () => {
    expect(intervalAtElapsed([], 100)).toBe(0);
    expect(intervalAtElapsed(null, 100)).toBe(0);
  });
});

describe("computeIntervals", () => {
  it("picks a whole number of intervals close to the target sub interval", () => {
    // 40 minute game, aiming for ~6 min subs -> round(40/6) = 7 intervals
    const { numIntervals, intervalLen } = computeIntervals(40, 6);
    expect(numIntervals).toBe(7);
    expect(intervalLen).toBeCloseTo(40 / 7);
  });

  it("never returns fewer than 2 intervals, even for a very long target sub interval", () => {
    const { numIntervals } = computeIntervals(20, 100);
    expect(numIntervals).toBe(2);
  });

  it("keeps interval length * numIntervals equal to the total game length", () => {
    const { numIntervals, intervalLen } = computeIntervals(50, 7);
    expect(numIntervals * intervalLen).toBeCloseTo(50);
  });
});

describe("buildCarryState", () => {
  it("tallies field minutes, GK minutes, and resets bench streak for played intervals", () => {
    const doneIntervals = [
      { startMin: 0, endMin: 10, onField: [{ id: "a", isGk: true }, { id: "b", isGk: false }] },
      { startMin: 10, endMin: 20, onField: [{ id: "b", isGk: false }] },
    ];
    const carry = buildCarryState(["a", "b", "c"], doneIntervals);

    expect(carry.a).toEqual({ fieldMin: 10, gkMin: 10, consecBench: 1 }); // played interval 1, benched interval 2
    expect(carry.b).toEqual({ fieldMin: 20, gkMin: 0, consecBench: 0 }); // played both
    expect(carry.c).toEqual({ fieldMin: 0, gkMin: 0, consecBench: 2 }); // benched both
  });

  it("returns zeroed state for an empty interval history", () => {
    const carry = buildCarryState(["a"], []);
    expect(carry.a).toEqual({ fieldMin: 0, gkMin: 0, consecBench: 0 });
  });
});

describe("generatePlan", () => {
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];

  it("distributes outfield minutes fairly in combined mode (nobody more than one interval ahead of anyone else)", () => {
    const { numIntervals } = computeIntervals(42, 6); // 7 intervals
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 42,
      numIntervals,
      fieldSize: 5,
      mode: "combined",
      keeperEligibleIds: ids,
    });

    const totals = {};
    ids.forEach((id) => (totals[id] = 0));
    intervals.forEach((iv) => {
      const len = iv.endMin - iv.startMin;
      iv.onField.forEach((p) => (totals[p.id] += len));
    });

    const values = Object.values(totals);
    const spread = Math.max(...values) - Math.min(...values);
    // one interval's worth of minutes is the expected max fairness gap
    expect(spread).toBeLessThanOrEqual(42 / numIntervals + 0.5);
  });

  it("never benches more players than necessary (fills up to fieldSize every interval)", () => {
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      mode: "combined",
      keeperEligibleIds: ids,
    });
    intervals.forEach((iv) => {
      expect(iv.onField.length).toBe(5);
      expect(iv.bench.length).toBe(ids.length - 5);
    });
  });

  it("puts everyone on the field with an empty bench when there aren't more players than the field size", () => {
    const smallSquad = ["p1", "p2", "p3", "p4"];
    const { numIntervals } = computeIntervals(20, 6);
    const { intervals } = generatePlan({
      availableIds: smallSquad,
      gameMinutes: 20,
      numIntervals,
      fieldSize: 5,
      mode: "combined",
      keeperEligibleIds: smallSquad,
    });
    intervals.forEach((iv) => {
      expect(iv.bench.length).toBe(0);
      expect(iv.onField.length).toBe(smallSquad.length);
    });
  });

  it("in split mode, only picks the goalkeeper from the keeper-eligible pool", () => {
    const eligible = ["p1", "p2"];
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      mode: "split",
      keeperEligibleIds: eligible,
    });
    intervals.forEach((iv) => {
      const gk = iv.onField.find((p) => p.isGk);
      expect(eligible).toContain(gk.id);
    });
  });

  it("exactly one goalkeeper is assigned per interval", () => {
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      mode: "combined",
      keeperEligibleIds: ids,
    });
    intervals.forEach((iv) => {
      expect(iv.onField.filter((p) => p.isGk).length).toBe(1);
    });
  });

  it("respects carryState so a player who already played a lot doesn't get immediately favored again", () => {
    // p1 has already played the whole game so far; everyone else has zero minutes.
    const carryState = {
      p1: { fieldMin: 100, gkMin: 0, consecBench: 0 },
      p2: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p3: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p4: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p5: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p6: { fieldMin: 0, gkMin: 0, consecBench: 0 },
    };
    const { intervals } = generatePlan({
      availableIds: Object.keys(carryState),
      gameMinutes: 30,
      numIntervals: 5,
      fieldSize: 5,
      mode: "combined",
      keeperEligibleIds: Object.keys(carryState),
      startInterval: 0,
      carryState,
    });
    // p1 (already at 100 min) should be the one benched in the very next interval,
    // since everyone else has zero minutes and is more "owed" field time.
    expect(intervals[0].bench).toEqual(["p1"]);
  });
});

describe("computeMinutesSummary", () => {
  it("returns an empty list when there's no plan yet", () => {
    expect(computeMinutesSummary(null, ["p1"])).toEqual([]);
  });

  it("splits each player's time into outfield, keeper, bench, and injured minutes", () => {
    const plan = [
      { startMin: 0, endMin: 10, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: ["p3"] },
      // p1 sidelined (not on field, not on bench) for interval 2 — e.g. injured
      { startMin: 10, endMin: 20, onField: [{ id: "p2", isGk: true }, { id: "p3", isGk: false }], bench: [] },
    ];
    const summary = computeMinutesSummary(plan, ["p1", "p2", "p3"]);

    expect(summary.find((s) => s.id === "p1")).toEqual({
      id: "p1", outfieldMin: 0, gkMin: 10, benchMin: 0, injuredMin: 10,
    });
    expect(summary.find((s) => s.id === "p2")).toEqual({
      id: "p2", outfieldMin: 10, gkMin: 10, benchMin: 0, injuredMin: 0,
    });
    expect(summary.find((s) => s.id === "p3")).toEqual({
      id: "p3", outfieldMin: 10, gkMin: 0, benchMin: 10, injuredMin: 0,
    });
  });
});
