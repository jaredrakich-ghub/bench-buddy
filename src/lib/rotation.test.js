import { describe, it, expect } from "vitest";
import {
  intervalAtElapsed,
  computeIntervals,
  computeBreakBoundaries,
  buildCarryState,
  generatePlan,
  computeFairnessSpread,
  computeAveragePitchMinutes,
  isFairSpread,
  pickFairStartingGk,
  recommendSubIntervals,
  computeMinutesSummary,
  aggregateSeasonSummary,
  keeperShiftIntervalsFor,
  lastGkId,
  benchPriorityCompare,
  resolveBringBack,
  computeNextChangeBadges,
  pairChanges,
  repairBenchToKeeper,
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

describe("computeBreakBoundaries", () => {
  it("returns nothing for no breaks (1 segment) or an unset value", () => {
    expect(computeBreakBoundaries(9, 1)).toEqual(new Set());
    expect(computeBreakBoundaries(9, null)).toEqual(new Set());
    expect(computeBreakBoundaries(9, undefined)).toEqual(new Set());
    expect(computeBreakBoundaries(9, 0)).toEqual(new Set());
  });

  it("halves (2 segments): a single divider at the halfway point", () => {
    // 9 intervals -> round(9/2) = round(4.5) = 5
    expect(computeBreakBoundaries(9, 2)).toEqual(new Set([5]));
  });

  it("thirds (3 segments): two evenly-spaced dividers", () => {
    // 9 divides cleanly into thirds: dividers at 3 and 6.
    expect(computeBreakBoundaries(9, 3)).toEqual(new Set([3, 6]));
  });

  it("quarters (4 segments): three dividers, rounded to the nearest interval when it doesn't divide evenly", () => {
    // 9 intervals / 4 -> round(2.25)=2, round(4.5)=5, round(6.75)=7
    expect(computeBreakBoundaries(9, 4)).toEqual(new Set([2, 5, 7]));
  });

  it("never produces a divider before the first interval or after the last", () => {
    const boundaries = computeBreakBoundaries(4, 4); // more segments than there's real room for
    boundaries.forEach((idx) => {
      expect(idx).toBeGreaterThan(0);
      expect(idx).toBeLessThan(4);
    });
  });
});

describe("benchPriorityCompare", () => {
  it("prefers whoever has the longer current bench streak", () => {
    const waitedLonger = { fieldMin: 10, gkMin: 0, consecBench: 3 };
    const justBenched = { fieldMin: 10, gkMin: 0, consecBench: 1 };
    expect(benchPriorityCompare(waitedLonger, justBenched)).toBeLessThan(0);
    expect(benchPriorityCompare(justBenched, waitedLonger)).toBeGreaterThan(0);
  });

  it("breaks a tied bench streak by least field time so far", () => {
    const playedLess = { fieldMin: 5, gkMin: 0, consecBench: 1 };
    const playedMore = { fieldMin: 15, gkMin: 0, consecBench: 1 };
    expect(benchPriorityCompare(playedLess, playedMore)).toBeLessThan(0);
  });

  it("treats fully tied candidates as equal", () => {
    const a = { fieldMin: 10, gkMin: 0, consecBench: 2 };
    const b = { fieldMin: 10, gkMin: 0, consecBench: 2 };
    expect(benchPriorityCompare(a, b)).toBe(0);
  });

  it("prefers a kid who's done more keeper duty over one with equal total field time but more outfield running", () => {
    // Found via a real live game: two players with equal fieldMin (total
    // playing time) shouldn't be treated as equally "caught up" if one of
    // them spent more of that time in goal rather than actually running —
    // keeper minutes count for less toward "already had a turn".
    const mostlyKeeper = { fieldMin: 20, gkMin: 15, consecBench: 1 }; // only 5 min outfield
    const mostlyOutfield = { fieldMin: 20, gkMin: 0, consecBench: 1 }; // all 20 min outfield
    expect(benchPriorityCompare(mostlyKeeper, mostlyOutfield)).toBeLessThan(0); // mostlyKeeper is more "owed" a turn
  });

  it("still lets a big enough outfield-time gap outweigh a smaller keeper-minutes difference", () => {
    // Keeper time counts for less, not nothing — someone who's barely
    // played at all is still more owed than someone who's mostly been in
    // goal, once the outfield gap is large enough.
    const barelyPlayed = { fieldMin: 5, gkMin: 0, consecBench: 1 };
    const mostlyKeeper = { fieldMin: 20, gkMin: 15, consecBench: 1 }; // effectively 12.5 weighted minutes
    expect(benchPriorityCompare(barelyPlayed, mostlyKeeper)).toBeLessThan(0);
  });
});

describe("resolveBringBack", () => {
  // A fixed on-field roster reused across cases below — who exactly is on
  // it doesn't matter for these tests except its length (the "is the pitch
  // already full" check), so keep it simple: 5 players, i.e. a full side.
  const fullOnField = ["f1", "f2", "f3", "f4", "f5"].map((id) => ({ id, isGk: false }));

  it("with no open field slot, the returning player just joins the bench — the field is untouched", () => {
    const result = resolveBringBack({
      playerId: "returning",
      onField: fullOnField,
      bench: ["b1", "b2"],
      standing: {},
      normalFieldSize: 5, // already at capacity
    });
    expect(result.onField).toEqual(fullOnField);
    expect(result.bench).toEqual(["b1", "b2", "returning"]);
  });

  it("with an open slot and an empty bench, the returning player fills it themselves (nobody else to promote)", () => {
    const result = resolveBringBack({
      playerId: "returning",
      onField: fullOnField.slice(0, 3), // pitch short two players
      bench: [],
      standing: {},
      normalFieldSize: 5,
    });
    expect(result.onField.map((p) => p.id)).toEqual([...fullOnField.slice(0, 3).map((p) => p.id), "returning"]);
    expect(result.onField.find((p) => p.id === "returning").isGk).toBe(false);
    expect(result.bench).toEqual([]);
  });

  it("with an open slot and a non-empty bench, promotes whoever's waited longest — not the returning player", () => {
    const result = resolveBringBack({
      playerId: "returning",
      onField: fullOnField.slice(0, 4), // one slot open
      bench: ["justBenched", "waitedLongest", "alsoWaiting"],
      standing: {
        justBenched: { fieldMin: 20, gkMin: 0, consecBench: 1 },
        waitedLongest: { fieldMin: 20, gkMin: 0, consecBench: 4 },
        alsoWaiting: { fieldMin: 20, gkMin: 0, consecBench: 2 },
      },
      normalFieldSize: 5,
    });
    // waitedLongest (consecBench 4, the highest) is promoted onto the field...
    expect(result.onField.map((p) => p.id)).toContain("waitedLongest");
    expect(result.onField.find((p) => p.id === "waitedLongest").isGk).toBe(false);
    // ...the returning player never appears on the field...
    expect(result.onField.map((p) => p.id)).not.toContain("returning");
    // ...and lands on the bench, alongside whoever wasn't promoted.
    expect(new Set(result.bench)).toEqual(new Set(["justBenched", "alsoWaiting", "returning"]));
    expect(result.bench).not.toContain("waitedLongest");
  });

  it("breaks a tied bench streak by least field time when choosing who to promote", () => {
    const result = resolveBringBack({
      playerId: "returning",
      onField: fullOnField.slice(0, 4),
      bench: ["playedALot", "playedLittle"],
      standing: {
        playedALot: { fieldMin: 30, gkMin: 0, consecBench: 1 },
        playedLittle: { fieldMin: 5, gkMin: 0, consecBench: 1 }, // tied on consecBench, less field time
      },
      normalFieldSize: 5,
    });
    expect(result.onField.map((p) => p.id)).toContain("playedLittle");
    expect(result.bench).toContain("playedALot");
  });

  it("treats a bench player missing from standing (e.g. never carried forward) as having played nothing — lowest priority, not highest", () => {
    const result = resolveBringBack({
      playerId: "returning",
      onField: fullOnField.slice(0, 4),
      bench: ["hasHistory", "noHistory"],
      standing: {
        hasHistory: { fieldMin: 0, gkMin: 0, consecBench: 1 }, // has actually waited a turn
        // noHistory intentionally omitted
      },
      normalFieldSize: 5,
    });
    // hasHistory has consecBench 1 > noHistory's implied 0, so hasHistory
    // should still win the promotion despite noHistory's "0 field minutes".
    expect(result.onField.map((p) => p.id)).toContain("hasHistory");
    expect(result.bench).toContain("noHistory");
  });
});

describe("keeperShiftIntervalsFor", () => {
  it("defaults to one sub-interval per shift when no keeper shift length is set", () => {
    expect(keeperShiftIntervalsFor(5, undefined)).toBe(1);
    expect(keeperShiftIntervalsFor(5, null)).toBe(1);
    expect(keeperShiftIntervalsFor(5, 0)).toBe(1);
  });

  it("rounds to the nearest whole number of sub-intervals", () => {
    expect(keeperShiftIntervalsFor(5, 15)).toBe(3);
    expect(keeperShiftIntervalsFor(5, 17)).toBe(3); // rounds to nearest, not up
    expect(keeperShiftIntervalsFor(6, 15)).toBe(3); // round(15/6) = round(2.5) = 3
  });

  it("never returns fewer than 1, even if the shift is set shorter than a sub-interval", () => {
    expect(keeperShiftIntervalsFor(10, 2)).toBe(1);
  });
});

describe("lastGkId", () => {
  it("returns the GK id from the last interval in the list", () => {
    const intervals = [
      { onField: [{ id: "a", isGk: true }, { id: "b", isGk: false }] },
      { onField: [{ id: "b", isGk: true }, { id: "a", isGk: false }] },
    ];
    expect(lastGkId(intervals)).toBe("b");
  });

  it("returns null for an empty or missing interval list", () => {
    expect(lastGkId([])).toBe(null);
    expect(lastGkId(null)).toBe(null);
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

  it("distributes outfield minutes fairly (nobody more than one interval ahead of anyone else)", () => {
    const { numIntervals } = computeIntervals(42, 6); // 7 intervals
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 42,
      numIntervals,
      fieldSize: 5,
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
      keeperEligibleIds: smallSquad,
    });
    intervals.forEach((iv) => {
      expect(iv.bench.length).toBe(0);
      expect(iv.onField.length).toBe(smallSquad.length);
    });
  });

  it("only picks the goalkeeper from the keeper-eligible pool (players with 🧤 toggled off are never GK)", () => {
    const eligible = ["p1", "p2"];
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      keeperEligibleIds: eligible,
    });
    intervals.forEach((iv) => {
      const gk = iv.onField.find((p) => p.isGk);
      expect(eligible).toContain(gk.id);
    });
  });

  it("pulls an eligible keeper onto the field even if outfield fairness alone wouldn't have picked them", () => {
    // p7 is the only keeper-eligible player and has the least gk time (0),
    // but is last in outfield fairness order (already has the most field time).
    // The algorithm should still pull them on to keep goal, rather than only
    // choosing a GK from whoever outfield fairness already selected.
    const carryState = {
      p1: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p2: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p3: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p4: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p5: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p6: { fieldMin: 0, gkMin: 0, consecBench: 0 },
      p7: { fieldMin: 100, gkMin: 0, consecBench: 0 }, // least "owed" outfield time
    };
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals: 5,
      fieldSize: 5,
      keeperEligibleIds: ["p7"],
      carryState,
    });
    const gk = intervals[0].onField.find((p) => p.isGk);
    expect(gk.id).toBe("p7");
  });

  it("falls back to picking a GK from the field when nobody is keeper-eligible, instead of leaving no keeper", () => {
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      keeperEligibleIds: [], // everyone toggled off — shouldn't happen in practice, but must not break
    });
    intervals.forEach((iv) => {
      expect(iv.onField.filter((p) => p.isGk).length).toBe(1);
    });
  });

  it("exactly one goalkeeper is assigned per interval", () => {
    const { numIntervals } = computeIntervals(30, 6);
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      keeperEligibleIds: ids,
    });
    intervals.forEach((iv) => {
      expect(iv.onField.filter((p) => p.isGk).length).toBe(1);
    });
  });

  it("prefers picking a new keeper from the bench over pulling someone off outfield, when gk minutes are tied — so a keeper change is usually a single clean bench<->field swap", () => {
    // everyone keeper-eligible, everyone tied at 0 gk/field minutes to start —
    // interval 0 puts p1 in goal, p6/p7 on the bench. Interval 1 is a fresh
    // keeper pick (default shift = every interval): p6/p7 now have a bench
    // streak p2-p5 don't, so they should be preferred for goal even though
    // everyone's still tied at 0 gk minutes.
    const { numIntervals } = computeIntervals(30, 6); // 5 intervals
    const { intervals } = generatePlan({
      availableIds: ids,
      gameMinutes: 30,
      numIntervals,
      fieldSize: 5,
      keeperEligibleIds: ids,
    });
    const bench0 = new Set(intervals[0].bench);
    const gk1 = intervals[1].onField.find((p) => p.isGk).id;
    expect(bench0.has(gk1)).toBe(true);
  });

  it("holds 'bench player becomes next keeper' at every single transition, even for a squad size/settings combo that used to break it", () => {
    // The exact real live game that exposed this: 6 players, fieldSize 5,
    // 45-minute game, 5-minute subs (9 intervals), keeper rotating every
    // interval, starting keeper = Otis. Before the pickGkFrom fix, interval
    // 3 picked Jack (already on the field, gkMin tied with everyone at 0)
    // over Otis (arriving from the bench) — Otis ended up on outfield
    // instead of goal, breaking the pattern a coach was relying on.
    const squad = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis"];
    const { numIntervals } = computeIntervals(45, 5);
    const { intervals } = generatePlan({
      availableIds: squad, gameMinutes: 45, numIntervals, fieldSize: 5, keeperEligibleIds: squad, startingGkId: "Otis",
    });
    for (let i = 0; i < intervals.length - 1; i++) {
      const bench = new Set(intervals[i].bench);
      const nextGk = intervals[i + 1].onField.find((p) => p.isGk).id;
      expect(bench.has(nextGk)).toBe(true);
    }
  });

  it("never lets 'currently on the bench' override a real gkMin gap — it's a tiebreak, not a priority", () => {
    // A first version of the bench-preference fix made "on the bench" the
    // primary sort key ahead of gkMin, not just a tiebreak — the fairness
    // sweep caught it letting a benched player who already had far more
    // keeper minutes win over an on-field player sitting at zero, which let
    // keeper duty concentrate unevenly for some squad sizes. p2 is on the
    // bench but already has 15 gk minutes; p3 is on the field with none —
    // p3 should still win.
    const carryState = {
      p1: { fieldMin: 20, gkMin: 15, consecBench: 0 },
      p2: { fieldMin: 20, gkMin: 15, consecBench: 1 }, // benched, but already owed plenty of gk time
      p3: { fieldMin: 20, gkMin: 0, consecBench: 0 }, // on the field, never played keeper
      p4: { fieldMin: 20, gkMin: 0, consecBench: 0 },
      p5: { fieldMin: 20, gkMin: 0, consecBench: 0 },
    };
    const squad = ["p1", "p2", "p3", "p4", "p5"];
    const { intervals } = generatePlan({
      availableIds: squad, gameMinutes: 20, numIntervals: 4, fieldSize: 5, keeperEligibleIds: squad, carryState,
    });
    expect(intervals[0].onField.find((p) => p.isGk).id).toBe("p3");
  });

  it("rotates the tied-candidate pool by interval index, so the same array position doesn't lose every tie for a whole game", () => {
    // Found via the fairness sweep: with a deep enough bench, several
    // candidates can be genuinely tied on everything tracked for a while,
    // and ties fall through to array order — without rotating that order,
    // whoever's last in availableIds can lose every single tied pick and
    // end up with zero keeper minutes despite being an equally valid
    // candidate every time. 10 players, fieldSize 6 (4 bench spots), 10
    // intervals, everyone keeper-eligible, nobody's played yet — the exact
    // shape of the scenario that exposed this.
    const squad = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const { intervals } = generatePlan({
      availableIds: squad, gameMinutes: 60, numIntervals: 10, fieldSize: 6, keeperEligibleIds: squad,
    });
    const gkMinutes = {};
    squad.forEach((id) => (gkMinutes[id] = 0));
    intervals.forEach((iv) => {
      const len = iv.endMin - iv.startMin;
      const gk = iv.onField.find((p) => p.isGk);
      gkMinutes[gk.id] += len;
    });
    // Every player should get at least one keeper turn — none starved entirely.
    squad.forEach((id) => expect(gkMinutes[id]).toBeGreaterThan(0));
  });

  it("respects carryState so a player who already played a lot doesn't get immediately favored again", () => {
    // p1 has already played the whole game so far; everyone else has zero minutes.
    // Keeper eligibility is forced onto p2 alone here so GK selection (which
    // only looks at gkMin, by design — see the "pulls an eligible keeper
    // onto the field" test above) can't interfere with isolating outfield
    // fairness, which is what this test is actually checking.
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
      keeperEligibleIds: ["p2"],
      startInterval: 0,
      carryState,
    });
    // p1 (already at 100 min) should be the one benched in the very next interval,
    // since everyone else has zero minutes and is more "owed" field time.
    expect(intervals[0].bench).toEqual(["p1"]);
  });

  describe("keeper shift length", () => {
    const eligible = ["p1", "p2"];

    it("keeps the same keeper for keeperShiftIntervals in a row, then rotates", () => {
      const { intervals } = generatePlan({
        availableIds: ids,
        gameMinutes: 60,
        numIntervals: 6,
        fieldSize: 5,
        keeperEligibleIds: eligible,
        keeperShiftIntervals: 3,
      });
      const gks = intervals.map((iv) => iv.onField.find((p) => p.isGk).id);
      // 6 intervals, shift length 3 -> two shifts of 3 identical intervals each
      expect(gks[0]).toBe(gks[1]);
      expect(gks[1]).toBe(gks[2]);
      expect(gks[3]).toBe(gks[4]);
      expect(gks[4]).toBe(gks[5]);
      expect(gks[0]).not.toBe(gks[3]); // rotates to the other eligible keeper at the boundary
    });

    it("defaults to changing every interval when keeperShiftIntervals isn't set", () => {
      const { intervals } = generatePlan({
        availableIds: ids,
        gameMinutes: 30,
        numIntervals: 5,
        fieldSize: 5,
        keeperEligibleIds: eligible,
      });
      const gks = intervals.map((iv) => iv.onField.find((p) => p.isGk).id);
      // with only 2 eligible keepers and no shift length, expect it to alternate
      expect(gks[0]).not.toBe(gks[1]);
    });

    it("a mid-game rebuild continues an in-progress shift instead of picking a new keeper immediately", () => {
      // Interval 0 already happened with p1 in goal, 1 interval into a 3-interval shift.
      const priorIntervals = [
        {
          index: 0, startMin: 0, endMin: 10,
          onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }],
          bench: ["p6", "p7"],
        },
      ];
      const carryState = buildCarryState(ids, priorIntervals);
      const { intervals } = generatePlan({
        availableIds: ids,
        gameMinutes: 60,
        numIntervals: 6,
        fieldSize: 5,
        keeperEligibleIds: eligible,
        keeperShiftIntervals: 3,
        startInterval: 1,
        carryState,
        currentGkId: lastGkId(priorIntervals),
      });
      // interval 1 is not a shift boundary (1 % 3 !== 0) — p1 should still be keeper.
      expect(intervals[0].onField.find((p) => p.isGk).id).toBe("p1");
    });

    it("replaces the keeper immediately if they become unavailable mid-shift, even off-boundary", () => {
      const priorIntervals = [
        {
          index: 0, startMin: 0, endMin: 10,
          onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }],
          bench: ["p6", "p7"],
        },
      ];
      const carryState = buildCarryState(ids, priorIntervals);
      // p1 (the current keeper) is now injured/unavailable.
      const remainingAvailable = ids.filter((id) => id !== "p1");
      const { intervals } = generatePlan({
        availableIds: remainingAvailable,
        gameMinutes: 60,
        numIntervals: 6,
        fieldSize: 5,
        keeperEligibleIds: eligible,
        keeperShiftIntervals: 3,
        startInterval: 1,
        carryState,
        currentGkId: lastGkId(priorIntervals),
      });
      // p1 is gone, so p2 (the only other eligible keeper) must take over right away.
      expect(intervals[0].onField.find((p) => p.isGk).id).toBe("p2");
    });
  });
});

