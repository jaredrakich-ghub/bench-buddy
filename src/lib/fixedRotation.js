/**
 * Path B: a fixed round-robin rotation schedule, built once per game as
 * pure arithmetic — not generatePlan's per-interval "who's owed the most
 * right now" heuristic (rotation.js). Kept in its own file, alongside the
 * existing engine rather than replacing it, specifically so both can be
 * run side by side against the same real scenarios before anything in the
 * app actually switches over — see the memory note on this redesign for
 * why (sub-tracker-rotation-redesign-roadmap.md) and AI-DEVELOPMENT-RULES.md
 * for why big changes get built this way here.
 *
 * The core idea: line every available player up in a fixed order once.
 * Bench assignment for interval i is just "the next `benchSpots` players in
 * that order, cyclically" — nobody's minutes are tracked or compared to
 * decide it, so bench-turn counts are guaranteed to differ by at most 1
 * across everyone, by construction, not by a heuristic converging well.
 * Keeper duty is assigned only to someone actually arriving onto the field
 * that interval (if eligible) — a structural guarantee, not a tiebreak —
 * with a genuine fallback for when nobody arriving is eligible.
 *
 * Deliberately narrow about what this promises: bench-turn fairness,
 * keeper-turn fairness (both ±1, provably), and bench->keeper always. It
 * does NOT try to independently smooth outfield-only minutes — that
 * turned out to be a different problem this design can't win (see
 * generateFixedPlan's comment) that recommendSubIntervals (rotation.js)
 * already solves better, by steering a coach toward settings that divide
 * evenly rather than compensating after the fact for ones that don't.
 *
 * The three real live games that motivated this (see conversation/commit
 * history around this file's introduction) are the actual regression
 * fixtures for this engine — see fixedRotation.test.js.
 */

// Interval i's bench is the next `benchSpots` players from `rotationOrder`,
// read cyclically starting at position `i * benchSpots`. Consecutive
// intervals draw consecutive, non-overlapping (as long as benchSpots <=
// half the squad, the normal case) slices of the same repeating sequence,
// which is what gives the ±1 guarantee: over `numIntervals * benchSpots`
// total slots cycling through `rotationOrder.length` positions, no
// position is hit more than ceil(total/n) times or fewer than floor.
export function buildBenchSchedule({ rotationOrder, numIntervals, benchSpots }) {
  const n = rotationOrder.length;
  const schedule = [];
  for (let i = 0; i < numIntervals; i++) {
    const bench = [];
    for (let j = 0; j < benchSpots; j++) {
      bench.push(rotationOrder[(i * benchSpots + j) % n]);
    }
    schedule.push(bench);
  }
  return schedule;
}

