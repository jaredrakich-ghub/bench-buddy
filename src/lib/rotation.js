/**
 * The rotation/fairness algorithm, kept separate from the UI so it can be
 * read, tested, and changed without wading through JSX. Nothing in here
 * knows about React, storage, or the DOM — every function takes plain data
 * in and returns plain data out.
 *
 * See SubRotationPlanner.test.js-era tests, now in rotation.test.js, for
 * the expected behavior of each function below.
 */

// Given elapsed seconds, find which plan interval we're currently in.
export const intervalAtElapsed = (plan, elapsedSec) => {
  if (!plan || plan.length === 0) return 0;
  const elapsedMin = elapsedSec / 60;
  const idx = plan.findIndex((iv) => elapsedMin >= iv.startMin && elapsedMin < iv.endMin);
  return idx === -1 ? plan.length - 1 : idx;
};

// Turn a target sub interval (e.g. "every 5-7 min") into a whole number of
// even intervals across the game, landing as close to the target as possible.
export function computeIntervals(gameMinutes, subIntervalMinutes) {
  const numIntervals = Math.max(2, Math.round(gameMinutes / subIntervalMinutes));
  const intervalLen = gameMinutes / numIntervals;
  return { numIntervals, intervalLen };
}

// Purely a display helper for the match screen's interval tabs — shows a
// coach where a half-time/third-time/quarter-time break would visually
// group the intervals together. `breakSegments` is how many groups the
// game is split into (2 = halves, 3 = thirds, 4 = quarters), so it always
// produces breakSegments-1 dividers, evenly spaced by game time and rounded
// to the nearest actual interval boundary (breaks don't have to land on a
// clean interval edge — e.g. a 45-min game with 7-min subs doesn't divide
// evenly into thirds either). Deliberately has zero effect on anything the
// rotation engine decides — no scheduling function reads this — it only
// ever feeds which interval tabs get a visual gap before them.
export function computeBreakBoundaries(numIntervals, breakSegments) {
  const boundaries = new Set();
  if (!breakSegments || breakSegments <= 1) return boundaries;
  for (let k = 1; k < breakSegments; k++) {
    const idx = Math.round((numIntervals * k) / breakSegments);
    if (idx > 0 && idx < numIntervals) boundaries.add(idx);
  }
  return boundaries;
}

// Keeper minutes count for less than outfield minutes toward "already had a
// turn" — found via a real live game where two kids who'd done more keeper
// duty AND more bench time than their teammates ended up with meaningfully
// less actual running-around time, even though the app's own total-playing-
// time fairness check said the game was fine. 0.5 is a starting point
// (keeper time counts "half" toward being caught up) rather than a value
// derived from anything — tuned against the fairness sweep in
// rotation.test.js, not by feel. 0 would mean keeper time doesn't count
// toward being caught up at all, which risks overcorrecting (a keeper-heavy
// kid could end up with genuinely more total playing time than everyone
// else just to equalize outfield-only minutes); 1 would be today's old
// behavior (keeper and outfield minutes fully interchangeable).
const KEEPER_MINUTES_WEIGHT = 0.5;
function weightedFieldMin(stats) {
  return stats.fieldMin - (1 - KEEPER_MINUTES_WEIGHT) * stats.gkMin;
}

// Who's more "owed" a turn between two bench candidates — longest current
// bench streak wins, then whoever has the least (keeper-weighted) field time
// so far. This is THE definition of "next in line" for the whole app:
// generatePlan's own outfield selection is built on it below, and the UI
// layer (bringBack, for promoting a bench player into a field vacancy opened
// up mid-interval) uses this same function rather than its own copy, so
// there's never a chance for the two to drift out of sync on what "fair"
// means.
export function benchPriorityCompare(statsA, statsB) {
  if (statsB.consecBench !== statsA.consecBench) return statsB.consecBench - statsA.consecBench;
  return weightedFieldMin(statsA) - weightedFieldMin(statsB);
}

