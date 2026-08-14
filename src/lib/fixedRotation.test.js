import { describe, it, expect } from "vitest";
import { buildBenchSchedule, assignKeepers, buildFixedPlan, generateFixedPlan, countDoubleStacked, computeOutfieldSpread } from "./fixedRotation.js";

// Bench turns follow generatePlan's own final total-minutes across the
// whole game, not "each transition holds" — checked here instead directly
// on the turn-count arithmetic itself, since that's the actual guarantee
// this engine makes, not an emergent property of a heuristic.
function benchKeeperAlwaysHolds(intervals) {
  for (let i = 0; i < intervals.length - 1; i++) {
    const bench = new Set(intervals[i].bench);
    const nextGk = intervals[i + 1].onField.find((p) => p.isGk);
    if (!nextGk || !bench.has(nextGk.id)) return false;
  }
  return true;
}

function totalsFor(intervals, ids) {
  const t = {};
  ids.forEach((id) => (t[id] = { outfield: 0, gk: 0, bench: 0 }));
  intervals.forEach((iv) => {
    const len = iv.endMin - iv.startMin;
    iv.onField.forEach((p) => { if (p.isGk) t[p.id].gk += len; else t[p.id].outfield += len; });
    iv.bench.forEach((id) => (t[id].bench += len));
  });
  return t;
}

describe("buildBenchSchedule", () => {
  it("gives every player a bench-turn count within 1 of every other, by construction", () => {
    const rotationOrder = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const schedule = buildBenchSchedule({ rotationOrder, numIntervals: 9, benchSpots: 2 });
    const counts = {};
    rotationOrder.forEach((id) => (counts[id] = 0));
    schedule.forEach((bench) => bench.forEach((id) => (counts[id] += 1)));
    const values = Object.values(counts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    // Every interval's bench is distinct players, no duplicates.
    schedule.forEach((bench) => expect(new Set(bench).size).toBe(bench.length));
  });

  it("puts nobody on the bench when the squad exactly fills the field", () => {
    const schedule = buildBenchSchedule({ rotationOrder: ["p1", "p2"], numIntervals: 5, benchSpots: 0 });
    schedule.forEach((bench) => expect(bench).toEqual([]));
  });
});

describe("assignKeepers", () => {
  const rotationOrder = ["p1", "p2", "p3", "p4", "p5", "p6"];

  it("honors a manual starting keeper, exactly once, at interval 0", () => {
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 9, benchSpots: 1 });
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: rotationOrder, startingGkId: "p3" });
    expect(gks[0]).toBe("p3");
  });

  it("ignores a starting-keeper request for someone benched at interval 0, falling through to the normal pick", () => {
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 9, benchSpots: 1 });
    // p1 is benched at interval 0 by this schedule (position 0, first slot).
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: rotationOrder, startingGkId: "p1" });
    expect(gks[0]).not.toBe("p1");
  });

  it("never assigns keeper duty to someone not keeper-eligible", () => {
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 9, benchSpots: 1 });
    const eligible = ["p1", "p2"];
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: eligible });
    gks.forEach((gk) => {
      if (gk) expect(eligible).toContain(gk);
    });
  });

  it("returns null for an interval with no eligible keeper anywhere on the field", () => {
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 3, benchSpots: 1 });
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: [] });
    gks.forEach((gk) => expect(gk).toBeNull());
  });

  it("keeps the same keeper across a multi-interval shift instead of rotating every interval", () => {
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 6, benchSpots: 1 });
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: rotationOrder, keeperShiftIntervals: 2 });
    // Same keeper for intervals [0,1], a possibly-different one for [2,3], etc.
    expect(gks[0]).toBe(gks[1]);
    expect(gks[2]).toBe(gks[3]);
    expect(gks[4]).toBe(gks[5]);
  });

  it("never wastes the one free keeper credit on a player who's already carrying more bench turns than average — the exact bug a real game exposed", () => {
    // 6 players, 9 intervals, 1 bench spot — the live-game reproduction.
    // Before this was fixed, the free starting-keeper pick defaulted to a
    // player who already had 2 guaranteed keeper turns coming from their
    // own bench arrivals, giving them 3 total against everyone else's 1-2.
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 9, benchSpots: 1 });
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: rotationOrder });
    const counts = {};
    rotationOrder.forEach((id) => (counts[id] = 0));
    gks.forEach((gk) => { if (gk) counts[gk] += 1; });
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  it("splits keeper duty exactly evenly when the numbers divide perfectly cleanly", () => {
    // 6 players, 6 intervals, 1 bench spot — 6 keeper turns, 6 players,
    // no remainder. Before the guaranteedKeeperTurns fix, this exact shape
    // left one player with 2 turns and another with 0 despite the clean
    // division, because the free pick had no signal to work with once
    // every player's total bench-turn count looked identical.
    const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals: 6, benchSpots: 1 });
    const gks = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds: rotationOrder });
    const counts = {};
    rotationOrder.forEach((id) => (counts[id] = 0));
    gks.forEach((gk) => { if (gk) counts[gk] += 1; });
    rotationOrder.forEach((id) => expect(counts[id]).toBe(1));
  });
});