// Assigns a keeper per interval from a fixed bench schedule. The rule,
// applied in order:
//   1. A manual starting-keeper override, at interval 0 only (same
//      semantics as generatePlan's startingGkId).
//   2. Off a keeper-shift boundary: keep the same keeper, if they're still
//      on the field.
//   3. Otherwise: whoever is *arriving* onto the field this interval
//      (on-field now, benched last interval) and is keeper-eligible always
//      wins — never an already-on-field player, as long as at least one
//      eligible arrival exists. Among multiple eligible arrivals (a deeper
//      bench with several spots), whoever's played the least keeper so far
//      wins, tie broken by position in `rotationOrder` — a fair, bounded
//      priority scoped to just that interval's actual arrivals.
//   4. Genuine fallback, only when nobody arriving is eligible: pick the
//      least-keeper-minutes eligible player from the *whole* current
//      on-field group instead. This is the one place bench->keeper can be
//      broken — and only when there's truly no eligible alternative, not
//      as a routine tradeoff the way generatePlan's tie-break-only rule
//      could be.
export function assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null }) {
  const numIntervals = benchSchedule.length;
  const eligibleSet = new Set(keeperEligibleIds || []);
  const shiftLen = Math.max(1, keeperShiftIntervals);

  const onFieldSets = benchSchedule.map((bench) => {
    const benchSet = new Set(bench);
    return rotationOrder.filter((id) => !benchSet.has(id));
  });

  // How many keeper turns each eligible player is already *guaranteed* to
  // get from their own future bench arrivals, before any free choice is
  // made — known upfront, since the whole bench schedule is built before
  // any keeper is assigned. A bench turn at any interval except the very
  // last one always converts into that same player becoming keeper next
  // interval (arriving-and-eligible always wins, by the rule above); a
  // bench turn at the final interval never converts into anything, since
  // the game ends right after. So this is exact, not a proxy.
  //
  // This matters for the two genuinely free keeper choices below (the
  // interval-0 starting pick, and the rare true fallback): every other
  // pick is already forced by a specific player's own bench arrival, so
  // there's nothing left to steer there. Spending a free choice on whoever
  // has the *fewest* guaranteed turns keeps everyone's total as close to
  // equal as the schedule allows. Two real bugs were caught by testing this
  // against real games before landing on this exact formula: an earlier
  // "avoid above-average bench turns" version could still default a free
  // pick to a player who already had a guaranteed turn (stacking a 3rd
  // keeper turn onto them) whenever bench turns happened to be uneven, and
  // gave no useful signal at all whenever bench turns came out perfectly
  // even (every player looks identical at "average"), which is exactly
  // when a clean, deliberate choice matters most — a clean 42-min/6-player
  // game left one player with 2 keeper turns and another with zero despite
  // 6 turns dividing perfectly evenly across 6 players.
  const guaranteedKeeperTurns = {};
  rotationOrder.forEach((id) => (guaranteedKeeperTurns[id] = 0));
  benchSchedule.forEach((bench, i) => {
    if (i === numIntervals - 1) return; // final interval's bench never triggers anything
    bench.forEach((id) => {
      if (eligibleSet.has(id)) guaranteedKeeperTurns[id] += 1;
    });
  });

  // Total bench turns, as a *second* free-pick criterion behind
  // guaranteedKeeperTurns, not a replacement for it — needed because
  // several players can genuinely tie on guaranteedKeeperTurns while still
  // differing on how much bench time they're already carrying. Found by
  // testing: guaranteedKeeperTurns alone let a free pick land on a player
  // tied for "fewest forced keeper turns" but who *also* had more bench
  // turns than the other tied candidates, stacking them anyway when an
  // equally-eligible, less-loaded teammate was sitting right there.
  const totalBenchTurns = {};
  rotationOrder.forEach((id) => (totalBenchTurns[id] = 0));
  benchSchedule.forEach((bench) => bench.forEach((id) => (totalBenchTurns[id] += 1)));

  const gkMinutesSoFar = {};
  rotationOrder.forEach((id) => (gkMinutesSoFar[id] = 0));
  const orderIndex = {};
  rotationOrder.forEach((id, i) => (orderIndex[id] = i));

  // Among a candidate pool, least keeper time so far wins; ties break by
  // fixed position in rotationOrder (deterministic, not array-order luck —
  // rotationOrder is already the one place ordering was deliberately
  // chosen). `free` additionally prefers whoever has the fewest guaranteed
  // future keeper turns first — only meaningful (and only used) for the
  // two genuinely free choices; every other call leaves this off, since
  // there's nothing to steer once a specific arriving player has already
  // earned the slot.
  const pickLeastGk = (pool, { free = false } = {}) =>
    [...pool].sort((a, b) => {
      if (free) {
        if (guaranteedKeeperTurns[a] !== guaranteedKeeperTurns[b]) return guaranteedKeeperTurns[a] - guaranteedKeeperTurns[b];
        if (totalBenchTurns[a] !== totalBenchTurns[b]) return totalBenchTurns[a] - totalBenchTurns[b];
      }
      return gkMinutesSoFar[a] - gkMinutesSoFar[b] || orderIndex[a] - orderIndex[b];
    })[0];

  const gkPerInterval = [];
  let prevGk = null;
  let prevOnFieldSet = new Set();

  for (let i = 0; i < numIntervals; i++) {
    const onField = onFieldSets[i];
    const onFieldSet = new Set(onField);
    const atShiftBoundary = i % shiftLen === 0;
    const eligibleOnField = onField.filter((id) => eligibleSet.has(id));

    let gk;
    if (i === 0 && startingGkId && onFieldSet.has(startingGkId) && eligibleSet.has(startingGkId)) {
      gk = startingGkId;
    } else if (i === 0) {
      // The one truly free pick in the whole game — nobody "arrived" yet,
      // so there's no bench-arrival claim to honor, only a choice to make
      // well. See the guaranteedKeeperTurns comment above.
      gk = eligibleOnField.length > 0 ? pickLeastGk(eligibleOnField, { free: true }) : null;
    } else if (!atShiftBoundary && prevGk && onFieldSet.has(prevGk)) {
      gk = prevGk;
    } else {
      const arrivingEligible = onField.filter((id) => !prevOnFieldSet.has(id) && eligibleSet.has(id));
      if (arrivingEligible.length > 0) {
        gk = pickLeastGk(arrivingEligible);
      } else if (eligibleOnField.length > 0) {
        gk = pickLeastGk(eligibleOnField, { free: true }); // genuine fallback — nobody eligible arrived
      } else {
        gk = null; // no eligible keeper anywhere on the field this interval
      }
    }

    gkPerInterval.push(gk);
    if (gk) gkMinutesSoFar[gk] += 1; // relative units are fine here — only used to compare within this run
    prevGk = gk;
    prevOnFieldSet = onFieldSet;
  }

  return gkPerInterval;
}