// Decides where a returning (no-longer-injured) player lands for whatever's
// left of the current interval. Pulled out of the bring-back UI handler as
// its own pure function specifically so this decision can be tested
// directly and precisely — including scenarios ("bench already has someone
// waiting AND there's an open field slot") that are hard to force through
// the UI's own injury/return flow, since in practice the field is always
// kept filled to capacity whenever there are enough players for it, so
// that combination is rare. Three cases:
//   - No open field slot: they just join the bench, nothing else changes.
//   - An open slot, and someone's already on the bench: that person (the
//     one benchPriorityCompare ranks highest — longest bench streak, then
//     least field time) is promoted into the slot, and the returning
//     player takes the bench spot they leave behind. The returning player
//     never skips the queue.
//   - An open slot, but the bench is empty (nobody else to promote — e.g.
//     the first player back after everyone was hurt): they fill the slot
//     themselves, since there's no one else it could go to.
export function resolveBringBack({ playerId, onField, bench, standing, normalFieldSize }) {
  const hasOpenFieldSlot = onField.length < normalFieldSize;

  if (!hasOpenFieldSlot) {
    return { onField, bench: [...bench, playerId] };
  }
  if (bench.length === 0) {
    return { onField: [...onField, { id: playerId, isGk: false }], bench };
  }
  const emptyStanding = { fieldMin: 0, gkMin: 0, consecBench: 0 };
  const promoted = [...bench].sort((a, b) =>
    benchPriorityCompare(standing[a] || emptyStanding, standing[b] || emptyStanding)
  )[0];
  return {
    onField: [...onField, { id: promoted, isGk: false }],
    bench: bench.filter((id) => id !== promoted).concat(playerId),
  };
}

// Turns a target keeper-shift length (in minutes) into a whole number of
// sub-intervals, so a keeper's shift always lines up on sub-interval
// boundaries. Falls back to `subIntervalMinutes` (i.e. one sub-interval per
// shift — today's default rotate-every-sub behavior) when no shift length
// is set, so this is purely additive: nobody sees a change unless they
// explicitly set a longer keeper shift.
export function keeperShiftIntervalsFor(subIntervalMinutes, keeperShiftMinutes) {
  const target = keeperShiftMinutes || subIntervalMinutes;
  return Math.max(1, Math.round(target / subIntervalMinutes));
}

// Who was marked as goalkeeper in the last of a list of already-decided
// intervals — i.e. "who's currently in goal" as of right before some later
// point in the game. Used so a mid-game rebuild (injury, swap, bring-back)
// knows a keeper is already partway through a shift, instead of treating
// the rebuild's starting point as a fresh shift boundary.
export function lastGkId(intervals) {
  if (!intervals || intervals.length === 0) return null;
  return intervals[intervals.length - 1].onField.find((p) => p.isGk)?.id ?? null;
}

// Replays a set of already-decided intervals to work out each player's
// fairness state (minutes played, GK minutes, and how long they've been
// waiting on the bench) as of right after those intervals happened.
export function buildCarryState(ids, doneIntervals) {
  const carryState = {};
  ids.forEach((id) => {
    let fieldMin = 0, gkMin = 0, consecBench = 0;
    doneIntervals.forEach((iv) => {
      const onF = iv.onField.find((p) => p.id === id);
      if (onF) {
        fieldMin += iv.endMin - iv.startMin;
        if (onF.isGk) gkMin += iv.endMin - iv.startMin;
        consecBench = 0;
      } else {
        consecBench += 1;
      }
    });
    carryState[id] = { fieldMin, gkMin, consecBench };
  });
  return carryState;
}