describe("repairBenchToKeeper", () => {
  const ALL6 = ["p1", "p2", "p3", "p4", "p5", "p6"];

  it("fixes a genuine violation: swaps the invalid keeper (who was already on the field) for whoever actually arrived from the bench", () => {
    const intervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }], bench: ["p6"] },
      // p2 becomes keeper here but was already outfield at interval 0, not benched — a violation. p6 genuinely arrived (was benched at 0).
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p2", isGk: true }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }], bench: ["p1"] },
    ];
    repairBenchToKeeper({ intervals, keeperEligibleIds: ALL6, currentGkId: null, previousOnFieldIds: null });

    expect(intervals[1].onField.find((p) => p.id === "p6").isGk).toBe(true);
    expect(intervals[1].onField.find((p) => p.id === "p2").isGk).toBe(false);
    expect(intervals[1].bench).toEqual(["p1"]); // bench composition is never touched
  });

  it("leaves a genuine continuation (same keeper) and a genuine arrival (new keeper actually came from the bench) untouched", () => {
    const continuationIntervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: ["p3"] },
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p1", isGk: true }, { id: "p3", isGk: false }], bench: ["p2"] },
    ];
    repairBenchToKeeper({ intervals: continuationIntervals, keeperEligibleIds: ["p1", "p2", "p3"], currentGkId: null, previousOnFieldIds: null });
    expect(continuationIntervals[1].onField.find((p) => p.id === "p1").isGk).toBe(true);

    const genuineArrivalIntervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: ["p3"] },
      // p3 genuinely arrived from the bench and becomes keeper — valid, nothing to fix.
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p1", isGk: false }, { id: "p3", isGk: true }], bench: ["p2"] },
    ];
    repairBenchToKeeper({ intervals: genuineArrivalIntervals, keeperEligibleIds: ["p1", "p2", "p3"], currentGkId: null, previousOnFieldIds: null });
    expect(genuineArrivalIntervals[1].onField.find((p) => p.id === "p3").isGk).toBe(true);
  });

  it("never touches the very first interval when there's no prior state to validate against (a genuine start)", () => {
    const intervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }], bench: ["p3"] },
    ];
    repairBenchToKeeper({ intervals, keeperEligibleIds: ["p1", "p2", "p3"], currentGkId: null, previousOnFieldIds: null });
    expect(intervals[0].onField.find((p) => p.id === "p1").isGk).toBe(true);
  });

  it("validates the FIRST interval of a rebuild too, when previousOnFieldIds/currentGkId describe real prior state (the actual mid-game rebuild case)", () => {
    // p2 becomes keeper in the very first interval of this array, but per
    // the passed-in prior state they were already on the field, not benched.
    const intervals = [
      { index: 3, startMin: 15, endMin: 20, onField: [{ id: "p2", isGk: true }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }], bench: ["p1"] },
    ];
    repairBenchToKeeper({
      intervals, keeperEligibleIds: ALL6, currentGkId: "p1", previousOnFieldIds: ["p1", "p2", "p3", "p4", "p5"],
    });
    expect(intervals[0].onField.find((p) => p.id === "p6").isGk).toBe(true); // p6 genuinely arrived
    expect(intervals[0].onField.find((p) => p.id === "p2").isGk).toBe(false);
  });

  it("applies the fix across the whole shift block, not just the interval where the violation was first found", () => {
    const intervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }], bench: ["p6"] },
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p2", isGk: true }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }], bench: ["p1"] },
      // Same (invalid) keeper continues into a second interval — a 2-interval shift.
      { index: 2, startMin: 10, endMin: 15, onField: [{ id: "p2", isGk: true }, { id: "p1", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }], bench: ["p3"] },
    ];
    repairBenchToKeeper({ intervals, keeperEligibleIds: ALL6, currentGkId: null, previousOnFieldIds: null });

    expect(intervals[1].onField.find((p) => p.id === "p6").isGk).toBe(true);
    expect(intervals[2].onField.find((p) => p.id === "p6").isGk).toBe(true); // the fix carried through
    expect(intervals[2].onField.find((p) => p.id === "p2").isGk).toBe(false);
    expect(intervals[2].onField.find((p) => p.id === "p1").isGk).toBe(false); // untouched bystander
  });

  it("leaves the violation as-is when nobody eligible genuinely arrived — the one documented fallback", () => {
    const intervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }], bench: ["p6"] },
      // p2 is invalid, and the only arrival (p6) isn't keeper-eligible.
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p2", isGk: true }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }], bench: ["p1"] },
    ];
    repairBenchToKeeper({ intervals, keeperEligibleIds: ["p1", "p2"], currentGkId: null, previousOnFieldIds: null });
    expect(intervals[1].onField.find((p) => p.id === "p2").isGk).toBe(true); // left alone, not crashed
  });

  it("among multiple genuinely-arriving eligible candidates, prefers whoever has the least keeper minutes so far", () => {
    const intervals = [
      { index: 0, startMin: 0, endMin: 5, onField: [{ id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false }, { id: "p4", isGk: false }, { id: "p5", isGk: false }], bench: ["p6", "p7"] },
      // p1 and p3 go to the bench; p6 and p7 both genuinely arrive; p2 (invalid) continues as keeper.
      { index: 1, startMin: 5, endMin: 10, onField: [{ id: "p2", isGk: true }, { id: "p4", isGk: false }, { id: "p5", isGk: false }, { id: "p6", isGk: false }, { id: "p7", isGk: false }], bench: ["p1", "p3"] },
    ];
    const carryState = { p6: { gkMin: 10 }, p7: { gkMin: 2 } };
    repairBenchToKeeper({ intervals, keeperEligibleIds: [...ALL6, "p7"], currentGkId: null, previousOnFieldIds: null, carryState });

    expect(intervals[1].onField.find((p) => p.id === "p7").isGk).toBe(true); // fewer keeper minutes so far
    expect(intervals[1].onField.find((p) => p.id === "p6").isGk).toBe(false);
  });

  it("end to end: a real generatePlan rebuild after an unrelated outfield swap no longer hands keeper duty to someone who was already on the field", () => {
    const availableIds = ["Jack", "Atu", "Rocco", "George", "Hugo", "Otis", "Eli"];
    const keeperEligibleIds = availableIds;
    const gameMinutes = 45, fieldSize = 5, numIntervals = 9, keeperShiftIntervals = 1;
    const { intervals: fullPlan } = generatePlan({ availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals });

    const activeInterval = 3;
    const cur = fullPlan[activeInterval];
    const priorIntervals = fullPlan.slice(0, activeInterval);
    const outgoingOutfield = cur.onField.find((p) => !p.isGk); // deliberately NOT the keeper
    const benchId = cur.bench[0];
    const frozenCurrent = {
      ...cur,
      onField: cur.onField.map((p) => (p.id === outgoingOutfield.id ? { id: benchId, isGk: false } : p)),
      bench: cur.bench.filter((id) => id !== benchId).concat(outgoingOutfield.id),
    };
    const doneIntervals = [...priorIntervals, frozenCurrent];
    const carryState = buildCarryState(availableIds, doneIntervals);
    const currentGkId = lastGkId(doneIntervals);

    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals,
      startInterval: activeInterval + 1, carryState, currentGkId,
    });
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: frozenCurrent.onField.map((p) => p.id),
    });

    const combined = [...priorIntervals, frozenCurrent, ...rebuiltRemainder];
    for (let i = 0; i < combined.length - 1; i++) {
      const gkNow = combined[i].onField.find((p) => p.isGk)?.id;
      const gkNext = combined[i + 1].onField.find((p) => p.isGk)?.id;
      if (!gkNext || gkNext === gkNow) continue; // same keeper continuing - fine
      expect(combined[i].bench).toContain(gkNext); // a new keeper must have been benched the interval before
    }
  });
});

