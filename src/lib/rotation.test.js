import { describe, it, expect } from "vitest";
import {
  intervalAtElapsed,
  computeIntervals,
  buildCarryState,
  generatePlan,
  computeMinutesSummary,
  keeperShiftIntervalsFor,
  lastGkId,
  benchPriorityCompare,
  resolveBringBack,
  resolveAutoFollowInterval,
  computeNextChangeBadges,
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

describe("resolveAutoFollowInterval", () => {
  it("does nothing when the live interval hasn't changed", () => {
    expect(resolveAutoFollowInterval({ liveInterval: 2, lastLiveInterval: 2, currentActiveInterval: 5 })).toBe(5);
  });

  it("follows to the new live interval when the board was already showing the previous live one", () => {
    // board was on interval 2 (== lastLiveInterval), live just advanced to 3
    expect(resolveAutoFollowInterval({ liveInterval: 3, lastLiveInterval: 2, currentActiveInterval: 2 })).toBe(3);
  });

  it("leaves the board alone when the coach had navigated away from live", () => {
    // board is on interval 5 (browsing ahead), live advances from 2 to 3 —
    // this is the exact bug this function fixes: the coach shouldn't get
    // yanked back to 3 just because live moved on.
    expect(resolveAutoFollowInterval({ liveInterval: 3, lastLiveInterval: 2, currentActiveInterval: 5 })).toBe(5);
  });

  it("resumes following once the coach navigates back to match the live interval", () => {
    // coach manually returns to interval 2 (== lastLiveInterval so far);
    // next time live advances, following should resume normally.
    expect(resolveAutoFollowInterval({ liveInterval: 3, lastLiveInterval: 2, currentActiveInterval: 2 })).toBe(3);
  });
});

describe("computeNextChangeBadges", () => {
  const makeIv = (onFieldIds, gkId, bench) => ({
    onField: onFieldIds.map((id) => ({ id, isGk: id === gkId })),
    bench,
  });

  it("shows nothing when not viewing the live interval", () => {
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p1", "p3"], "p1", ["p2"]);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p1" }, gkChanging: false, isViewingLiveInterval: false,
    });
    expect(result).toEqual({ comingOffIds: new Set(), comingOnIds: new Set(), becomingKeeperId: null, steppingDownKeeperId: null });
  });

  it("shows nothing when there's no next interval (last interval of the game)", () => {
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const result = computeNextChangeBadges({
      cur, nextIv: undefined, curGk: { id: "p1" }, nextGk: undefined, gkChanging: false, isViewingLiveInterval: true,
    });
    expect(result.comingOffIds.size).toBe(0);
    expect(result.comingOnIds.size).toBe(0);
  });

  it("flags a regular sub: who's off, who's on, no keeper involved", () => {
    const cur = makeIv(["p1", "p2"], "p1", ["p3"]);
    const nextIv = makeIv(["p1", "p3"], "p1", ["p2"]);
    const result = computeNextChangeBadges({
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p1" }, gkChanging: false, isViewingLiveInterval: true,
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
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true, isViewingLiveInterval: true,
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
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true, isViewingLiveInterval: true,
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
      cur, nextIv, curGk: { id: "p1" }, nextGk: { id: "p3" }, gkChanging: true, isViewingLiveInterval: true,
    });
    expect(result.steppingDownKeeperId).toBeNull();
    expect(result.comingOffIds).toEqual(new Set(["p1"]));
    expect(result.becomingKeeperId).toBe("p3");
  });
});