// Core rotation algorithm. GK is drawn from the keeper-eligible pool (players
// with their 🧤 toggled on), picking whoever's owed the least keeper time,
// rotated independently of outfield fairness — this guarantees a valid
// keeper every interval without pulling outfield fairness numbers into the
// keeper decision (and vice versa). If nobody in the squad is marked
// keeper-eligible (an edge case — every player defaults to eligible), this
// falls back to picking a GK from whoever's already on the field, so the
// app never ends up with no keeper at all.
//
// `keeperShiftIntervals` controls how many consecutive intervals one
// keeper stays in for before rotating (default 1 = every interval, today's
// original behavior). `currentGkId` lets a mid-game rebuild (injury, swap,
// bring-back) tell the algorithm someone is already partway through a
// shift, so the rebuild's start doesn't get treated as a fresh shift
// boundary — see keeperShiftIntervalsFor/lastGkId above.
//
// `startingGkId` is a manual override for who starts in goal at
// `startInterval` specifically (e.g. a coach honoring "can I start in
// goal?", or pickFairStartingGk below trying a candidate) — every interval
// after that still goes through the normal algorithm untouched, including
// keeper-shift continuation, so the manual pick just becomes the seed the
// automatic rotation continues from. Ignored (falls through to the normal
// pick) if the given id isn't actually available and keeper-eligible.
//
// Deliberately fully deterministic otherwise — same inputs always produce
// the same plan, no randomness anywhere in here. An earlier version of this
// randomized ties in the keeper pick directly, to fix the same kid always
// starting in goal — reverted because it could occasionally cascade into a
// real, measurable fairness gap over the rest of the game for some starting
// choices, with nothing here to catch it. See pickFairStartingGk, which
// achieves the actual goal (variety in who starts) by trying real
// candidates through this same deterministic function and only offering
// ones that come out fair, rather than gambling inside it.
export function generatePlan({
  availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds,
  startInterval = 0, carryState = null, keeperShiftIntervals = 1, currentGkId = null,
  startingGkId = null,
}) {
  const size = Math.min(fieldSize, availableIds.length);
  const intervalLen = gameMinutes / numIntervals;
  const shiftLen = Math.max(1, keeperShiftIntervals);

  const sim = {};
  availableIds.forEach((id) => {
    sim[id] = carryState?.[id] ? { ...carryState[id] } : { fieldMin: 0, gkMin: 0, consecBench: 0 };
  });

  const eligibleSet = new Set(keeperEligibleIds || []);
  const hasEligibleKeeper = availableIds.some((id) => eligibleSet.has(id));

  // Keeper-minutes fairness decides first (unchanged, load-bearing —
  // tried making "currently on the bench" the *primary* key instead of a
  // tiebreak at one point, to guarantee "next bench player becomes keeper"
  // outright, but the fairness sweep below caught it overriding genuine
  // gkMin gaps: a benched player already sitting on 7 gk-minutes could
  // still beat an on-field player sitting on 0, just for being benched at
  // the right moment, letting keeper duty concentrate unevenly for some
  // squad sizes. Reverted to a tiebreak for that reason — it only ever
  // fires on a genuine tie, never overrides a real gkMin difference.
  //
  // Among candidates tied on gkMin, prefer whoever's currently on the bench
  // (consecBench > 0) — found via a real live game where this WASN'T true:
  // the algorithm picked an already-on-field player as the new keeper (tied
  // on gkMin, but not on this) while the player actually arriving from the
  // bench just filled a regular outfield spot instead, breaking the "next
  // bench player goes to keeper" pattern a coach had come to rely on. With
  // everyone keeper-eligible, most gk changes have everyone tied on gkMin,
  // so this is what makes a keeper change land as a single clean
  // bench<->field swap instead of pulling someone off the pitch who's
  // already out there, which otherwise needs a second, unrelated swap to
  // free up their old outfield spot.
  //
  // When candidates are tied on *everything* this checks (common with a
  // deeper bench — several players can genuinely be tied at zero gkMin for
  // a while), this falls through to array order. `pool` is rotated by the
  // interval index first specifically so that fallback doesn't always
  // favor the same player — without this, whoever's earliest in
  // availableIds can lose every single tied pick for an entire game and
  // end up with zero keeper minutes despite being an equally valid
  // candidate every time. Found by the fairness sweep below, not guessed
  // at. Rotating is deterministic, not random — see the module-level
  // comment on generatePlan for why actual randomness at this level turned
  // out to be the wrong fix for a related problem ("the same kid always
  // starts in goal").
  const pickGkFrom = (pool, prevGk, intervalIndex) => {
    const offset = pool.length ? intervalIndex % pool.length : 0;
    const rotatedPool = [...pool.slice(offset), ...pool.slice(0, offset)];
    return rotatedPool.sort((a, b) => {
      let sa = sim[a].gkMin, sb = sim[b].gkMin;
      if (a === prevGk) sa += 500;
      if (b === prevGk) sb += 500;
      if (sa !== sb) return sa - sb;
      const benchedA = sim[a].consecBench > 0 ? 0 : 1;
      const benchedB = sim[b].consecBench > 0 ? 0 : 1;
      if (benchedA !== benchedB) return benchedA - benchedB;
      return benchPriorityCompare(sim[a], sim[b]);
    })[0];
  };

  const outfieldSort = (a, b) => benchPriorityCompare(sim[a], sim[b]);

  const intervals = [];
  // Seeded with currentGkId (not null) so a rebuild starting mid-shift knows
  // who's already in goal — see the doc comment above.
  let prevGk = currentGkId;

  for (let i = startInterval; i < numIntervals; i++) {
    let onFieldIds, gk;
    // Absolute interval index, not relative to startInterval, so shift
    // boundaries land on the same schedule regardless of when a rebuild
    // happens mid-game.
    const atShiftBoundary = i % shiftLen === 0;

    if (hasEligibleKeeper) {
      const eligiblePool = availableIds.filter((id) => eligibleSet.has(id));
      // A manual starting-keeper override only ever applies to the very
      // first interval being generated in this call — every interval after
      // that goes through the exact same logic as always, so the override
      // is really just seeding prevGk with a specific choice rather than an
      // automatic one, not a separate code path the rest of the game has to
      // know about. Falls through to the normal pick if the given id isn't
      // actually in the eligible pool (stale/invalid — see useMatchState).
      const useManualStart = i === startInterval && startingGkId && eligiblePool.includes(startingGkId);
      // Keep the same keeper mid-shift as long as they're still available
      // and eligible (e.g. not the one who just got injured); otherwise
      // fall through to a fresh pick even off-boundary.
      const keepGk = !atShiftBoundary && prevGk && eligiblePool.includes(prevGk);
      gk = useManualStart ? startingGkId : keepGk ? prevGk : pickGkFrom(eligiblePool, prevGk, i);
      const outfieldPool = availableIds.filter((id) => id !== gk);
      const sortedOutfield = [...outfieldPool].sort(outfieldSort);
      const outfieldOn = sortedOutfield.slice(0, Math.max(0, size - 1));
      onFieldIds = [...outfieldOn, gk];
    } else {
      // No one is marked keeper-eligible at all — an unusual edge case.
      // Keeper shifts don't apply here; keep the original every-interval
      // fallback rather than adding shift-continuation complexity for a
      // state that's already a degraded fallback.
      const pool = [...availableIds].sort(outfieldSort);
      onFieldIds = pool.slice(0, size);
      gk = pickGkFrom(onFieldIds, prevGk, i);
    }

    const bench = availableIds.filter((id) => !onFieldIds.includes(id));

    onFieldIds.forEach((id) => {
      sim[id].fieldMin += intervalLen;
      sim[id].consecBench = 0;
      if (id === gk) sim[id].gkMin += intervalLen;
    });
    bench.forEach((id) => {
      sim[id].consecBench += 1;
    });

    intervals.push({
      index: i,
      startMin: Math.round(i * intervalLen),
      endMin: Math.round((i + 1) * intervalLen),
      onField: onFieldIds.map((id) => ({ id, isGk: id === gk })),
      bench,
    });
    prevGk = gk;
  }

  return { intervals };
}