describe("computeFairnessSpread / isFairSpread", () => {
  it("returns 0 when everyone has exactly the same total on-field time", () => {
    const intervals = [
      { startMin: 0, endMin: 6, onField: [{ id: "p1" }, { id: "p2" }] },
      { startMin: 6, endMin: 12, onField: [{ id: "p1" }, { id: "p2" }] },
    ];
    expect(computeFairnessSpread(intervals, ["p1", "p2"])).toBe(0);
  });

  it("returns the gap between the most and least total time", () => {
    const intervals = [
      { startMin: 0, endMin: 6, onField: [{ id: "p1" }] },
      { startMin: 6, endMin: 12, onField: [{ id: "p1" }] },
    ];
    // p1 played both 6-min intervals (12 total), p2 played neither (0 total).
    expect(computeFairnessSpread(intervals, ["p1", "p2"])).toBe(12);
  });

  it("isFairSpread allows up to roughly one interval's worth of gap, not more", () => {
    expect(isFairSpread(6, 6)).toBe(true); // exactly one interval — fine
    expect(isFairSpread(6.5, 6)).toBe(true); // small rounding buffer — fine
    expect(isFairSpread(12, 6)).toBe(false); // two intervals' worth — not fine
  });
});

describe("computeAveragePitchMinutes", () => {
  it("averages the same per-player totals computeFairnessSpread itself builds", () => {
    const intervals = [
      { startMin: 0, endMin: 6, onField: [{ id: "p1" }] },
      { startMin: 6, endMin: 12, onField: [{ id: "p1" }] },
    ];
    // p1 played both 6-min intervals (12 total), p2 played neither (0 total) — average 6.
    expect(computeAveragePitchMinutes(intervals, ["p1", "p2"])).toBe(6);
  });

  it("returns 0 for no available players", () => {
    expect(computeAveragePitchMinutes([], [])).toBe(0);
  });
});