// Combines the two into the same { intervals: [...] } shape generatePlan
// produces, so this can be swapped in wherever generatePlan is used without
// the caller (or SummaryModal, computeMinutesSummary, etc.) needing to
// change at all.
export function buildFixedPlan({
  rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
}) {
  const size = Math.min(fieldSize, rotationOrder.length);
  const benchSpots = rotationOrder.length - size;
  const intervalLen = gameMinutes / numIntervals;

  const benchSchedule = buildBenchSchedule({ rotationOrder, numIntervals, benchSpots });
  const gkPerInterval = assignKeepers({ rotationOrder, benchSchedule, keeperEligibleIds, keeperShiftIntervals, startingGkId });

  const intervals = benchSchedule.map((bench, i) => {
    const benchSet = new Set(bench);
    const onField = rotationOrder.filter((id) => !benchSet.has(id));
    const gk = gkPerInterval[i];
    return {
      index: i,
      startMin: Math.round(i * intervalLen),
      endMin: Math.round((i + 1) * intervalLen),
      onField: onField.map((id) => ({ id, isGk: id === gk })),
      bench,
    };
  });

  return { intervals };
}

// Diagnostic only — not used to make any decision below. How many players
// land in *both* the above-average bench-turn group and the above-average
// keeper-turn group — the "double-stacking" a coach actually feels
// (reduced running time, with neither extra keeper duty nor extra bench
// time softening it, both landing on the same kid instead of spreading
// out). 0 when the numbers divide evenly (nobody's above average) or when
// the two "extra lap" groups don't overlap at all. Useful for tests and
// for explaining a specific game's outcome; see generateFixedPlan's
// comment for why this isn't something worth searching over.
export function countDoubleStacked(intervals, keeperEligibleIds) {
  const eligibleSet = new Set(keeperEligibleIds || []);
  const benchCounts = {};
  const gkCounts = {};
  intervals.forEach((iv) => {
    iv.bench.forEach((id) => (benchCounts[id] = (benchCounts[id] || 0) + 1));
    const gk = iv.onField.find((p) => p.isGk);
    if (gk) gkCounts[gk.id] = (gkCounts[gk.id] || 0) + 1;
  });

  const aboveAverage = (counts, ids) => {
    const values = ids.map((id) => counts[id] || 0);
    if (values.length === 0) return new Set();
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return new Set(ids.filter((id) => (counts[id] || 0) > avg + 1e-9));
  };

  const allIds = Object.keys(benchCounts);
  const highBench = aboveAverage(benchCounts, allIds);
  const eligibleIds = allIds.filter((id) => eligibleSet.has(id));
  const highGk = aboveAverage(gkCounts, eligibleIds);

  return [...highBench].filter((id) => highGk.has(id)).length;
}

// Diagnostic only — not used to make any decision below (see
// generateFixedPlan's comment for why). The gap between whoever's run
// around outfield the most and the least — the actual thing a kid and a
// parent notice, and blind to by computeFairnessSpread (rotation.js),
// which treats a keeper minute as equal to an outfield minute. Turn-count
// fairness on bench and keeper turns separately (which the schedule
// already guarantees, each to within ±1) does not by itself guarantee
// this is small — found by sweeping this engine against real games and
// comparing it directly, not assumed.
export function computeOutfieldSpread(intervals, availableIds) {
  const totals = {};
  availableIds.forEach((id) => (totals[id] = 0));
  intervals.forEach((iv) => {
    const len = iv.endMin - iv.startMin;
    iv.onField.forEach((p) => {
      if (!p.isGk && totals[p.id] !== undefined) totals[p.id] += len;
    });
  });
  const values = Object.values(totals);
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

// The actual entry point a coach's "Generate" hits. Shuffles the rotation
// order (real week-to-week variety — a different player experiences
// whatever the "extra lap" is each time) and builds the plan once.
//
// An earlier version tried every possible rotation phase and kept whichever
// measured best on outfield spread and double-stacking, the same
// "simulate real candidates, keep the best" pattern pickFairStartingGk
// uses in rotation.js. It was pure wasted work: proven directly by trying
// all of them against a real scenario, every single phase of this
// schedule produces *identical* bench-turn counts, keeper-turn counts, and
// outfield-minute spread — rotating only changes *who* gets which outcome,
// never how good the outcome is, because the schedule's fairness comes
// entirely from buildBenchSchedule's arithmetic and assignKeepers' one
// deliberate tiebreak (see its comment), neither of which cares which
// player holds which position. There was nothing left to search for, so
// this just builds the one schedule the arithmetic already guarantees.
//
// `startingGkId` gets one piece of special handling: the shuffle could
// happen to land them in the bench block for interval 0, which would
// silently ignore the request (assignKeepers only honors a starting pick
// who's actually on the field). Swapping them into an on-field position
// first keeps the request honored without needing a re-shuffle.
export function generateFixedPlan({
  availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null, random = Math.random,
}) {
  const rotationOrder = shuffle(availableIds, random);

  if (startingGkId && rotationOrder.includes(startingGkId)) {
    const benchSpots = rotationOrder.length - Math.min(fieldSize, rotationOrder.length);
    const idx = rotationOrder.indexOf(startingGkId);
    if (idx < benchSpots) {
      [rotationOrder[idx], rotationOrder[benchSpots]] = [rotationOrder[benchSpots], rotationOrder[idx]];
    }
  }

  return buildFixedPlan({ rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals, startingGkId });
}

function shuffle(array, random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
