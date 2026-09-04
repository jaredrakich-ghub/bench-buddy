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
 * buildBenchSchedule/assignKeepers/buildFixedPlan (below) are the ORIGINAL
 * fresh-game engine: line every player up in a fixed order once, slice
 * bench turns cyclically from it, assign keepers off the resulting
 * schedule. That guarantees bench-turn fairness (±1, by construction) and
 * bench->keeper always — but outfield minutes were only ever an emergent
 * side effect of the bench arithmetic, never a directly targeted outcome.
 * Real games showed that can leave outfield minutes uneven even when bench
 * counts look perfectly balanced, especially once keeper shifts span
 * several intervals (extra keeper time silently eats into outfield time
 * unless something deliberately compensates via bench).
 *
 * generateFixedPlan (the only one of these actually called by the live
 * app) now builds on buildFairSchedule instead — which reuses the
 * ORIGINAL engine unchanged as its base (so every existing keeper rule
 * stays exactly as it was — arriving-eligible preferred, least keeper-
 * so-far, keeperShiftIntervals, startingGkId, existing fallback), then
 * runs two targeted repair passes on top: repairKeeperBalance evens out
 * keeper duty specifically among keeper-eligible players (pure role
 * swaps, never touching bench), then repairOutfieldBalance closes any
 * remaining outfield gap via safe outfield<->bench swaps. Neither pass
 * ever changes who's actually keeper in a way that breaks bench->keeper.
 * An earlier version tried to PRE-COMPUTE a fair keeper split (via
 * computeIntervalTargets) and build outfield/bench around it directly —
 * abandoned because keeper duty is bounded by how many bench-to-field
 * arrivals a player gets, which a pre-plan can't always honor once the
 * real bench schedule is built; see buildFairSchedule's own comment for
 * the specific failure this caused. computeIntervalTargets is kept as an
 * independent "theoretical best" reference for tests (see
 * fixedRotation.fairness.test.js) — it deliberately does NOT model the
 * arriving-constraint's coupling, so it's an optimistic upper bound, not
 * a guarantee; a real configuration (single bench spot, full eligibility)
 * was found where its target is provably unachievable, documented in that
 * test file. calculateFairness measures what a plan actually achieved
 * (ideal: range ≤1 interval; acceptable: ≤2).
 *
 * buildBenchSchedule/assignKeepers/buildFixedPlan are kept exactly as they
 * were — continueFixedPlan (mid-game continuation, still dormant/unwired)
 * keeps using them unchanged. This rewrite is deliberately scoped to fresh
 * games only; Path A (rotation.js, injuries/bring-backs/manual swaps)
 * isn't touched by any of this.
 *
 * The three real live games that motivated the original engine (see
 * conversation/commit history around this file's introduction) are still
 * the regression fixtures for buildFixedPlan — see fixedRotation.test.js.
 * The outfield-fairness rewrite has its own regression suite —
 * fixedRotation.fairness.test.js.
 *
 * Mid-game continuation (continueFixedPlan): reuses
 * buildCarryState/benchPriorityCompare/lastGkId from rotation.js rather
 * than reinventing "who's owed a turn" — those are already the app's one
 * definition of fairness for a rebuild, and reusing them means this can
 * never quietly drift from what generatePlan's own carryState-based
 * rebuild already does for injuries/swaps.
 */
import { benchPriorityCompare } from "./rotation.js";

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
export function assignKeepers({
  rotationOrder, benchSchedule, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
  startIndex = 0, currentGkId = null, previousOnFieldIds = null, initialGkMinutes = null, intervalLen = 1,
}) {
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

  // Seeded from a prior part of the game when this is a mid-game
  // continuation (see continueFixedPlan below) — real minutes, not turn
  // counts, so they stay comparable with what gets added below. Defaults
  // to everyone at zero for a fresh game, same as before.
  const gkMinutesSoFar = {};
  rotationOrder.forEach((id) => (gkMinutesSoFar[id] = (initialGkMinutes && initialGkMinutes[id]) || 0));
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
  // Seeded from the actual game state for a continuation (who's currently
  // in goal, who was actually on the field the moment before this call's
  // first interval) instead of always starting blank — see
  // continueFixedPlan. Left at their fresh-game defaults (null / empty),
  // `previousOnFieldIds` staying unset is exactly what makes
  // `isGenuineStart` below true only for an actual fresh game, never a
  // continuation.
  let prevGk = currentGkId;
  let prevOnFieldSet = new Set(previousOnFieldIds || []);

  for (let i = 0; i < numIntervals; i++) {
    const absoluteIndex = startIndex + i;
    const onField = onFieldSets[i];
    const onFieldSet = new Set(onField);
    const atShiftBoundary = absoluteIndex % shiftLen === 0;
    const eligibleOnField = onField.filter((id) => eligibleSet.has(id));
    // True only for interval 0 of an actual fresh game (no prior on-field
    // state to compare against) — a continuation always seeds
    // prevOnFieldSet with the real state just before it, so this is false
    // for every interval of a rebuild, including its first, and "arriving"
    // correctly means "actually arriving from the bench" throughout.
    const isGenuineStart = i === 0 && prevOnFieldSet.size === 0;

    let gk;
    if (i === 0 && startingGkId && onFieldSet.has(startingGkId) && eligibleSet.has(startingGkId)) {
      gk = startingGkId;
    } else if (isGenuineStart) {
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
    if (gk) gkMinutesSoFar[gk] += intervalLen;
    prevGk = gk;
    prevOnFieldSet = onFieldSet;
  }

  return gkPerInterval;
}

// Combines the two into the same { intervals: [...] } shape generatePlan
// produces, so this can be swapped in wherever generatePlan is used without
// the caller (or SummaryModal, computeMinutesSummary, etc.) needing to
// change at all.
//
// `numIntervals` is always the *whole* game's interval count (needed to
// compute each interval's real start/end minute correctly) — `startIndex`
// says where this particular call's bench schedule should pick up from,
// so a continuation only builds the intervals it's actually responsible
// for (see continueFixedPlan) while still landing on the correct absolute
// timestamps and shift-boundary alignment. Defaults reproduce a fresh
// whole-game build exactly as before.
export function buildFixedPlan({
  rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
  startIndex = 0, currentGkId = null, previousOnFieldIds = null, initialGkMinutes = null,
}) {
  const size = Math.min(fieldSize, rotationOrder.length);
  const benchSpots = rotationOrder.length - size;
  const intervalLen = gameMinutes / numIntervals;
  const intervalsToBuild = numIntervals - startIndex;

  // Real bug (real-use report): buildBenchSchedule below is plain
  // round-robin arithmetic with no idea who's keeper-eligible, so with
  // exactly one eligible player it could — and reliably did — cycle them
  // onto the bench like anyone else, leaving genuinely nobody eligible to
  // fill goal that interval (assignKeepers' own documented fallback:
  // gk = null, an empty goal). There's no fair way to give a sole keeper a
  // bench turn without leaving the goal empty, so they're excluded from
  // the bench-cycling pool entirely here — on the field, in goal, every
  // interval, full game. benchSpots itself doesn't need adjusting:
  // removing one player from the cycling pool and reducing the effective
  // on-field headcount by that same one player both shrink by 1, so their
  // difference (what benchSpots actually measures) is unchanged — bench
  // turns among everyone else still rotate exactly as before.
  // repairKeeperBalance/repairOutfieldBalance (buildFairSchedule, below)
  // can't undo this: both only ever move a player who's currently outfield
  // or currently benched, and the exempted keeper is structurally never
  // either.
  const eligibleInOrder = rotationOrder.filter((id) => (keeperEligibleIds || []).includes(id));
  const soleKeeperId = eligibleInOrder.length === 1 ? eligibleInOrder[0] : null;
  const benchCycleOrder = soleKeeperId ? rotationOrder.filter((id) => id !== soleKeeperId) : rotationOrder;

  const benchSchedule = buildBenchSchedule({ rotationOrder: benchCycleOrder, numIntervals: intervalsToBuild, benchSpots });
  const gkPerInterval = assignKeepers({
    rotationOrder, benchSchedule, keeperEligibleIds, keeperShiftIntervals, startingGkId,
    startIndex, currentGkId, previousOnFieldIds, initialGkMinutes, intervalLen,
  });

  const intervals = benchSchedule.map((bench, i) => {
    const benchSet = new Set(bench);
    const onField = rotationOrder.filter((id) => !benchSet.has(id));
    const gk = gkPerInterval[i];
    const absoluteIndex = startIndex + i;
    return {
      index: absoluteIndex,
      startMin: Math.round(absoluteIndex * intervalLen),
      endMin: Math.round((absoluteIndex + 1) * intervalLen),
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
// the two "extra lap" groups don't overlap at all. Predates
// calculateFairness (below) — kept for buildFixedPlan/continueFixedPlan's
// existing tests, which still exercise the original bench-schedule-first
// engine unchanged. For the fresh-game path (buildFairSchedule), use
// calculateFairness instead.
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

// Diagnostic only — not used to make any decision below. The gap between
// whoever's run around outfield the most and the least — the actual thing
// a kid and a parent notice, and blind to by computeFairnessSpread
// (rotation.js), which treats a keeper minute as equal to an outfield
// minute. Turn-count fairness on bench and keeper turns separately does
// not by itself guarantee this is small — the exact gap this file's
// outfield-fairness rewrite exists to close directly (see the module
// comment and calculateFairness) rather than leaving to bench arithmetic.
// Predates calculateFairness — kept for buildFixedPlan/continueFixedPlan's
// existing tests; for the fresh-game path use calculateFairness instead.
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

// Splits `totalUnits` as evenly as possible across `orderedIds` — everyone
// gets floor(totalUnits/n), except the first `totalUnits % n` ids in the
// given order, who get one more. The CALLER controls who's "first" by the
// order it passes in — computeIntervalTargets uses this to make sure the
// scarce "+1" slots go to whoever has the least room to spare, not an
// arbitrary or position-based bias.
function distributeEvenly(totalUnits, orderedIds) {
  const n = orderedIds.length;
  const result = {};
  if (n === 0) return result;
  const base = Math.floor(totalUnits / n);
  const remainder = totalUnits - base * n;
  orderedIds.forEach((id, i) => {
    result[id] = base + (i < remainder ? 1 : 0);
  });
  return result;
}

// Stage 1 of the outfield-fairness rewrite: work out each player's target
// outfield/keeper/bench interval counts BEFORE building anything, so the
// schedule can be constructed *toward* a known-fair final distribution
// instead of hoping one emerges from bench arithmetic. See the module
// comment for the overall design; this is the piece that makes the
// required relationship (outfield = total - bench - keeper) explicit
// rather than accidental.
//
// Keeper targets come first: numIntervals is split into keeperShiftIntervals
// -sized blocks (the last one shorter if it doesn't divide evenly), block 0
// going to startingGkId if given and eligible — mirroring exactly how
// assignKeepers already behaves (they hold the whole first shift as long as
// they stay on the field) — and the rest distributed round robin,
// least-loaded-so-far first, among eligible players. If nobody's eligible,
// every keeper target is 0 and every on-field slot counts as outfield
// instead (matches assignKeepers' existing null-keeper fallback).
//
// Outfield targets are then split evenly across ALL players — but the
// scarce "+1" remainder slots go to whoever has the LOWEST keeper target
// first, not an arbitrary order. That's the actual compensation mechanism:
// a player already carrying more keeper duty has less room left before
// their bench target would go negative, so they shouldn't also get first
// claim on the extra outfield slots.
//
// Bench targets are DERIVED, never independently targeted:
// targetBench = numIntervals - targetOutfield - targetKeeper. This is
// where "more keeper time means less bench time, not less outfield time"
// actually gets enforced. A defensive repair pass (rare in practice —
// needs a keeper shift long enough relative to numIntervals and squad size
// that a single player's keeper block alone would overflow their whole
// game) claws back a player's outfield bonus if the derived bench target
// would otherwise go negative, and hands the reclaimed slots to whoever
// has room — see the "sole keeper for the whole game" test for exactly
// when this fires.
export function computeIntervalTargets({
  rotationOrder, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
}) {
  const n = rotationOrder.length;
  const onFieldSize = Math.min(fieldSize, n);
  const eligibleSet = new Set(keeperEligibleIds || []);
  const eligibleInOrder = rotationOrder.filter((id) => eligibleSet.has(id));
  const hasEligibleKeeper = eligibleInOrder.length > 0;
  const shiftLen = Math.max(1, keeperShiftIntervals);

  const targetKeeper = {};
  rotationOrder.forEach((id) => (targetKeeper[id] = 0));
  if (hasEligibleKeeper) {
    const blocks = [];
    let remaining = numIntervals;
    while (remaining > 0) {
      const len = Math.min(shiftLen, remaining);
      blocks.push(len);
      remaining -= len;
    }
    let blockIdx = 0;
    if (startingGkId && eligibleSet.has(startingGkId)) {
      targetKeeper[startingGkId] += blocks[0];
      blockIdx = 1;
    }
    for (; blockIdx < blocks.length; blockIdx++) {
      const pick = eligibleInOrder.reduce((best, id) => (targetKeeper[id] < targetKeeper[best] ? id : best), eligibleInOrder[0]);
      targetKeeper[pick] += blocks[blockIdx];
    }
  }

  const outfieldSlotsPerInterval = hasEligibleKeeper ? onFieldSize - 1 : onFieldSize;
  const outfieldTotal = numIntervals * outfieldSlotsPerInterval;
  const priorityOrder = [...rotationOrder].sort((a, b) => {
    if (targetKeeper[a] !== targetKeeper[b]) return targetKeeper[a] - targetKeeper[b];
    return rotationOrder.indexOf(a) - rotationOrder.indexOf(b);
  });
  const targetOutfield = distributeEvenly(outfieldTotal, priorityOrder);

  const targetBench = {};
  rotationOrder.forEach((id) => (targetBench[id] = numIntervals - targetOutfield[id] - targetKeeper[id]));

  for (const id of rotationOrder) {
    if (targetBench[id] >= 0) continue;
    const deficit = -targetBench[id];
    targetOutfield[id] -= deficit;
    targetBench[id] = 0;
    let toPlace = deficit;
    for (const candidate of priorityOrder) {
      if (toPlace <= 0) break;
      if (candidate === id || targetBench[candidate] <= 0) continue;
      const give = Math.min(targetBench[candidate], toPlace);
      targetOutfield[candidate] += give;
      targetBench[candidate] -= give;
      toPlace -= give;
    }
    // If toPlace > 0 here, keeper commitments alone exceed what the game
    // can support even after redistribution — genuinely degenerate (more
    // total keeper-eligible demand than the squad/shift settings can
    // sanely produce). Left as a smaller-than-ideal outfieldTotal rather
    // than forcing an invalid (negative) target on someone else.
  }

  return { targetOutfield, targetKeeper, targetBench };
}

// Decides bench turns and keeper duty TOGETHER, one interval at a time —
// unlike buildBenchSchedule/assignKeepers (the original, deliberately-
// unchanged engine — see this file's own module comment on why those stay
// untouched), which run as two fully separate passes and so have no way
// for the bench schedule to know a player is mid-shift. That gap was the
// real bug (real-use report, 3 eligible keepers/15-min shift/45-min
// game): a 200-seed sweep found one eligible keeper getting 7 of 9
// sub-intervals, another 0 — the bench schedule kept rotating the current
// keeper off before their shift was actually up, forcing an early,
// unplanned handoff.
//
// The fix commits to a keeper's WHOLE block the moment they're picked —
// excluded from the bench pool for every interval of it, so a shift can
// never be cut short by an unrelated bench rotation again. Picking who
// STARTS each new block still prefers an "arriving" player (on the bench
// the interval before) over a lower-loaded non-arriving one — the same
// priority order assignKeepers' own rule 3 already uses, so bench->keeper
// (a player only ever becomes keeper right after a rest, never mid-
// outfield-stint) still holds at every boundary, not just within an
// unbroken block. A first version of this dropped that preference
// entirely — arrival can only be checked because bench and keeper are now
// decided together, interval by interval, rather than bench-schedule-
// first — and passed its own new sweep test fine, but broke the EXISTING
// bench->keeper regression tests: even the plain single-interval-shift
// case lost the guarantee. Restored here.
//
// Bench turns among whoever ISN'T the interval's own keeper are decided
// by simple greedy fair queueing (fewest bench turns so far wins, ties by
// rotationOrder position), not the original's closed-form modular
// arithmetic — excluding a *different* player at different intervals
// doesn't have as clean a proof, so — like repairKeeperBalance/
// repairOutfieldBalance below — this is validated empirically via sweep
// test (fixedRotation.fairness.test.js), not assumed correct by
// construction. Not folded into buildFixedPlan/buildBenchSchedule/
// assignKeepers themselves — see this file's own module comment on why
// those stay untouched.
function buildKeeperAwareSchedule({
  rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
  startIndex = 0, currentGkId = null, previousOnFieldIds = null, initialGkMinutes = null,
}) {
  const size = Math.min(fieldSize, rotationOrder.length);
  const benchSpots = rotationOrder.length - size;
  const intervalLen = gameMinutes / numIntervals;
  const numToBuild = numIntervals - startIndex;
  const shiftLen = Math.max(1, keeperShiftIntervals);

  const eligibleSet = new Set(keeperEligibleIds || []);
  const eligibleInOrder = rotationOrder.filter((id) => eligibleSet.has(id));
  const hasEligible = eligibleInOrder.length > 0;
  const orderIndex = {};
  rotationOrder.forEach((id, idx) => (orderIndex[id] = idx));

  const keeperLoads = {};
  eligibleInOrder.forEach((id) => (keeperLoads[id] = (initialGkMinutes && initialGkMinutes[id]) || 0));
  const benchTurns = {};
  rotationOrder.forEach((id) => (benchTurns[id] = 0));

  const schedule = [];
  const gkPerInterval = [];
  let currentKeeper = null;
  let blockEndIndex = -1; // last local index (this call's own 0-based range) of currentKeeper's active block

  // A continuation whose first interval doesn't land on a shift boundary
  // is picking up mid-shift — hold that keeper for whatever's left of
  // their block, same as assignKeepers' own currentGkId handling.
  if (currentGkId && eligibleSet.has(currentGkId) && startIndex % shiftLen !== 0) {
    currentKeeper = currentGkId;
    blockEndIndex = Math.min(shiftLen - (startIndex % shiftLen), numToBuild) - 1;
  }

  for (let i = 0; i < numToBuild; i++) {
    const absoluteIndex = startIndex + i;
    let gk;
    if (currentKeeper && i <= blockEndIndex) {
      gk = currentKeeper;
    } else if (hasEligible) {
      // rotationOrder.includes, not just eligibleSet.has: keeperEligibleIds
      // comes from the whole roster's own keeperEligible flag, independent
      // of who's actually playing this game — a stale starting-keeper pick
      // for someone still flagged eligible but no longer available (real
      // test case: picked, then un-ticked from "who's here") would
      // otherwise assign goal to a player not even in this game's own
      // on-field rotation, leaving every interval with no isGk:true row at
      // all rather than falling through to the normal pick.
      if (i === 0 && absoluteIndex === 0 && startingGkId && eligibleSet.has(startingGkId) && rotationOrder.includes(startingGkId)) {
        gk = startingGkId;
      } else {
        // Who was on the bench the interval before (the arrival pool) —
        // schedule[i-1] for anything already built this call, or the
        // continuation's own previousOnFieldIds for this call's very
        // first interval. A genuine fresh-game start (i===0, nothing
        // before it at all) has no meaningful "arrival" concept — same
        // free pick assignKeepers' own isGenuineStart makes.
        const prevBench = i > 0 ? schedule[i - 1]
          : previousOnFieldIds ? rotationOrder.filter((id) => !previousOnFieldIds.includes(id))
          : null;
        const byLoad = [...eligibleInOrder].sort((a, b) => keeperLoads[a] - keeperLoads[b] || orderIndex[a] - orderIndex[b]);
        const arriving = prevBench ? byLoad.filter((id) => prevBench.includes(id)) : [];
        gk = arriving.length > 0 ? arriving[0] : byLoad[0];
      }
      currentKeeper = gk;
      blockEndIndex = i + Math.min(shiftLen, numToBuild - i) - 1;
    } else {
      gk = null;
    }

    if (gk) keeperLoads[gk] += intervalLen;
    gkPerInterval.push(gk);

    const pool = rotationOrder.filter((id) => id !== gk);
    const bench = [...pool]
      .sort((a, b) => benchTurns[a] - benchTurns[b] || orderIndex[a] - orderIndex[b])
      .slice(0, Math.min(benchSpots, pool.length));
    bench.forEach((id) => (benchTurns[id] += 1));
    schedule.push(bench);
  }

  const intervals = schedule.map((bench, i) => {
    const benchSet = new Set(bench);
    const onField = rotationOrder.filter((id) => !benchSet.has(id));
    const gk = gkPerInterval[i];
    const absoluteIndex = startIndex + i;
    return {
      index: absoluteIndex,
      startMin: Math.round(absoluteIndex * intervalLen),
      endMin: Math.round((absoluteIndex + 1) * intervalLen),
      onField: onField.map((id) => ({ id, isGk: id === gk })),
      bench,
    };
  });

  return { intervals };
}

// Real-use framing that unlocks a cleaner fix than the first attempt
// (below the module comment's own note on why a pre-planned keeper split
// was abandoned the first time): a coach picking a keeper shift longer
// than the sub-interval isn't choosing an arbitrary number — with 3
// eligible keepers across a 45-min game, 15 minutes each is *the*
// decision, not one option among many. That means the round-robin split
// this file's own computeIntervalTargets already computes isn't just a
// theoretical upper bound here — it IS the intended plan.
//
// buildKeeperBlocks (below) commits to that plan directly: which player
// holds goal for which block, decided once, up front, independent of
// bench arrival. buildBenchScheduleExcludingKeeper then builds bench
// turns AROUND that fixed decision — nobody's ever scheduled onto the
// bench during their own keeper block, so a shift can never be cut short
// by an unrelated bench rotation the way it could before (the real bug
// this was built to fix: a 200-seed sweep of a real reported
// configuration found one eligible keeper getting 7 of 9 sub-intervals,
// another 0). The first attempt at this fix tried to patch the ORIGINAL
// arrival-based engine's bench schedule after the fact instead — real-use
// testing (not just reasoning) caught that approach making the worst case
// WORSE, not better, so it was reverted rather than shipped; this
// alternative sidesteps the whole "keeper duty must arrive from the
// bench" constraint that made patching so fragile, by simply not relying
// on it any more — the block assignment doesn't need an arrival to be
// valid, so there's no coupling left to accidentally break.
//
// Because the block-based keeper split is now fair by construction (the
// same clean round-robin as computeIntervalTargets), repairKeeperBalance
// below should rarely find anything left to do — kept running anyway as
// a defensive backstop, since it's already proven safe.
//
// repairOutfieldBalance (below) then fixes outfield specifically, without
// touching keeper assignment at all — see its own comment.
export function buildFairSchedule({
  rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
}) {
  // No "swap startingGkId onto the field for interval 0" step needed here
  // (unlike buildFixedPlan/buildBenchSchedule) — buildKeeperBlocks assigns
  // them the first block directly, and buildBenchScheduleExcludingKeeper
  // then simply never considers them for the bench during it, regardless
  // of where they land in rotationOrder.
  const { intervals } = buildKeeperAwareSchedule({
    rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals, startingGkId,
  });

  // Real bug (real-use report): a coach's explicit starting-keeper choice
  // was getting silently overridden ~1 in 5 times — not by anything above
  // (assignKeepers itself honors it unconditionally at interval 0), but by
  // these two repair passes below, which have no concept of "this
  // assignment was a deliberate choice, not just where the fairness
  // arithmetic happened to land" and will happily swap it away if that
  // improves the numbers elsewhere. protectFirstKeeper tells both passes to
  // never use interval 0 as a swap/handoff point when it's actually holding
  // the requested starting keeper — every other interval, including the
  // rest of that same keeper's first shift block, is still fully open to
  // repair, same as before.
  const protectFirstKeeper = Boolean(startingGkId) && intervals[0]?.onField.some((p) => p.id === startingGkId && p.isGk);
  repairKeeperBalance(intervals, keeperEligibleIds, protectFirstKeeper);
  repairOutfieldBalance(intervals, rotationOrder, keeperEligibleIds, protectFirstKeeper);
  return { intervals };
}

// Runs BEFORE repairOutfieldBalance, and for a real reason: when only a
// subset of the squad is keeper-eligible, all of that subset's keeper
// duty is competing for the same small pool of arriving opportunities,
// and the existing engine's "least keeper-so-far" tiebreak doesn't
// guarantee an even split within that subset — found via a real
// configuration (9 players, only 3 eligible) where one eligible player
// ended up with keeper=4 while another had keeper=2, and since outfield =
// total - bench - keeper, that unevenness among just the eligible players
// leaked straight into a much bigger outfield gap than repairOutfieldBalance
// alone (an outfield<->bench repair) could ever fix — the excess keeper
// duty isn't sitting on the bench, it's sitting on ANOTHER eligible
// player's shoulders.
//
// Directly rebalances keeper duty between the most- and least-loaded
// eligible players via a pure role swap: find a boundary interval where
// the most-loaded player is keeper and the least-loaded player is already
// playing outfield there (and, critically, actually arrived there the
// same way the most-loaded one did — same bench-turn origin — so this
// never fabricates an invalid bench->keeper claim), and swap their roles
// for that whole shift block. Neither player's bench time changes at all;
// this is purely "who holds the gloves," which is exactly the dial the
// spec says is fine to turn to protect outfield fairness.
function repairKeeperBalance(intervals, keeperEligibleIds, protectFirstKeeper = false) {
  const eligible = [...new Set(keeperEligibleIds || [])];
  if (eligible.length < 2) return;
  const keeperCount = {};
  eligible.forEach((id) => (keeperCount[id] = 0));
  intervals.forEach((iv) => {
    const gk = iv.onField.find((p) => p.isGk);
    if (gk && keeperCount[gk.id] !== undefined) keeperCount[gk.id] += 1;
  });

  function tryMove(most, least) {
    for (let i = 0; i < intervals.length; i++) {
      if (protectFirstKeeper && i === 0) continue; // the coach's explicit starting-keeper pick — never a swap point
      const gk = intervals[i].onField.find((p) => p.isGk);
      if (!gk || gk.id !== most) continue;
      if (!intervals[i].onField.some((p) => p.id === least && !p.isGk)) continue;

      const prevGk = intervals[i - 1]?.onField.find((p) => p.isGk)?.id;
      const isBoundaryForMost = i === 0 || prevGk !== most;
      if (!isBoundaryForMost) continue;
      const leastWasBenchedBefore = i === 0 || intervals[i - 1].bench.includes(least);
      if (!leastWasBenchedBefore) continue;

      let blockEnd = i;
      while (intervals[blockEnd + 1]?.onField.find((p) => p.isGk)?.id === most) blockEnd++;
      let leastOutfieldWholeBlock = true;
      for (let k = i; k <= blockEnd; k++) {
        if (!intervals[k].onField.some((p) => p.id === least && !p.isGk)) { leastOutfieldWholeBlock = false; break; }
      }
      if (!leastOutfieldWholeBlock) continue;

      for (let k = i; k <= blockEnd; k++) {
        intervals[k].onField = intervals[k].onField.map((p) => {
          if (p.id === most) return { id: most, isGk: false };
          if (p.id === least) return { id: least, isGk: true };
          return p;
        });
      }
      const blockLen = blockEnd - i + 1;
      keeperCount[most] -= blockLen;
      keeperCount[least] += blockLen;
      return true;
    }
    return false;
  }

  const maxIterations = intervals.length * eligible.length * 2;
  for (let iter = 0; iter < maxIterations; iter++) {
    const vals = eligible.map((id) => keeperCount[id]);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    if (maxVal - minVal <= 1) break;

    const mostCandidates = eligible.filter((id) => keeperCount[id] === maxVal);
    const leastCandidates = eligible.filter((id) => keeperCount[id] === minVal);

    let swapped = false;
    for (const most of mostCandidates) {
      for (const least of leastCandidates) {
        if (tryMove(most, least)) { swapped = true; break; }
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }
}

// Repeatedly finds whoever has the MOST outfield time and whoever has the
// LEAST, and swaps them for one interval where the first is playing
// outfield and the second is on the bench — a pure outfield<->bench swap,
// mutating `intervals` in place. Never touches who's actually keeper
// anywhere except in the one deliberate "handoff" case below, so
// bench->keeper and every existing keeper rule stay effectively
// unaffected — outfield fairness is fixed on top of whatever keeper
// allocation the existing engine already produced, never by overriding it
// wholesale.
//
// The straightforward swap is skipped whenever the player being pulled
// off the bench (`least`) is the one who becomes keeper the very next
// interval — that bench turn is load-bearing for the transition. With a
// single bench spot (the common case), EVERY bench turn is load-bearing
// like this, since the "arriving" pool is always a forced singleton — so
// skipping outright would mean this repair pass could never do anything
// at all for the most common squad shapes, found directly via the sweep
// test rather than assumed. Instead, in that case, a self-contained
// "handoff" is tried: if `most` is keeper-eligible and is already playing
// outfield for the WHOLE upcoming shift block `least` was about to hold,
// hand that whole block's gloves to `most` instead. `most`'s bench turn
// at the swap interval (`least`'s former slot) is exactly what makes them
// arriving-eligible for it; `least` takes over the outfield role `most`
// vacates across the block — which is what we actually want for `least`,
// unlike the plain swap this replaces. No other interval's bench
// composition changes at all, and keeper-shift continuity for anyone else
// is untouched.
//
// Stops as soon as outfield range is ideal (<=1) or no further safe,
// improving move exists for ANY pair tied at the current extremes — the
// latter is a genuine mathematical limit for that configuration, not a
// shortfall (cross-checked against computeIntervalTargets' independently-
// computed theoretical best in the test suite). A capped iteration count
// is defensive only.
//
// Tries every player tied at the current max against every player tied at
// the current min, not just the first pair found — a real configuration
// (partial keeper eligibility) showed the very first pair tried can be
// the one unlucky combination with no safe move available (their only
// overlapping interval happened to be keeper-transition-blocked), even
// though other tied candidates had a perfectly good move sitting right
// there. Giving up after just one pair meant this repair pass did nothing
// at all for that configuration despite real headroom existing.
function repairOutfieldBalance(intervals, availableIds, keeperEligibleIds, protectFirstKeeper = false) {
  const eligibleSet = new Set(keeperEligibleIds || []);
  const outfieldCount = {};
  availableIds.forEach((id) => (outfieldCount[id] = 0));
  intervals.forEach((iv) => iv.onField.forEach((p) => { if (!p.isGk) outfieldCount[p.id] += 1; }));

  function tryMove(most, least) {
    for (let i = 0; i < intervals.length; i++) {
      // Belt-and-braces alongside repairKeeperBalance's own guard: a swap
      // *starting* at interval 0 never actually changes interval 0's own
      // keeper (only k >= i+1 ever gets marked isGk in the handoff branch
      // below) — this can't currently fire in practice, but skipping it
      // outright keeps that true by construction rather than by accident,
      // so a future change to this function can't silently reopen the
      // exact bug repairKeeperBalance's own fix closed.
      if (protectFirstKeeper && i === 0) continue;
      const iv = intervals[i];
      const mostIsOutfield = iv.onField.some((p) => p.id === most && !p.isGk);
      const leastIsBench = iv.bench.includes(least);
      if (!mostIsOutfield || !leastIsBench) continue;

      const nextGk = intervals[i + 1]?.onField.find((p) => p.isGk);
      if (!nextGk || nextGk.id !== least) {
        iv.onField = iv.onField.map((p) => (p.id === most ? { id: least, isGk: false } : p));
        iv.bench = iv.bench.map((id) => (id === least ? most : id));
        outfieldCount[most] -= 1;
        outfieldCount[least] += 1;
        return true;
      }

      // Blocked — try the handoff instead.
      if (!eligibleSet.has(most)) continue;
      let blockEnd = i + 1;
      while (intervals[blockEnd + 1]?.onField.find((p) => p.isGk)?.id === least) blockEnd++;
      let mostPlaysOutfieldWholeBlock = true;
      for (let k = i + 1; k <= blockEnd; k++) {
        if (!intervals[k].onField.some((p) => p.id === most && !p.isGk)) { mostPlaysOutfieldWholeBlock = false; break; }
      }
      if (!mostPlaysOutfieldWholeBlock) continue;

      iv.onField = iv.onField.map((p) => (p.id === most ? { id: least, isGk: false } : p));
      iv.bench = iv.bench.map((id) => (id === least ? most : id));
      for (let k = i + 1; k <= blockEnd; k++) {
        intervals[k].onField = intervals[k].onField.map((p) => {
          if (p.id === least) return { id: least, isGk: false };
          if (p.id === most) return { id: most, isGk: true };
          return p;
        });
      }
      const blockLen = blockEnd - i; // number of intervals in [i+1, blockEnd]
      outfieldCount[most] -= 1 + blockLen;
      outfieldCount[least] += 1 + blockLen;
      return true;
    }
    return false;
  }

  const maxIterations = intervals.length * availableIds.length * 3;
  for (let iter = 0; iter < maxIterations; iter++) {
    const vals = availableIds.map((id) => outfieldCount[id]);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    if (maxVal - minVal <= 1) break;

    const mostCandidates = availableIds.filter((id) => outfieldCount[id] === maxVal);
    const leastCandidates = availableIds.filter((id) => outfieldCount[id] === minVal);

    let didSomething = false;
    for (const most of mostCandidates) {
      for (const least of leastCandidates) {
        if (tryMove(most, least)) { didSomething = true; break; }
      }
      if (didSomething) break;
    }
    if (!didSomething) break; // no safe improving move left for any tied pair — a genuine limit
  }
}

// The bench-fairness counterpart to repairOutfieldBalance above — same
// swap mechanics and the same bench->keeper safety guarantees (never
// pulls someone off the bench right before their own scheduled keeper
// block starts; the same "handoff" escape hatch lets the block go to
// whoever else can safely hold it instead), but scored against BENCH
// range instead of outfield range.
//
// Exists because repairOutfieldBalance always runs as part of the
// standard buildFairSchedule pipeline and always chases OUTFIELD range
// down regardless of what's actually wanted. Once outfield is pinned
// tight, bench range becomes a near-pure function of how keeper minutes
// are spread — bench = total - outfield - keeper, so once outfield is
// equal across everyone, a keeper-eligible player's extra keeper minutes
// come directly out of THEIR bench time relative to a non-eligible
// teammate's, and no amount of reshuffling the starting rotation order
// changes that as long as something keeps re-tightening outfield
// afterward. Confirmed via a real sweep (fixedRotation.test.js):
// generateFixedPlanBiasedFor("bench", ...) plateaued around bench range 3
// on the real-use 7-player/3-eligible-keeper configuration when it only
// searched over generateFixedPlan's own standard (outfield-tightening)
// pipeline. This pass is what actually closes that gap — by letting
// outfield range drift wider on purpose in exchange for a tighter bench
// range, exactly the trade-off a coach asking for "Improve bench
// fairness" wants. Used only by buildBenchFairSchedule, below —
// buildFairSchedule/repairOutfieldBalance (the pitch/default path) are
// completely untouched.
function repairBenchBalance(intervals, availableIds, keeperEligibleIds, protectFirstKeeper = false) {
  const eligibleSet = new Set(keeperEligibleIds || []);
  const benchCount = {};
  availableIds.forEach((id) => (benchCount[id] = 0));
  intervals.forEach((iv) => iv.bench.forEach((id) => { if (benchCount[id] !== undefined) benchCount[id] += 1; }));

  // most = most-benched (wants a turn OFF the bench); least = least-
  // benched (has a turn to spare ONTO the bench) — the reverse pairing
  // from repairOutfieldBalance's most/least, since this pass chases the
  // opposite column.
  function tryMove(most, least) {
    for (let i = 0; i < intervals.length; i++) {
      if (protectFirstKeeper && i === 0) continue;
      const iv = intervals[i];
      const mostIsBench = iv.bench.includes(most);
      const leastIsOutfield = iv.onField.some((p) => p.id === least && !p.isGk);
      if (!mostIsBench || !leastIsOutfield) continue;

      // Blocked if `most` is about to arrive off THIS exact bench turn
      // into a keeper block starting next interval — pulling them onto
      // the field now instead would mean they never actually arrived
      // from the bench, breaking their own scheduled transition.
      const nextGk = intervals[i + 1]?.onField.find((p) => p.isGk);
      if (!nextGk || nextGk.id !== most) {
        iv.onField = iv.onField.map((p) => (p.id === least ? { id: most, isGk: false } : p));
        iv.bench = iv.bench.map((id) => (id === most ? least : id));
        benchCount[most] -= 1;
        benchCount[least] += 1;
        return true;
      }

      // Handoff: still make the interval-i swap (most takes least's
      // outfield slot, least takes most's bench slot) — but hand `most`'s
      // now-orphaned keeper block to `least` instead, who's just
      // legitimately arrived onto the bench at i and can hold it from
      // there. `most` keeps playing (as outfield, not keeper) for that
      // whole span instead, taking over the outfield presence `least`
      // vacates for it. Only safe when `least` is keeper-eligible and was
      // genuinely outfield (not something else) for the entire block
      // already.
      if (!eligibleSet.has(least)) continue;
      let blockEnd = i + 1;
      while (intervals[blockEnd + 1]?.onField.find((p) => p.isGk)?.id === most) blockEnd++;
      let leastPlaysOutfieldWholeBlock = true;
      for (let k = i + 1; k <= blockEnd; k++) {
        if (!intervals[k].onField.some((p) => p.id === least && !p.isGk)) { leastPlaysOutfieldWholeBlock = false; break; }
      }
      if (!leastPlaysOutfieldWholeBlock) continue;

      iv.onField = iv.onField.map((p) => (p.id === least ? { id: most, isGk: false } : p));
      iv.bench = iv.bench.map((id) => (id === most ? least : id));
      for (let k = i + 1; k <= blockEnd; k++) {
        intervals[k].onField = intervals[k].onField.map((p) => {
          if (p.id === most) return { id: most, isGk: false };
          if (p.id === least) return { id: least, isGk: true };
          return p;
        });
      }
      // Neither player's BENCH time changes across the handed-off block
      // itself (most: keeper -> outfield there, least: outfield -> keeper
      // there — neither state is "bench") — only the interval-i swap
      // itself moves any bench time, same delta as the simple branch above.
      benchCount[most] -= 1;
      benchCount[least] += 1;
      return true;
    }
    return false;
  }

  const maxIterations = intervals.length * availableIds.length * 3;
  for (let iter = 0; iter < maxIterations; iter++) {
    const vals = availableIds.map((id) => benchCount[id]);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    if (maxVal - minVal <= 1) break;

    const mostCandidates = availableIds.filter((id) => benchCount[id] === maxVal);
    const leastCandidates = availableIds.filter((id) => benchCount[id] === minVal);

    let didSomething = false;
    for (const most of mostCandidates) {
      for (const least of leastCandidates) {
        if (tryMove(most, least)) { didSomething = true; break; }
      }
      if (didSomething) break;
    }
    if (!didSomething) break; // no safe improving move left for any tied pair — a genuine limit
  }
}

// Reports how fair a plan actually turned out, in INTERVAL counts (not
// minutes — the thresholds below are defined in "substitution intervals",
// and every fresh-game interval is the same length, so counts and minutes
// agree up to that constant factor). Pure and read-only: safe to reuse
// anywhere (tests, future dev/debug output, potentially Path A someday),
// since it only ever reports on a plan that's already been built — it
// never makes or influences a scheduling decision itself.
//
// "ideal" = range <=1 interval, "acceptable" = range <=2, "poor" = worse.
// Keeper range is reported but never rated — keeper duty is allowed to be
// uneven by design (see the module comment).
export function calculateFairness(intervals, availableIds, keeperEligibleIds) {
  const eligibleSet = new Set(keeperEligibleIds || []);
  const totals = {};
  availableIds.forEach((id) => (totals[id] = { outfield: 0, keeper: 0, bench: 0 }));
  intervals.forEach((iv) => {
    iv.onField.forEach((p) => {
      if (!totals[p.id]) return;
      if (p.isGk) totals[p.id].keeper += 1;
      else totals[p.id].outfield += 1;
    });
    iv.bench.forEach((id) => {
      if (totals[id]) totals[id].bench += 1;
    });
  });

  const range = (vals) => (vals.length === 0 ? 0 : Math.max(...vals) - Math.min(...vals));
  const rate = (r) => (r <= 1 ? "ideal" : r <= 2 ? "acceptable" : "poor");

  const outfieldVals = availableIds.map((id) => totals[id].outfield);
  const benchVals = availableIds.map((id) => totals[id].bench);
  const keeperVals = availableIds.filter((id) => eligibleSet.has(id)).map((id) => totals[id].keeper);
  const outfieldRange = range(outfieldVals);
  const benchRange = range(benchVals);

  return {
    totals,
    outfieldMin: outfieldVals.length ? Math.min(...outfieldVals) : 0,
    outfieldMax: outfieldVals.length ? Math.max(...outfieldVals) : 0,
    outfieldRange,
    benchMin: benchVals.length ? Math.min(...benchVals) : 0,
    benchMax: benchVals.length ? Math.max(...benchVals) : 0,
    benchRange,
    keeperMin: keeperVals.length ? Math.min(...keeperVals) : 0,
    keeperMax: keeperVals.length ? Math.max(...keeperVals) : 0,
    keeperRange: range(keeperVals),
    outfieldRating: rate(outfieldRange),
    benchRating: rate(benchRange),
  };
}

// The actual entry point a coach's "Generate" hits. Shuffles the rotation
// order once (real week-to-week variety — a different player experiences
// whatever the schedule's "extra lap" is each time, and ties in the
// target-based ranking above resolve differently too) and builds the plan
// against that order via buildFairSchedule.
//
// No pre-shuffle "swap startingGkId into an on-field slot" step needed
// here (an earlier version needed one, since buildBenchSchedule's cyclic
// slicing could otherwise silently bench them for interval 0) —
// buildFairSchedule forces their presence into the group directly, so
// whatever slot the shuffle happened to land them in doesn't matter.
export function generateFixedPlan({
  availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null, random = Math.random,
}) {
  const rotationOrder = shuffle(availableIds, random);
  return buildFairSchedule({ rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals, startingGkId });
}

// Bench-targeted counterpart to buildFairSchedule, used only by
// generateFixedPlanBiasedFor("bench", ...) below. Same base
// (buildKeeperAwareSchedule) and the same repairKeeperBalance pass —
// keeper duty stays evenly split among eligible players regardless of
// which column this is optimizing for — but finishes with
// repairBenchBalance instead of repairOutfieldBalance. Deliberately NOT
// both: the two passes pull in different directions once keeper
// eligibility is uneven (repairOutfieldBalance tightens outfield at
// bench's expense; repairBenchBalance does the reverse), so running them
// in sequence would have each partially undo the other's work.
// buildFairSchedule itself (the pitch/default path startPlanning uses)
// is completely untouched by this.
function buildBenchFairSchedule({
  rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1, startingGkId = null,
}) {
  const { intervals } = buildKeeperAwareSchedule({
    rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals, startingGkId,
  });
  // Same real bug/fix this protects against as buildFairSchedule's own
  // identical guard — see its comment.
  const protectFirstKeeper = Boolean(startingGkId) && intervals[0]?.onField.some((p) => p.id === startingGkId && p.isGk);
  repairKeeperBalance(intervals, keeperEligibleIds, protectFirstKeeper);
  repairBenchBalance(intervals, rotationOrder, keeperEligibleIds, protectFirstKeeper);
  return { intervals };
}

// A coach-facing "Improve pitch fairness" / "Improve bench fairness"
// action (RotationProgressOverlay's needs-attention menu, via
// useMatchState's previewImprovedFairness) — a SEARCH over an already-
// trusted pipeline, not a bespoke one-off algorithm: "pitch" searches
// generateFixedPlan's own standard pipeline (buildFairSchedule, ending in
// repairOutfieldBalance); "bench" searches buildBenchFairSchedule's
// parallel one (ending in repairBenchBalance instead). Both reshuffle
// rotationOrder via Math.random on every attempt, and the deterministic
// repair passes downstream of that land at genuinely different points on
// the pitch/bench trade-off frontier depending on that starting order —
// confirmed against two real games with the same roster shape landing at
// different points on that curve. So: build `attempts` independent
// candidates, score each with calculateFairness's own outfieldRange/
// benchRange/keeperRange (interval counts, not minutes — fine here, every
// candidate shares the same interval length so counts and minutes agree
// up to that same constant factor), and keep the best under the priority
// below.
//
// Selection priority: keeperRange FIRST, then the requested metric's own
// range, then the other metric's range as a final tie-break. Real-use
// report + a sweep that confirmed it: with only "bench range, then
// outfield range" as the key (an earlier version of this function),
// "Improve bench fairness" picked a keeper-badly-uneven candidate ~1 in 6
// times on a real 7-player/4-eligible-keeper/45-min/10-min-shift
// configuration (up to a 15+ minute keeper-time gap) — every individual
// candidate already runs repairKeeperBalance, but that pass hits a
// genuine "no safe move" limit for some shuffles (see its own comment),
// and nothing was steering the SEARCH away from those candidates once
// they happened to also score well on bench. Both buildFairSchedule and
// buildBenchFairSchedule already treat keeper fairness as the baseline
// repair pass that runs BEFORE their respective outfield/bench pass —
// this makes the search's own selection honor that same priority instead
// of accidentally overriding it by only looking at the metric a coach
// asked to improve. Stops the moment a candidate is simultaneously
// keeper-ideal AND perfect on the target metric — nothing beats that.
//
// Why two pipelines rather than one search over one pipeline: an earlier
// version searched generateFixedPlan alone for both metrics — worked well
// for "pitch" (worst case across a 40-seed sweep of the real-use
// 7-player/3-eligible-keeper configuration landed at outfield range <=1),
// but "bench" plateaued around range 3 on that same configuration,
// because repairOutfieldBalance runs unconditionally inside
// buildFairSchedule and always re-tightens outfield regardless of the
// shuffle — see repairBenchBalance's own comment for the full mechanism.
// That's the evidence-based trigger for buildBenchFairSchedule above, not
// a starting assumption.
//
// metric: "pitch" (minimize outfieldMin/outfieldRange spread — the Today's
// Minutes PITCH column) or "bench" (minimize the BENCH column). planArgs
// is exactly generateFixedPlan's own argument object, reused as-is.
export function generateFixedPlanBiasedFor(metric, planArgs, attempts = 30) {
  const { availableIds, keeperEligibleIds } = planArgs;
  const buildCandidate =
    metric === "bench"
      ? () => buildBenchFairSchedule({ ...planArgs, rotationOrder: shuffle(availableIds, Math.random) })
      : () => generateFixedPlan(planArgs);

  let best = null;
  let bestKey = null;
  for (let i = 0; i < attempts; i++) {
    const { intervals } = buildCandidate();
    const fairness = calculateFairness(intervals, availableIds, keeperEligibleIds);
    const primary = metric === "bench" ? fairness.benchRange : fairness.outfieldRange;
    const secondary = metric === "bench" ? fairness.outfieldRange : fairness.benchRange;
    const key = [fairness.keeperRange, primary, secondary];
    if (!best || key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) {
      best = { intervals, outfieldRange: fairness.outfieldRange, benchRange: fairness.benchRange, keeperRange: fairness.keeperRange };
      bestKey = key;
    }
    if (bestKey[0] === 0 && bestKey[1] === 0) break; // keeper-perfect and target-metric-perfect — nothing beats it
  }
  return best;
}

// Rebuilds the *remainder* of an in-progress game from `startInterval`
// onward — the mid-game equivalent of generateFixedPlan, for when the
// roster changes partway through (an injury, a bring-back, a manual swap).
// Not yet wired into the app — useMatchState's handleInjury/bringBack/
// performSwap still use generatePlan with carryState (rotation.js) for
// this, deliberately left untouched; see this function's own commit
// message for why.
//
// The core idea: a fresh game's rotation order can be an arbitrary shuffle,
// because everyone starts at zero, so any order is equally fair. A
// continuation can't do that — some players are already ahead or behind on
// bench/keeper time, so the order has to reflect that instead. `carryState`
// (buildCarryState in rotation.js — already computed by every caller that
// currently rebuilds a plan) gives exactly the numbers needed:
// benchPriorityCompare (rotation.js's own "who's more owed a turn"
// definition, reused rather than re-derived) sorts the remaining players
// so whoever's had the least bench time so far leads the new schedule, and
// carryState's gkMin seeds keeper-minutes tracking so the "fewest keeper
// minutes so far" comparisons account for the whole game, not just the
// remainder.
//
// `currentGkId` and `previousOnFieldIds` carry the moment-of-rebuild state
// forward so the very first interval of the remainder is treated as a
// genuine continuation, not a second "fresh start" — see assignKeepers'
// isGenuineStart. Passing lastGkId(priorIntervals) and priorIntervals's
// final onField list (both rotation.js, already computed by every current
// caller of a rebuild) is exactly right for these.
export function continueFixedPlan({
  availableIds, gameMinutes, numIntervals, startInterval, fieldSize, keeperEligibleIds, keeperShiftIntervals = 1,
  carryState, currentGkId = null, previousOnFieldIds = null,
}) {
  // benchPriorityCompare sorts ascending by "most owed to be *playing*"
  // (rotation.js's resolveBringBack uses it exactly that way, to pick who
  // gets promoted onto an open field slot). buildBenchSchedule's position 0
  // is the opposite question — who gets *benched* first — so this needs
  // the reverse: whoever's played the most already (least owed to keep
  // playing) leads the new order, so they're first to sit. Caught by
  // testing directly rather than trusted by eye: an unreversed version
  // benched whoever had played the *least* first, which is backwards.
  const stats = (id) => carryState?.[id] || { fieldMin: 0, gkMin: 0, consecBench: 0 };
  const rotationOrder = [...availableIds].sort((a, b) => benchPriorityCompare(stats(b), stats(a)));

  const initialGkMinutes = {};
  availableIds.forEach((id) => (initialGkMinutes[id] = stats(id).gkMin));

  return buildFixedPlan({
    rotationOrder, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, keeperShiftIntervals,
    startIndex: startInterval, currentGkId, previousOnFieldIds, initialGkMinutes,
  });
}

function shuffle(array, random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