describe("pickFairStartingGk", () => {
  // 6 players, fieldSize 4, a 36-minute/7-minute-sub game (5 intervals),
  // everyone keeper-eligible. Starting p4, p5, or p6 in goal produces a real
  // 8-minute spread; starting p1, p2, or p3 comes out at 6 minutes — right at
  // the fairness threshold (intervalLen 7.2 + 0.5 = 7.7), so p1/p2/p3 are the
  // only genuinely safe choices. Verified directly against generatePlan, not
  // assumed — this replaces an earlier 7-player/42-minute example that a
  // later fairness fix (see the pickGkFrom comments) completely resolved,
  // leaving no unsafe candidates left to test against.
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];
  const planArgs = { availableIds: ids, gameMinutes: 36, numIntervals: 5, fieldSize: 4, keeperEligibleIds: ids };

  it("never picks a starting keeper that would make the game measurably less fair", () => {
    // Run it many times with the real random source — across enough runs,
    // p4/p5/p6 should never come up if the safety filter is doing its job.
    for (let i = 0; i < 50; i++) {
      const { id } = pickFairStartingGk({ candidates: ids, planArgs });
      expect(["p4", "p5", "p6"]).not.toContain(id);
    }
  });

  it("only ever offers candidates whose resulting plan is actually fair", () => {
    const { id, intervals, spread } = pickFairStartingGk({ candidates: ids, planArgs, random: () => 0 });
    expect(isFairSpread(spread, planArgs.gameMinutes / planArgs.numIntervals)).toBe(true);
    expect(computeFairnessSpread(intervals, ids)).toBe(spread); // the returned plan matches the reported spread
    expect(["p4", "p5", "p6"]).not.toContain(id);
  });

  it("falls back to considering every candidate rather than refusing to produce a plan, if none are fair", () => {
    // Force it by only offering the three known-unfair candidates.
    const { id } = pickFairStartingGk({ candidates: ["p4", "p5", "p6"], planArgs, random: () => 0 });
    expect(["p4", "p5", "p6"]).toContain(id);
  });

  it("random defaults to Math.random but can be injected for deterministic tests", () => {
    const always0 = pickFairStartingGk({ candidates: ids, planArgs, random: () => 0 });
    const always0Again = pickFairStartingGk({ candidates: ids, planArgs, random: () => 0 });
    expect(always0.id).toBe(always0Again.id); // same fixed random -> same pick, reproducibly
  });
});