// generatePlan above picks the keeper purely by least keeper-minutes-so-far
// (with "currently on the bench" only a tiebreak on exact ties, not a hard
// rule — see its own comment for why that's deliberate for keeper-minutes
// fairness). That means a mid-game rebuild can occasionally hand keeper
// duty to someone who was already out on the field, not someone actually
// arriving from the bench — found via a real coach report: an unrelated
// outfield swap (nothing keeper-related) changed who was flagged to become
// keeper next, and the new pick wasn't even the player involved in the
// swap. Fresh games (fixedRotation.js's buildFairSchedule) already
// guarantee "new keeper always arrives from the bench" structurally; this
// gives generatePlan's rebuilds the same guarantee, as a separate,
// additive repair pass rather than changing generatePlan's own picking
// logic — keeps every one of generatePlan's existing, tested properties
// (keeper-minutes fairness, shift continuity, starting-keeper override,
// the tied-candidate rotation) completely intact, since this only ever
// fires on an actual violation, never on a plan that was already fine.
//
// Mutates `intervals` in place via safe outfield<->keeper role swaps only
// — never changes who's on the bench, so nothing about outfield or bench
// fairness is disturbed to fix this. Whenever the keeper actually changes
// (not gated on being at a shift boundary specifically — see the loop's own
// comment for why): if the new keeper was already on the field the
// interval before (jumped from outfield, not the bench), swap them for a
// keeper-eligible player who genuinely wasn't on the field last interval —
// applied across however many following intervals that same (invalid)
// keeper would otherwise have continued into, so shift continuity still
// holds, mirroring fixedRotation.js's repairKeeperBalance/
// repairOutfieldBalance (no separate keeperShiftIntervals input needed
// here — "how long the block runs" is derived directly by watching how far
// the same keeper id continues in `intervals`, not recomputed from shift
// length). Among multiple genuinely-arriving candidates, prefers least
// keeper-minutes so far (optionally seeded from `carryState`, the same
// value the caller already computed for generatePlan itself), keeping the
// swap's own fairness intent close to what generatePlan was already trying
// to do.
//
// If nobody eligible genuinely arrived that interval, the violation is
// left as-is — the one deliberate fallback, exactly matching Path B's own
// documented exception for when there's truly no alternative.
export function repairBenchToKeeper({
  intervals, keeperEligibleIds, currentGkId = null, previousOnFieldIds = null, carryState = null,
}) {
  const eligibleSet = new Set(keeperEligibleIds || []);
  if (eligibleSet.size === 0) return;

  const gkMinSoFar = {};
  const trackedGkMin = (id) => {
    if (gkMinSoFar[id] === undefined) gkMinSoFar[id] = carryState?.[id]?.gkMin || 0;
    return gkMinSoFar[id];
  };

  let prevOnFieldSet = new Set(previousOnFieldIds || []);
  let prevGk = currentGkId;

  for (let idx = 0; idx < intervals.length; idx++) {
    const iv = intervals[idx];
    const gk = iv.onField.find((p) => p.isGk);
    const isGenuineStart = prevGk === null && prevOnFieldSet.size === 0;

    // Deliberately not gated on being at a shift boundary — generatePlan
    // can also force a keeper change off-boundary (e.g. the previous
    // keeper became unavailable), and that new pick deserves the exact
    // same "did they actually arrive from the bench" check.
    if (gk && gk.id !== prevGk && !isGenuineStart && prevOnFieldSet.has(gk.id)) {
      // Violation: gk was already on the field last interval, not arriving
      // from the bench. Find who genuinely just arrived instead.
      const arrivingEligible = iv.onField
        .filter((p) => !p.isGk && eligibleSet.has(p.id) && !prevOnFieldSet.has(p.id))
        .map((p) => p.id);

      if (arrivingEligible.length > 0) {
        const replacement = arrivingEligible.reduce((best, id) => (trackedGkMin(id) < trackedGkMin(best) ? id : best));
        const invalidGkId = gk.id;

        let blockEnd = idx;
        while (blockEnd + 1 < intervals.length) {
          const nextGk = intervals[blockEnd + 1].onField.find((p) => p.isGk);
          if (!nextGk || nextGk.id !== invalidGkId) break;
          blockEnd++;
        }

        for (let k = idx; k <= blockEnd; k++) {
          intervals[k].onField = intervals[k].onField.map((p) => {
            if (p.id === invalidGkId) return { id: invalidGkId, isGk: false };
            if (p.id === replacement) return { id: replacement, isGk: true };
            return p;
          });
        }
      }
    }

    const intervalLen = iv.endMin - iv.startMin;
    const actualGk = iv.onField.find((p) => p.isGk);
    if (actualGk) gkMinSoFar[actualGk.id] = trackedGkMin(actualGk.id) + intervalLen;

    prevGk = actualGk ? actualGk.id : null;
    prevOnFieldSet = new Set(iv.onField.map((p) => p.id));
  }
}