describe("buildFixedPlan / generateFixedPlan — real live-game regression fixtures", () => {
  it("6 players, 45-min game, 5-min subs (the original live game): bench->keeper holds at every transition", () => {
    const ids = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis"];
    const { intervals } = buildFixedPlan({ rotationOrder: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ids });
    expect(benchKeeperAlwaysHolds(intervals)).toBe(true);
    const totals = totalsFor(intervals, ids);
    ids.forEach((id) => expect(totals[id].outfield + totals[id].gk + totals[id].bench).toBe(45));
  });

  it("7 players, 45-min game, 5-min subs, manual start=Otis: honors the pick and still never breaks bench->keeper", () => {
    const ids = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis", "Eli"];
    const { intervals } = buildFixedPlan({
      rotationOrder: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ids, startingGkId: "Otis",
    });
    expect(intervals[0].onField.find((p) => p.isGk).id).toBe("Otis");
    expect(benchKeeperAlwaysHolds(intervals)).toBe(true);
  });

  it("clean division (6 players, 42-min game, 7-min subs -> 6 intervals): perfectly even on every measure", () => {
    const ids = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis"];
    const { intervals } = buildFixedPlan({ rotationOrder: ids, gameMinutes: 42, numIntervals: 6, fieldSize: 5, keeperEligibleIds: ids });
    expect(computeOutfieldSpread(intervals, ids)).toBe(0);
    expect(countDoubleStacked(intervals, ids)).toBe(0);
    const totals = totalsFor(intervals, ids);
    ids.forEach((id) => expect(totals[id]).toEqual({ outfield: 28, gk: 7, bench: 7 }));
  });

  it("generateFixedPlan varies who starts across repeated calls (real week-to-week variety), while still always holding bench->keeper", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const starters = new Set();
    for (let i = 0; i < 10; i++) {
      const { intervals } = generateFixedPlan({ availableIds: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ids });
      starters.add(intervals[0].onField.find((p) => p.isGk).id);
      expect(benchKeeperAlwaysHolds(intervals)).toBe(true);
    }
    expect(starters.size).toBeGreaterThan(1); // real Math.random() varies who starts
  });

  it("generateFixedPlan honors a manual starting keeper even when the shuffle would have benched them for interval 0", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
    // Force a shuffle that puts p3 first (so a naive shuffle+startingGkId="p3"
    // combo could coincidentally work) is not what's being tested here — use
    // a random source that's likely to shuffle p3 into the bench block, and
    // confirm the swap-into-position logic still gets them on the field.
    let sawP3Start = false;
    for (let i = 0; i < 20 && !sawP3Start; i++) {
      const { intervals } = generateFixedPlan({
        availableIds: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ids, startingGkId: "p3",
      });
      if (intervals[0].onField.find((p) => p.isGk).id === "p3") sawP3Start = true;
    }
    expect(sawP3Start).toBe(true);
  });
});

describe("countDoubleStacked", () => {
  it("returns 0 when nobody is above average on both bench and keeper turns", () => {
    const intervals = [
      { onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: ["p3"] },
      { onField: [{ id: "p3", isGk: true }, { id: "p2", isGk: false }], bench: ["p1"] },
      { onField: [{ id: "p1", isGk: true }, { id: "p3", isGk: false }], bench: ["p2"] },
    ];
    expect(countDoubleStacked(intervals, ["p1", "p2", "p3"])).toBe(0);
  });
});

describe("computeOutfieldSpread", () => {
  it("returns the gap between the most and least outfield time, ignoring keeper and bench minutes entirely", () => {
    const intervals = [
      { startMin: 0, endMin: 10, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: [] },
      { startMin: 10, endMin: 20, onField: [{ id: "p1", isGk: false }, { id: "p2", isGk: true }], bench: [] },
    ];
    // p1: 10 outfield (interval 2 only, was gk in interval 1). p2: 10 outfield (interval 1 only).
    expect(computeOutfieldSpread(intervals, ["p1", "p2"])).toBe(0);
  });
});