describe("recommendSubIntervals", () => {
  // Same 7-player, fieldSize-5, 42-minute game used throughout this file.
  // Verified against a real run (not hand-computed): 4, 5, and 8 minute subs
  // all land on a genuinely unfair best case even after trying every
  // starting keeper; 6 and 7 do not. (5 flipped from fair to unfair — 6 min
  // -> 5 min — after the pickGkFrom fairness fix below; re-verified, not
  // just patched to make the test pass.)
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
  const args = { candidateMinutes: [4, 5, 6, 7, 8], gameMinutes: 42, fieldSize: 5, availableIds: ids, keeperEligibleIds: ids };

  it("flags each candidate interval as fair or not, based on the best achievable spread across every starting keeper", () => {
    const result = recommendSubIntervals(args);
    expect(result.map((r) => [r.subIntervalMinutes, r.fair])).toEqual([
      [4, false],
      [5, false],
      [6, true],
      [7, true],
      [8, false],
    ]);
  });

  it("reports the actual best spread and interval length behind each verdict, not just the pass/fail flag", () => {
    const result = recommendSubIntervals(args);
    const five = result.find((r) => r.subIntervalMinutes === 5);
    expect(five).toMatchObject({ numIntervals: 8, bestSpread: 6 });
    const six = result.find((r) => r.subIntervalMinutes === 6);
    expect(six).toMatchObject({ numIntervals: 7, intervalLen: 6, bestSpread: 0 });
    const eight = result.find((r) => r.subIntervalMinutes === 8);
    expect(eight).toMatchObject({ numIntervals: 5, bestSpread: 9 });
  });

  it("changes its verdict when the available headcount changes, even with every other setting identical", () => {
    // Drop to 6 available (still fieldSize + 1, so still generatable) and
    // confirm the recommendation is computed fresh for that squad size, not
    // cached from the 7-player case.
    const sixPlayers = { ...args, availableIds: ids.slice(0, 6), keeperEligibleIds: ids.slice(0, 6) };
    const result = recommendSubIntervals(sixPlayers);
    expect(result).not.toEqual(recommendSubIntervals(args));
  });

  it("falls back to a single plain plan when nobody available is keeper-eligible, rather than erroring", () => {
    const result = recommendSubIntervals({ ...args, keeperEligibleIds: [] });
    expect(result).toHaveLength(5);
    result.forEach((r) => expect(typeof r.bestSpread).toBe("number"));
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

  // The screen this feeds (README > A5-Minutes) exists to *audit* the
  // rotation — this is the actual assertion, over the *full* game: with 5
  // on the pitch and 4 off, pitch and bench minutes should each equal the
  // full game length × 4, and goal minutes should equal the full game
  // length exactly (one keeper, always filled). A mismatch would mean the
  // rotation lost time somewhere, not a rounding artefact.
  it("audit invariant: summed pitch/goal/bench minutes match the squad shape exactly, across the full game", () => {
    const availableIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"];
    const { numIntervals } = computeIntervals(40, 5);
    const { intervals: plan } = generatePlan({
      availableIds, gameMinutes: 40, numIntervals, fieldSize: 5, keeperEligibleIds: ["p1", "p2", "p3"],
    });
    const summary = computeMinutesSummary(plan, availableIds);
    const totalOutfield = summary.reduce((sum, s) => sum + s.outfieldMin, 0);
    const totalGk = summary.reduce((sum, s) => sum + s.gkMin, 0);
    const totalBench = summary.reduce((sum, s) => sum + s.benchMin, 0);
    expect(totalGk).toBeCloseTo(40, 5);
    expect(totalOutfield).toBeCloseTo(40 * 4, 5);
    expect(totalBench).toBeCloseTo(40 * 4, 5);
  });
});

describe("computeNextChangeBadges", () => {
  const makeIv = (onFieldIds, gkId, bench) => ({
    onField: onFieldIds.map((id) => ({ id, isGk: id === gkId })),
    bench,
  });

  it("shows nothing when there's no next interval (viewing the last interval of the game)", () => {
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const result = computeNextChangeBadges({
      cur, nextIv: undefined, curGk: { id: "p1" }, nextGk: undefined, gkChanging: false,
    });
    expect(result.comingOffIds.size).toBe(0);
    expect(result.comingOnIds.size).toBe(0);
  });

  it("flags a regular sub: who's off, who's on, no keeper involved", () => {
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p1", "p3"], "p1", ["p2"]);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p1" }, gkChanging: false,
    });
    expect(result.comingOffIds).toEqual(new Set(["p2"]));
    expect(result.comingOnIds).toEqual(new Set(["p3"]));
    expect(result.becomingKeeperId).toBeNull();
    expect(result.steppingDownKeeperId).toBeNull();
  });

  it("flags the incoming keeper distinctly, even though they're also a genuine bench arrival", () => {
    // p1 (gk) and p2 leave; p3 arrives and becomes the new keeper
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p3", "p4"], "p3", []);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true,
    });
    expect(result.becomingKeeperId).toBe("p3");
    // p3 must NOT also show up as a regular "coming on" — the keeper badge
    // replaces it, not adds to it.
    expect(result.comingOnIds.has("p3")).toBe(false);
    // p4 is a genuine, unrelated arrival and still gets the regular badge.
    expect(result.comingOnIds).toEqual(new Set(["p4"]));
    expect(result.comingOffIds).toEqual(new Set(["p1", "p2"]));
  });

  it("flags the outgoing keeper as stepping-down when they stay on the pitch", () => {
    // p1 (gk) stays on the pitch as an outfielder; p3 (bench) becomes the new keeper
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p1", "p3"], "p3", ["p2"]);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true,
    });
    expect(result.becomingKeeperId).toBe("p3");
    expect(result.steppingDownKeeperId).toBe("p1");
    // p1 stays on the pitch, so must NOT also show a "coming off" badge.
    expect(result.comingOffIds.has("p1")).toBe(false);
    expect(result.comingOffIds).toEqual(new Set(["p2"]));
  });

  it("does not flag the outgoing keeper as stepping-down when they're also leaving the pitch entirely", () => {
    // p1 (gk) leaves the pitch outright — the regular "coming off" badge
    // already covers them, no need for a second badge.
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p2", "p3"], "p3", ["p1"]);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true,
    });
    expect(result.steppingDownKeeperId).toBeNull();
    expect(result.comingOffIds).toEqual(new Set(["p1"]));
    expect(result.becomingKeeperId).toBe("p3");
  });
});

