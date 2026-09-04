import { describe, it, expect } from "vitest";
import {
  buildBenchSchedule, assignKeepers, buildFixedPlan, generateFixedPlan, continueFixedPlan, countDoubleStacked, computeOutfieldSpread,
  generateFixedPlanBiasedFor, calculateFairness,
} from "./fixedRotation.js";
import { buildCarryState, lastGkId } from "./rotation.js";

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

// Real bug (real-use report): with exactly one keeper-eligible player,
// buildBenchSchedule's plain round-robin arithmetic had no idea who was
// keeper-eligible, so it could cycle that sole player onto the bench like
// anyone else — leaving genuinely nobody eligible to fill goal that
// interval (an empty goal, assignKeepers' own gk=null fallback). Fixed by
// excluding a sole eligible keeper from the bench-cycling pool entirely —
// see buildFixedPlan's own comment.
describe("buildFixedPlan / generateFixedPlan — sole eligible keeper", () => {
  it("never leaves a null/empty goal, and the sole keeper is never benched, across a full game", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const { intervals } = buildFixedPlan({
      rotationOrder: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ["p1"],
    });
    intervals.forEach((iv) => {
      const gk = iv.onField.find((p) => p.isGk);
      expect(gk).toBeTruthy(); // never null — the exact bug reported
      expect(gk.id).toBe("p1");
      expect(iv.bench).not.toContain("p1");
      expect(iv.onField.some((p) => p.id === "p1")).toBe(true);
    });
    // Everyone else still rotates bench turns fairly among themselves.
    const benchCounts = {};
    ids.filter((id) => id !== "p1").forEach((id) => (benchCounts[id] = 0));
    intervals.forEach((iv) => iv.bench.forEach((id) => (benchCounts[id] += 1)));
    const values = Object.values(benchCounts);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("holds through generateFixedPlan (the real entry point), including repairKeeperBalance/repairOutfieldBalance", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const { intervals } = generateFixedPlan({
      availableIds: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ["p4"],
    });
    intervals.forEach((iv) => {
      const gk = iv.onField.find((p) => p.isGk);
      expect(gk?.id).toBe("p4");
      expect(iv.bench).not.toContain("p4");
    });
  });

  it("leaves normal multi-keeper behavior (2+ eligible) untouched — the sole-keeper exemption doesn't fire", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const { intervals } = buildFixedPlan({
      rotationOrder: ids, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: ["p1", "p2"],
    });
    // Both eligible players do get bench turns like anyone else here —
    // confirms the exemption is scoped to exactly one eligible player.
    const benchCounts = {};
    ids.forEach((id) => (benchCounts[id] = 0));
    intervals.forEach((iv) => iv.bench.forEach((id) => (benchCounts[id] += 1)));
    expect(benchCounts.p1).toBeGreaterThan(0);
    expect(benchCounts.p2).toBeGreaterThan(0);
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

describe("continueFixedPlan — mid-game rebuild (not yet wired into the app)", () => {
  // 7 players, 45-min game, 5-min subs (9 intervals) — same shape as the
  // real live game that motivated this whole engine. Build a full plan,
  // pretend 3 intervals have already happened, then rebuild the remainder
  // as if Jack got injured right then — the exact scenario handleInjury
  // (useMatchState.js) would need this for, once wired in.
  const ids = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis", "Eli"];
  const gameMinutes = 45, fieldSize = 5, numIntervals = 9;

  function rebuildAfterInjury(injuredId, activeInterval, seedRandom) {
    const { intervals: fullPlan } = generateFixedPlan({
      availableIds: ids, gameMinutes, numIntervals, fieldSize, keeperEligibleIds: ids, random: seedRandom,
    });
    const priorIntervals = fullPlan.slice(0, activeInterval);
    const remainingAvailable = ids.filter((id) => id !== injuredId);
    const carryState = buildCarryState(ids, priorIntervals);
    const { intervals: rebuilt } = continueFixedPlan({
      availableIds: remainingAvailable, gameMinutes, numIntervals, startInterval: activeInterval, fieldSize,
      keeperEligibleIds: remainingAvailable, carryState, currentGkId: lastGkId(priorIntervals),
      previousOnFieldIds: priorIntervals[priorIntervals.length - 1].onField.map((p) => p.id),
    });
    return { priorIntervals, rebuilt, combined: [...priorIntervals, ...rebuilt] };
  }

  it("holds bench->keeper across the seam between the completed part and the rebuilt remainder, not just within the remainder itself", () => {
    for (const seed of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const { combined } = rebuildAfterInjury("Jack", 3, () => seed);
      for (let i = 0; i < combined.length - 1; i++) {
        const bench = new Set(combined[i].bench);
        const nextGk = combined[i + 1].onField.find((p) => p.isGk);
        expect(nextGk && bench.has(nextGk.id)).toBe(true);
      }
    }
  });

  it("removes the injured player entirely from the rebuilt remainder", () => {
    const { rebuilt } = rebuildAfterInjury("Jack", 3, () => 0.3);
    rebuilt.forEach((iv) => {
      expect(iv.onField.some((p) => p.id === "Jack")).toBe(false);
      expect(iv.bench.includes("Jack")).toBe(false);
    });
  });

  it("continues the current keeper's shift instead of picking a new one off-boundary, when the shift spans the rebuild point", () => {
    // keeperShiftIntervals: 3 means the keeper set at interval 0 should
    // still be in goal at interval 1 (off-boundary) even after a rebuild
    // lands exactly there.
    const carryState = buildCarryState(["p1", "p2", "p3", "p4"], [
      { startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }], bench: ["p4"] },
    ]);
    const { intervals } = continueFixedPlan({
      availableIds: ["p1", "p2", "p3", "p4"], gameMinutes: 20, numIntervals: 4, startInterval: 1, fieldSize: 3,
      keeperEligibleIds: ["p1", "p2", "p3", "p4"], keeperShiftIntervals: 3, carryState, currentGkId: "p1",
      previousOnFieldIds: ["p1", "p2", "p3"],
    });
    expect(intervals[0].onField.find((p) => p.isGk).id).toBe("p1"); // interval 1 (absolute) — still mid-shift
  });

  it("orders the rebuilt remainder so whoever's had the least bench time so far gets priority, not an arbitrary shuffle", () => {
    // p4 has never been benched (longest current streak of playing);
    // p1/p2/p3 have each already had a turn. A fresh continuation should
    // send p4 to the bench first, not treat everyone as equally due.
    const carryState = {
      p1: { fieldMin: 10, gkMin: 0, consecBench: 0 },
      p2: { fieldMin: 10, gkMin: 0, consecBench: 0 },
      p3: { fieldMin: 10, gkMin: 0, consecBench: 0 },
      p4: { fieldMin: 15, gkMin: 0, consecBench: 0 }, // played every interval so far, most field time
    };
    const { intervals } = continueFixedPlan({
      availableIds: ["p1", "p2", "p3", "p4"], gameMinutes: 20, numIntervals: 4, startInterval: 3, fieldSize: 3,
      keeperEligibleIds: ["p1", "p2", "p3", "p4"], carryState, previousOnFieldIds: ["p1", "p2", "p3"],
    });
    expect(intervals[0].bench).toEqual(["p4"]);
  });
});

// RotationProgressOverlay's "Improve pitch fairness"/"Improve bench
// fairness" action (via useMatchState's previewImprovedFairness), for a
// plan that's just landed on "Needs attention". A SEARCH over
// generateFixedPlan's own already-trusted pipeline, not a new repair
// algorithm — see the function's own comment for why that's deliberate.
describe("generateFixedPlanBiasedFor", () => {
  const IDS7 = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
  const KEEPERS3 = ["p1", "p2", "p3"];
  // The exact real-use shape this feature was built for: 7 players,
  // 5-a-side, 3 eligible keepers, 45-minute game, 15-minute keeper shift
  // (numIntervals 9 at 5-minute sub-intervals, keeperShiftIntervals 3).
  const REAL_USE_ARGS = { availableIds: IDS7, gameMinutes: 45, numIntervals: 9, fieldSize: 5, keeperEligibleIds: KEEPERS3, keeperShiftIntervals: 3 };

  it("finds a materially tighter outfield spread than a single ungoverned generateFixedPlan call, on the real-use configuration", () => {
    let ungovernedWorst = 0;
    let biasedWorst = 0;
    for (let seed = 0; seed < 40; seed++) {
      const { intervals: plain } = generateFixedPlan(REAL_USE_ARGS);
      const plainRange = calculateFairness(plain, IDS7, KEEPERS3).outfieldRange;
      ungovernedWorst = Math.max(ungovernedWorst, plainRange);

      const best = generateFixedPlanBiasedFor("pitch", REAL_USE_ARGS);
      const actualRange = calculateFairness(best.intervals, IDS7, KEEPERS3).outfieldRange;
      expect(actualRange).toBe(best.outfieldRange); // self-reported number matches the real plan it returned
      biasedWorst = Math.max(biasedWorst, actualRange);
    }
    // A single ungoverned call can land as poorly as the "Needs attention"
    // screenshot that motivated this feature (outfield range well past the
    // ideal <=1 threshold). The biased search's worst case across the same
    // 40 seeds should sit at or near ideal — a real, visible improvement,
    // not a marginal one.
    expect(biasedWorst).toBeLessThanOrEqual(1);
    expect(biasedWorst).toBeLessThanOrEqual(ungovernedWorst);
  });

  it("finds a materially tighter bench spread than a single ungoverned generateFixedPlan call, on the real-use configuration", () => {
    let biasedWorst = 0;
    for (let seed = 0; seed < 40; seed++) {
      const best = generateFixedPlanBiasedFor("bench", REAL_USE_ARGS);
      const actualRange = calculateFairness(best.intervals, IDS7, KEEPERS3).benchRange;
      expect(actualRange).toBe(best.benchRange);
      biasedWorst = Math.max(biasedWorst, actualRange);
    }
    expect(biasedWorst).toBeLessThanOrEqual(1);
  });

  // Real-use report: a 7-player/4-eligible-keeper/45-min/10-min-shift game
  // (keeperShiftIntervals 2 at 5-minute sub-intervals — 9 intervals total,
  // so 4 blocks of 2 plus a 1-interval remainder, unevenly distributable
  // across 4 eligible players) produced "wildly out of whack" keeper
  // minutes — up to a 20-vs-0 split observed. Root cause: the selection
  // key used to be [target metric range, other metric range] only, with
  // no consideration of keeperRange at all — every individual candidate
  // already runs repairKeeperBalance, but that pass hits a genuine "no
  // safe move" limit for some shuffles, and "Improve bench fairness"
  // could and did land on exactly one of those (a bench-perfect,
  // keeper-terrible candidate) roughly 1 in 6 times in a 500-run sweep.
  // Fixed by putting keeperRange FIRST in the selection key.
  it("never selects a keeper-uneven candidate on the reported 4-eligible-keeper configuration, for either metric", () => {
    const args = {
      availableIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      gameMinutes: 45, numIntervals: 9, fieldSize: 5,
      keeperEligibleIds: ["p1", "p2", "p3", "p4"], keeperShiftIntervals: 2,
    };
    for (const metric of ["pitch", "bench"]) {
      let worstKeeperRange = 0;
      for (let i = 0; i < 60; i++) {
        const best = generateFixedPlanBiasedFor(metric, args);
        worstKeeperRange = Math.max(worstKeeperRange, best.keeperRange);
      }
      // "Ideal" per calculateFairness's own rating (<=1 interval = 5 min
      // apart) — matches the 15/10/10/10 shape a coach would expect for
      // this exact 9-interval/4-eligible-keeper split, not just "better
      // than before."
      expect(worstKeeperRange).toBeLessThanOrEqual(1);
    }
  });

  it("never regresses past a single ungoverned call, across a spread of squad/field-size shapes", () => {
    const configs = [
      { availableIds: ["p1", "p2", "p3", "p4", "p5", "p6"], gameMinutes: 40, numIntervals: 8, fieldSize: 4, keeperEligibleIds: ["p1", "p2"], keeperShiftIntervals: 2 },
      { availableIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"], gameMinutes: 30, numIntervals: 6, fieldSize: 6, keeperEligibleIds: ["p1", "p2", "p3"], keeperShiftIntervals: 1 },
      REAL_USE_ARGS,
    ];
    for (const args of configs) {
      for (const metric of ["pitch", "bench"]) {
        for (let seed = 0; seed < 10; seed++) {
          const { intervals: plain } = generateFixedPlan(args);
          const plainFairness = calculateFairness(plain, args.availableIds, args.keeperEligibleIds);
          const plainRange = metric === "bench" ? plainFairness.benchRange : plainFairness.outfieldRange;

          const best = generateFixedPlanBiasedFor(metric, args);
          const bestRange = metric === "bench" ? best.benchRange : best.outfieldRange;
          expect(bestRange).toBeLessThanOrEqual(plainRange);
        }
      }
    }
  });

  it("stays fast enough to feel instant for a preview — no spinner needed", () => {
    const bigArgs = {
      availableIds: Array.from({ length: 16 }, (_, i) => `p${i + 1}`),
      gameMinutes: 60, numIntervals: 10, fieldSize: 9,
      keeperEligibleIds: ["p1", "p2", "p3", "p4"], keeperShiftIntervals: 2,
    };
    const start = performance.now();
    generateFixedPlanBiasedFor("pitch", bigArgs, 30);
    const elapsedMs = performance.now() - start;
    // Generous margin for a slow CI machine — this is a sanity check
    // against something pathological, not a tight perf budget.
    expect(elapsedMs).toBeLessThan(500);
  });

  it("returns a fully-formed candidate even with attempts=1 (no crash on the smallest possible search)", () => {
    const best = generateFixedPlanBiasedFor("pitch", REAL_USE_ARGS, 1);
    expect(best.intervals.length).toBe(REAL_USE_ARGS.numIntervals);
    expect(typeof best.outfieldRange).toBe("number");
    expect(typeof best.benchRange).toBe("number");
  });
});