// The gap between whoever ended up with the most total on-field time (gk +
// outfield combined) and whoever ended up with the least, across a whole
// plan. The same measurement the "distributes outfield minutes fairly"
// test already checks, pulled out as real, reusable code rather than only
// living inside a test — see pickFairStartingGk below for why.
export function computeFairnessSpread(intervals, availableIds) {
  const totals = {};
  availableIds.forEach((id) => (totals[id] = 0));
  intervals.forEach((iv) => {
    const len = iv.endMin - iv.startMin;
    iv.onField.forEach((p) => {
      if (totals[p.id] !== undefined) totals[p.id] += len;
    });
  });
  const values = Object.values(totals);
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

// One interval's worth of minutes, plus a small rounding buffer, is the
// threshold generatePlan's own fairness test already treats as "normal,
// expected spread" for a plan generated the usual way. Reused here as the
// actual production definition of "fair enough", so a starting-keeper
// choice gets judged by the same bar the algorithm is already expected to
// clear on its own.
export function isFairSpread(spread, intervalLen) {
  return spread <= intervalLen + 0.5;
}

// Some starting-keeper choices can, through no fault of any single
// decision, cascade into a genuinely less balanced game than others — see
// the "starting keeper" investigation this was built from. Rather than
// gambling on a candidate, or trying to predict in advance which ones are
// safe (no reliable rule for that was found), this tries every candidate
// for real, keeps only the ones whose resulting full game comes out
// acceptably fair, and picks randomly among just those.
//
// `planArgs` is whatever generatePlan itself expects (minus startingGkId,
// which this sets per candidate). Falls back to considering every
// candidate if literally none of them come out fair — better to produce
// *a* plan than none, and this is not expected to happen for a typical
// squad. Returns the winning candidate's id alongside the actual plan
// already generated for it, so the caller doesn't need to regenerate it.
export function pickFairStartingGk({ candidates, planArgs, random = Math.random }) {
  const intervalLen = planArgs.gameMinutes / planArgs.numIntervals;
  const attempts = candidates.map((id) => {
    const { intervals } = generatePlan({ ...planArgs, startingGkId: id });
    return { id, intervals, spread: computeFairnessSpread(intervals, planArgs.availableIds) };
  });
  const fair = attempts.filter((a) => isFairSpread(a.spread, intervalLen));
  const pool = fair.length > 0 ? fair : attempts;
  return pool[Math.floor(random() * pool.length)];
}

// A coach picks the sub interval somewhat arbitrarily — a nice round number
// like 5 or 6 minutes — with no way to know whether that number actually
// suits today's specific squad. This checks each of a handful of candidate
// interval lengths against today's actual game length, field size, and
// (crucially) exactly who's marked available right now, so the answer
// genuinely reflects today's headcount, not just the roster in general.
//
// For each candidate, it tries every possible starting keeper (same
// approach as pickFairStartingGk, reusing the exact same fairness check) and
// keeps the best result — that answers "could the app actually deliver a
// fair game at this interval", not just "does today's specific default
// happen to". If nobody available is keeper-eligible, falls back to a
// single plain generatePlan (nothing to vary the starting keeper across).
export function recommendSubIntervals({ candidateMinutes, gameMinutes, fieldSize, availableIds, keeperEligibleIds }) {
  const startingCandidates = availableIds.filter((id) => keeperEligibleIds.includes(id));
  return candidateMinutes.map((subIntervalMinutes) => {
    const { numIntervals, intervalLen } = computeIntervals(gameMinutes, subIntervalMinutes);
    const planArgs = { availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds };
    const spreads = (startingCandidates.length > 0 ? startingCandidates : [null]).map((startingGkId) => {
      const { intervals } = generatePlan(startingGkId ? { ...planArgs, startingGkId } : planArgs);
      return computeFairnessSpread(intervals, availableIds);
    });
    const bestSpread = Math.min(...spreads);
    return { subIntervalMinutes, numIntervals, intervalLen, bestSpread, fair: isFairSpread(bestSpread, intervalLen) };
  });
}

// Totals each player's time across the whole plan, split into outfield,
// keeper, bench, and (if it happened) injured/sidelined minutes. Since the
// full game is generated up front, this works whether or not the timer's
// ever been started — it's effectively a full match simulation.
//
// Previously this closed over `plan`/`availableIds` from component state;
// it now takes them as explicit arguments so it can be tested and reasoned
// about on its own, with the same behavior.
export function computeMinutesSummary(plan, availableIds) {
  if (!plan) return [];
  return availableIds.map((id) => {
    let outfieldMin = 0, gkMin = 0, benchMin = 0, injuredMin = 0;
    plan.forEach((iv) => {
      const len = iv.endMin - iv.startMin;
      const onF = iv.onField.find((p) => p.id === id);
      if (onF) {
        if (onF.isGk) gkMin += len;
        else outfieldMin += len;
      } else if (iv.bench.includes(id)) {
        benchMin += len;
      } else {
        injuredMin += len; // not on field or bench this interval — was sidelined
      }
    });
    return { id, outfieldMin, gkMin, benchMin, injuredMin };
  });
}

// Rolls up several archived games (see gameHistory.js — each one's
// `players` array is a computeMinutesSummary-shaped record per player who
// was actually part of that game) into season-long totals and per-game
// averages.
//
// A player who wasn't available for a given game simply doesn't appear in
// that game's `players` list at all — never a zero-filled entry — so
// missing a game contributes nothing to their standing either way: not a
// bonus for being absent, and not a penalty that drags their average down
// either. gamesPlayed only ever counts games they were actually part of.
// This is a deliberate fairness decision, not an incidental one: the whole
// point of tracking this is to compensate players for bench time they
// actually endured, never to react to attendance itself.
export function aggregateSeasonSummary(games) {
  const totals = {};
  (games || []).forEach((game) => {
    (game.players || []).forEach((p) => {
      if (!totals[p.id]) {
        totals[p.id] = { id: p.id, name: p.name, gamesPlayed: 0, outfieldMin: 0, gkMin: 0, benchMin: 0, injuredMin: 0 };
      }
      const t = totals[p.id];
      t.gamesPlayed += 1;
      t.outfieldMin += p.outfieldMin || 0;
      t.gkMin += p.gkMin || 0;
      t.benchMin += p.benchMin || 0;
      t.injuredMin += p.injuredMin || 0;
      // Keep the name from the first game we see this player in, not the
      // last — games are passed newest-first (see fetchGameHistory), so
      // "first seen" is their most recent game, and this way a past rename
      // shows up as their current name rather than getting overwritten back
      // to an older one by the time the loop reaches their earliest game.
      if (p.name && !t.name) t.name = p.name;
    });
  });
  return Object.values(totals).map((t) => ({
    ...t,
    avgOutfieldMin: t.gamesPlayed ? t.outfieldMin / t.gamesPlayed : 0,
    avgGkMin: t.gamesPlayed ? t.gkMin / t.gamesPlayed : 0,
    avgBenchMin: t.gamesPlayed ? t.benchMin / t.gamesPlayed : 0,
  }));
}


// Works out which pitch/bench tokens should show a next-sub-window badge in
// MatchView, and which specific badge (see MatchView for what each state
// looks like — red "coming off", green "coming on / switching to outfield",
// or a distinct marker for whoever's becoming keeper). Pulled out as its
// own pure function both to keep MatchView's JSX simpler and so this
// (fiddly — several interacting cases) logic can be tested directly without
// rendering anything.
//
// cur/nextIv are whichever interval is currently being viewed and the one
// after it — not necessarily the live interval. Badges show the transition
// into "next" relative to whatever's on screen, whether that's actually
// about to happen or the coach is previewing/reviewing a different part of
// the game; the only thing that suppresses them is there being no next
// interval to compare against (i.e. viewing the last one).
//
// curGk/nextGk/gkChanging are passed in rather than recomputed here because
// MatchView also needs its OWN live-interval versions of these for the
// last-60-seconds warning banner (that warning is genuinely about the real
// live interval regardless of what's being viewed) — keep those two uses
// separate rather than conflating "viewed" and "live" here.
export function computeNextChangeBadges({ cur, nextIv, curGk, nextGk, gkChanging }) {
  if (!nextIv) {
    return { comingOffIds: new Set(), comingOnIds: new Set(), becomingKeeperId: null, steppingDownKeeperId: null };
  }
  const rawComingOff = cur.onField.map((p) => p.id).filter((id) => !nextIv.onField.some((p) => p.id === id));
  const rawComingOn = nextIv.onField.map((p) => p.id).filter((id) => !cur.onField.some((p) => p.id === id));
  const becomingKeeperId = gkChanging ? nextGk.id : null;
  // "Switching to outfield" covers both a genuine bench arrival AND the
  // outgoing keeper staying on the pitch — same green badge either way. The
  // outgoing keeper only needs it when they're NOT also leaving the field
  // entirely (that's already covered by the red "coming off" badge).
  const steppingDownKeeperId = gkChanging && curGk && !rawComingOff.includes(curGk.id) ? curGk.id : null;
  const regularComingOn = rawComingOn.filter((id) => id !== becomingKeeperId);

  return {
    comingOffIds: new Set(rawComingOff),
    comingOnIds: new Set(regularComingOn),
    becomingKeeperId,
    steppingDownKeeperId,
  };
}