describe("pairChanges", () => {
  it("zips a plain regular sub with no keeper involved", () => {
    const rows = pairChanges({
      comingOffIds: new Set(["p2"]), comingOnIds: new Set(["p3"]), curGkId: "p1", becomingKeeperId: null,
    });
    expect(rows).toEqual([{ outId: "p2", inId: "p3", outIsKeeper: false, inIsKeeper: false }]);
  });

  it("shows an in-place keeper swap as its own row even when neither player leaves the pitch", () => {
    // Real scenario this covers: p1 and p3 are both already on the pitch;
    // p3 simply takes over the gloves from p1. Nobody moves to/from the
    // bench for the keeper change itself, but it's still worth a row.
    const rows = pairChanges({
      comingOffIds: new Set(["p4"]), comingOnIds: new Set(["p6"]), curGkId: "p1", becomingKeeperId: "p3",
    });
    expect(rows).toEqual([
      { outId: "p1", inId: "p3", outIsKeeper: true, inIsKeeper: true },
      { outId: "p4", inId: "p6", outIsKeeper: false, inIsKeeper: false },
    ]);
  });

  it("leaves a regular departure unpaired (not force-matched) when the outgoing keeper stepping down absorbs a vacancy instead of a bench arrival — real bug found on a real device", () => {
    // The outgoing keeper (p1) stays on the pitch as an outfielder rather
    // than leaving — so comingOffIds never contained them, and nothing
    // gets removed from the "off" side. The incoming keeper (p5) *is* a
    // genuine bench arrival, so the "on" side does lose a real member.
    // Two regular players (p2, p3) come off; only one bench player (p4)
    // is left to pair with them once p5 is set aside for the keeper row —
    // the second departure (p3) is real, not a bug, and should render
    // with no invented partner rather than silently vanishing or getting
    // wrongly paired with p5.
    const rows = pairChanges({
      comingOffIds: new Set(["p2", "p3"]), comingOnIds: new Set(["p4"]), curGkId: "p1", becomingKeeperId: "p5",
    });
    expect(rows).toEqual([
      { outId: "p1", inId: "p5", outIsKeeper: true, inIsKeeper: true },
      { outId: "p2", inId: "p4", outIsKeeper: false, inIsKeeper: false },
      { outId: "p3", inId: null, outIsKeeper: false, inIsKeeper: false },
    ]);
  });

  it("leaves an arrival unpaired the other way around: outgoing keeper truly leaves, incoming keeper was already on the pitch", () => {
    const rows = pairChanges({
      comingOffIds: new Set(["p1", "p2"]), comingOnIds: new Set(["p4", "p6"]), curGkId: "p1", becomingKeeperId: "p3",
    });
    expect(rows).toEqual([
      { outId: "p1", inId: "p3", outIsKeeper: true, inIsKeeper: true },
      { outId: "p2", inId: "p4", outIsKeeper: false, inIsKeeper: false },
      { outId: null, inId: "p6", outIsKeeper: false, inIsKeeper: false },
    ]);
  });

  it("does not create a keeper row at all when nobody's changing gloves", () => {
    const rows = pairChanges({
      comingOffIds: new Set(["p2"]), comingOnIds: new Set(["p3"]), curGkId: "p1", becomingKeeperId: null,
    });
    expect(rows.every((r) => !r.outIsKeeper && !r.inIsKeeper)).toBe(true);
  });
});

