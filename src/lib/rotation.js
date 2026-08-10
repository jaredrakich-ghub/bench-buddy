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
export function generatePlan({ availableIds, gameMinutes, numIntervals, fieldSize, keeperEligibleIds, startInterval = 0, carryState = null }) {
  const size = Math.min(fieldSize, availableIds.length);
  const intervalLen = gameMinutes / numIntervals;

  const sim = {};
  availableIds.forEach((id) => {
    sim[id] = carryState?.[id] ? { ...carryState[id] } : { fieldMin: 0, gkMin: 0, consecBench: 0 };
  });

  const eligibleSet = new Set(keeperEligibleIds || []);
  const hasEligibleKeeper = availableIds.some((id) => eligibleSet.has(id));

  const pickGkFrom = (pool, prevGk) =>
    [...pool].sort((a, b) => {
      let sa = sim[a].gkMin, sb = sim[b].gkMin;
      if (a === prevGk) sa += 500;
      if (b === prevGk) sb += 500;
      return sa - sb;
    })[0];

  const outfieldSort = (a, b) => {
    const sa = sim[a], sb = sim[b];
    if (sb.consecBench !== sa.consecBench) return sb.consecBench - sa.consecBench;
    return sa.fieldMin - sb.fieldMin;
  };

  const intervals = [];
  let prevGk = null;

  for (let i = startInterval; i < numIntervals; i++) {
    let onFieldIds, gk;

    if (hasEligibleKeeper) {
      const eligiblePool = availableIds.filter((id) => eligibleSet.has(id));
      gk = pickGkFrom(eligiblePool, prevGk);
      const outfieldPool = availableIds.filter((id) => id !== gk);
      const sortedOutfield = [...outfieldPool].sort(outfieldSort);
      const outfieldOn = sortedOutfield.slice(0, Math.max(0, size - 1));
      onFieldIds = [...outfieldOn, gk];
    } else {
      const pool = [...availableIds].sort(outfieldSort);
      onFieldIds = pool.slice(0, size);
      gk = pickGkFrom(onFieldIds, prevGk);
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