describe("aggregateSeasonSummary", () => {
  const player = (id, name, overrides = {}) => ({ id, name, outfieldMin: 0, gkMin: 0, benchMin: 0, injuredMin: 0, ...overrides });

  it("sums minutes across games for a player who played every game", () => {
    const games = [
      { date: 2, players: [player("p1", "Alice", { outfieldMin: 30, gkMin: 10 })] },
      { date: 1, players: [player("p1", "Alice", { outfieldMin: 20, gkMin: 0 })] },
    ];
    const [result] = aggregateSeasonSummary(games);
    expect(result.gamesPlayed).toBe(2);
    expect(result.outfieldMin).toBe(50);
    expect(result.gkMin).toBe(10);
    expect(result.avgOutfieldMin).toBe(25);
  });

  it("a player absent from a game contributes nothing to their standing — not a bonus, not a penalty", () => {
    // p2 only appears in one of the two games (wasn't available for the other).
    const games = [
      { date: 2, players: [player("p1", "Alice", { outfieldMin: 30 }), player("p2", "Bob", { outfieldMin: 30 })] },
      { date: 1, players: [player("p1", "Alice", { outfieldMin: 30 })] }, // Bob absent this game
    ];
    const result = aggregateSeasonSummary(games);
    const bob = result.find((r) => r.id === "p2");
    expect(bob.gamesPlayed).toBe(1); // not 2 — the missed game was never counted at all
    expect(bob.outfieldMin).toBe(30);
    expect(bob.avgOutfieldMin).toBe(30); // unaffected by the game he wasn't part of
  });

  it("keeps the name from the most recent game (games passed newest-first) over an older one", () => {
    const games = [
      { date: 2, players: [player("p1", "Alice B.")] }, // most recent
      { date: 1, players: [player("p1", "Alice")] }, // older, pre-rename
    ];
    const [result] = aggregateSeasonSummary(games);
    expect(result.name).toBe("Alice B.");
  });

  it("returns an empty array for no games and treats a missing players list as empty", () => {
    expect(aggregateSeasonSummary([])).toEqual([]);
    expect(aggregateSeasonSummary(undefined)).toEqual([]);
    expect(aggregateSeasonSummary([{ date: 1 }])).toEqual([]); // no players field on that game
  });
});
