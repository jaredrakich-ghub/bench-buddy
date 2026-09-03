import { useState, useEffect, useRef } from "react";
import {
  intervalAtElapsed, computeIntervals, buildCarryState, generatePlan, keeperShiftIntervalsFor, lastGkId,
  resolveBringBack, computeMinutesSummary, repairBenchToKeeper, extractGkByInterval,
} from "../lib/rotation.js";
import { generateFixedPlan } from "../lib/fixedRotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { defaultSettings } from "../lib/teams.js";
import { saveMatchState, describeSaveError } from "../lib/firestoreTeams.js";
import { archiveGame } from "../lib/gameHistory.js";

// Owns everything about the match currently being run for whichever team is
// active: today's squad availability/settings, the generated rotation plan,
// the live clock, injuries, manual swaps, and persisting all of it to
// Firestore. Takes activeTeamId/teamData/saveTeamData from useTeamRegistry
// as plain inputs rather than reaching for that hook itself — switching
// *which* team is active, and reloading this match state to match, has to
// happen as one atomic batch (see activateTeam in SubRotationPlanner.jsx),
// so that orchestration deliberately lives there rather than in either hook.
export function useMatchState({ activeTeamId, teamData, saveTeamData }) {
  const [availableIds, setAvailableIds] = useState([]);
  const [gameSettings, setGameSettings] = useState(defaultSettings());
  const [plan, setPlan] = useState(null);
  const [activeInterval, setActiveInterval] = useState(0);
  // Tracks the last live interval the auto-follow effect (below) saw, so it
  // can tell "the coach is still following along live" apart from "the
  // coach manually browsed to a different interval" — see that effect for
  // why this matters. Also set directly (via .current) by
  // SubRotationPlanner's activateTeam/startPlanning whenever activeInterval
  // is set directly outside this hook's own effects.
  const lastLiveIntervalRef = useRef(0);
  const [injuredThisGame, setInjuredThisGame] = useState([]);
  const [injuredAt, setInjuredAt] = useState({}); // playerId -> elapsedSec when marked injured — display only, same role subLog plays for subs
  const [elapsedSec, setElapsedSec] = useState(0); // derived display value — recomputed from baseElapsedSec/runStartedAt, see the tick effect below
  const [baseElapsedSec, setBaseElapsedSec] = useState(0); // elapsed time as of the start of the current run segment (or the frozen value while paused)
  const [runStartedAt, setRunStartedAt] = useState(null); // Date.now() timestamp the clock was last started, or null while paused
  const [timerRunning, setTimerRunning] = useState(false);
  // intervalIndex -> elapsedSec when a sub was confirmed made. No longer
  // gates anything (see the auto-follow effect below — block 11's
  // real-use-feedback simplification made the rotation schedule itself
  // the single source of truth for minutes/board-advancement, with "Sub
  // done" downgraded to a coach acknowledgment). Kept only as a historical
  // display value, same role injuredAt plays for injuries.
  const [subLog, setSubLog] = useState({});
  const [swapPickId, setSwapPickId] = useState(null); // bench player id awaiting a pitch target to swap with
  const [saveError, setSaveError] = useState(null);
  // A coach's manual pick for who starts in goal on the next game (e.g.
  // honoring "can I start in goal?"), set from the squad setup screen.
  // One-shot, like swapPickId — consumed and cleared by startPlanning.
  const [startingGkId, setStartingGkId] = useState(null);

  // Persist the in-progress match so a refresh, a backgrounded tab getting
  // reloaded, or closing the browser doesn't lose it. This deliberately does
  // NOT fire every second — only baseElapsedSec/runStartedAt change (on
  // Start/Pause/Reset/full-time), not the ticking display value — so saving
  // stays cheap and infrequent. Kept in its own subdocument per team so two
  // teams' games can't collide/overwrite each other, and so a future
  // collaborator on one team never sees another team's match data.
  useEffect(() => {
    if (!plan || !activeTeamId) return;
    (async () => {
      try {
        await saveMatchState(activeTeamId, {
          availableIds, gameSettings, plan, activeInterval, injuredThisGame, injuredAt, subLog, baseElapsedSec, runStartedAt, timerRunning,
        });
        setSaveError(null);
      } catch (err) {
        setSaveError(describeSaveError(err));
      }
    })();
  }, [activeTeamId, availableIds, gameSettings, plan, activeInterval, injuredThisGame, injuredAt, subLog, baseElapsedSec, runStartedAt, timerRunning]);

  // Tick the clock — recomputed from the real-time anchor every second
  // rather than counted, and auto-frozen once the match reaches full time.
  useEffect(() => {
    if (!timerRunning || !plan) return;
    const capSec = plan[plan.length - 1].endMin * 60;
    // Plain local, not React state: setInterval's own callback (sync,
    // below) fires synchronously and repeatedly within a single burst of
    // fake-timer (or a slow real) ticks, all sharing this one effect's
    // closure well before React gets a chance to re-render and tear the
    // interval down via timerRunning flipping false. A state-based guard
    // read the same stale value on every one of those ticks; this plain
    // variable is mutated immediately and synchronously the first time,
    // so every tick after that correctly sees it's already archived.
    let archived = false;

    const sync = () => {
      const live = computeLiveElapsedSec(baseElapsedSec, runStartedAt, capSec);
      setElapsedSec(live);
      if (live >= capSec) {
        // Full time — freeze the clock rather than let it run past the game.
        setBaseElapsedSec(capSec);
        setRunStartedAt(null);
        setTimerRunning(false);

        // Archive the just-finished game to season history right as it
        // actually ends, not whenever the coach next happens to open
        // settings for the next one — real-use feedback: checking season
        // data between games used to show the just-finished game as if it
        // never happened, since archiving used to live in startPlanning
        // (only reached by tapping "Build new rotation" for the *next*
        // game). Fire-and-forget (not awaited) so freezing the clock isn't
        // stuck waiting on a network write; a failure here surfaces
        // through the same saveError banner as everything else, same as
        // before. A fresh game gets its own effect invocation (plan is a
        // dependency below), so `archived` naturally resets per game —
        // no risk of an old game's own already-fired flag suppressing a
        // later one's.
        if (!archived && activeTeamId) {
          archived = true;
          const summary = computeMinutesSummary(plan, availableIds);
          const players = summary.map((s) => ({ ...(teamData?.roster.find((p) => p.id === s.id) || {}), ...s }));
          archiveGame(activeTeamId, { date: Date.now(), settings: gameSettings, players }).catch((err) => {
            setSaveError(describeSaveError(err));
          });
        }
      }
    };

    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
    // activeTeamId/gameSettings/availableIds/teamData.roster (read above,
    // only on the once-per-game archive branch) don't need to tear down
    // and recreate this interval on every one of their own unrelated
    // changes — sync() already closes over their latest values fresh
    // each time this effect *does* re-run, which happens on every real
    // game transition anyway (plan/timerRunning both change together).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, runStartedAt, baseElapsedSec, plan]);

  // While the timer's running, keep the board following the live interval
  // — purely a function of the clock against the planned schedule, same as
  // every other piece of rotation-fairness math in this app. (Block 11
  // briefly gated this on the coach confirming each sub via subLog; real-
  // use feedback settled on "rely on the rotation" instead — see
  // MatchView.jsx's final-60 sheets for how "Sub done" now behaves as a
  // pure acknowledgment with zero effect on timing.)
  //
  // No exception for a coach having browsed elsewhere: once the clock
  // crosses a boundary, the board snaps back to live regardless of where
  // they'd wandered off to.
  useEffect(() => {
    if (!timerRunning || !plan) return;
    const live = intervalAtElapsed(plan, elapsedSec);
    if (live === lastLiveIntervalRef.current) return;
    setActiveInterval(live);
    lastLiveIntervalRef.current = live;
  }, [elapsedSec, timerRunning, plan]);

  const keeperEligibleIds = teamData ? teamData.roster.filter((p) => p.keeperEligible).map((p) => p.id) : [];

  // Returns whether a plan was actually (re)generated, so the caller —
  // which owns the settings-modal open/close state, not this hook — knows
  // whether to close it. (It's meant to close on every successful submit;
  // it was left open by mistake for a while after plan/modal state got
  // split across hooks, since nothing in here could reach the modal flag.)
  const startPlanning = () => {
    // Defensive: availableIds can end up holding an id with no matching
    // roster entry any more — a race between two rapid roster saves
    // (addPlayer/addPlayers/removePlayer in SubRotationPlanner.jsx) can
    // silently drop a player from the roster while this list still
    // remembers their id, since the two are saved through separate state
    // updates. Filtering here means a stale id can never reach the rotation
    // engine and come out as an unresolvable "?" bench/pitch slot — and
    // persisting the filtered list back (setAvailableIds below) means this
    // also self-heals a team that already has one, the next time a
    // rotation gets built, with no manual cleanup needed.
    const validAvailableIds = availableIds.filter((id) => teamData.roster.some((p) => p.id === id));
    if (validAvailableIds.length !== availableIds.length) setAvailableIds(validAvailableIds);

    // Defense in depth: SquadSettingsForm already disables the submit
    // button when settings are invalid, but this guard stays here too so
    // startPlanning itself can never run with e.g. subIntervalMinutes <= 0,
    // which would otherwise hang the tab in an infinite loop.
    if (!validateGameSettings(gameSettings, validAvailableIds.length).valid) return false;

    // Archiving the just-finished game to season history used to happen
    // here — moved to the clock's own tick effect above, firing right at
    // the moment full time is actually reached instead of waiting for the
    // coach to get this far into setting up the next game. See that
    // effect's own comment for the full story and the double-archive guard.

    const settings = { ...gameSettings };
    saveTeamData((prev) => ({ ...prev, settings }));
    const { numIntervals } = computeIntervals(settings.gameMinutes, settings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(settings.subIntervalMinutes, settings.keeperShiftMinutes);
    const planArgs = {
      availableIds: validAvailableIds,
      gameMinutes: settings.gameMinutes,
      numIntervals,
      fieldSize: settings.fieldSize,
      keeperEligibleIds,
      keeperShiftIntervals,
    };

    // A fresh game (no carryState) uses the new fixed-rotation engine —
    // Path B, see fixedRotation.js — which guarantees bench->keeper always
    // and fair bench/keeper turn counts by construction, not by a
    // simulated-and-checked heuristic. A stale manual pick (the player
    // toggled unavailable/keeper-ineligible after being picked, in the rare
    // case the squad setup screen's own reactive clear didn't already catch
    // it) is silently ignored by generateFixedPlan itself, same contract as
    // before. Honored directly when valid, regardless of fairness — the
    // coach already saw a live warning in the squad setup screen if this
    // choice wasn't a fair one (see SquadSettingsForm), so this is an
    // informed decision, not a silent one.
    //
    // Mid-game rebuilds (handleInjury/bringBack/performSwap below) still use
    // generatePlan with carryState — Path B doesn't yet have a way to
    // continue an in-progress schedule from a modified roster, only to
    // build a fresh one from interval 0. Deliberately scoped this way
    // rather than rushed: the existing carryState path already works and
    // is well-tested, and it's better to ship the fresh-game improvement
    // now than delay it waiting on a mid-game-continuation design.
    const { intervals } = generateFixedPlan({ ...planArgs, startingGkId });

    setPlan(intervals);
    lastLiveIntervalRef.current = 0;
    setActiveInterval(0);
    setInjuredThisGame([]);
    setElapsedSec(0);
    setBaseElapsedSec(0);
    setRunStartedAt(null);
    setTimerRunning(false);
    setSubLog({});
    setSwapPickId(null);
    setStartingGkId(null);
    return true;
  };

  // rebuild the remainder of the plan from the current interval onward using
  // a given set of injured (sidelined) player ids
  const rebuildFromInterval = (newInjuredList) => {
    const remainingAvailable = availableIds.filter((id) => !newInjuredList.includes(id));
    const priorIntervals = plan.slice(0, activeInterval);
    const carryState = buildCarryState(availableIds, priorIntervals);

    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const currentGkId = lastGkId(priorIntervals);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval,
      carryState,
      keeperShiftIntervals,
      currentGkId,
      preferredGkByInterval: extractGkByInterval(plan),
    });
    // Guarantees the rebuild's new keeper (if it changes here) actually
    // arrives from the bench, same as a fresh game — see the function's
    // own comment for why generatePlan alone doesn't always ensure this.
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: priorIntervals[priorIntervals.length - 1]?.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, ...rebuiltRemainder]);
    setInjuredThisGame(newInjuredList);
  };

  const handleInjury = (playerId) => {
    if (injuredThisGame.includes(playerId)) return;
    rebuildFromInterval([...injuredThisGame, playerId]);
    setInjuredAt((prev) => ({ ...prev, [playerId]: elapsedSec }));
  };

  // A returning player joins the BACK of the bench queue for whatever's
  // left of the current interval, or fills a genuine opening on the pitch
  // by promoting whoever's actually owed it — see resolveBringBack in
  // rotation.js (pulled out to be independently testable) for exactly how
  // that's decided.
  //
  // Either way, their own consecutive-bench streak resets to zero once
  // they're on the bench, so they go to the back of the queue rather than
  // jumping it on the strength of their injury time.
  const bringBack = (playerId) => {
    if (!injuredThisGame.includes(playerId)) return;
    const newInjuredList = injuredThisGame.filter((id) => id !== playerId);

    const priorIntervals = plan.slice(0, activeInterval);
    const cur = plan[activeInterval];
    const remainingAvailableThisInterval = availableIds.filter((id) => !newInjuredList.includes(id));
    const normalFieldSize = Math.min(gameSettings.fieldSize, remainingAvailableThisInterval.length);
    const standing = buildCarryState(availableIds, priorIntervals);
    const { onField, bench } = resolveBringBack({
      playerId, onField: cur.onField, bench: cur.bench, standing, normalFieldSize,
    });
    const frozenCurrent = { ...cur, onField, bench };
    const doneIntervals = [...priorIntervals, frozenCurrent];

    const carryState = buildCarryState(availableIds, doneIntervals);
    if (carryState[playerId]) carryState[playerId].consecBench = 0; // back of the queue, not front

    const remainingAvailable = availableIds.filter((id) => !newInjuredList.includes(id));
    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const currentGkId = lastGkId(doneIntervals);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId,
      preferredGkByInterval: extractGkByInterval(plan),
    });
    // See handleInjury's identical call for why — guarantees a keeper
    // change here actually arrives from the bench.
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: frozenCurrent.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
    setInjuredThisGame(newInjuredList);
  };

  // README > A7-Squad-change (#10d): a player who wasn't part of the game
  // yet — arrived late, or was simply left off availability at kickoff —
  // joins the rotation from right now. Same "freeze the current interval,
  // rebuild the remainder" pattern as bringBack (which returns someone
  // from injuredThisGame); generalized to someone who's never been in
  // availableIds at all. Reuses resolveBringBack directly — it has no
  // injury-specific coupling, just "does an opening exist right now, and
  // if not, who's most owed the promotion" — so the newcomer joins the
  // bench queue for what's left of this interval, or fills a genuine
  // opening if one exists, exactly like a returning player would.
  //
  // Deliberately NOT routed through startPlanning/generateFixedPlan —
  // that resets the whole clock and subLog (see its own comment), which
  // would erase a game already in progress just to add one late arrival.
  // This only touches the plan from the current interval forward, the
  // same safety guarantee the injury/bring-back flow already has.
  const addArrival = (playerId) => {
    if (availableIds.includes(playerId)) return;
    const newAvailableIds = [...availableIds, playerId];

    const priorIntervals = plan.slice(0, activeInterval);
    const cur = plan[activeInterval];
    const remainingAvailableThisInterval = newAvailableIds.filter((id) => !injuredThisGame.includes(id));
    const normalFieldSize = Math.min(gameSettings.fieldSize, remainingAvailableThisInterval.length);
    const standing = buildCarryState(newAvailableIds, priorIntervals);
    const { onField, bench } = resolveBringBack({
      playerId, onField: cur.onField, bench: cur.bench, standing, normalFieldSize,
    });
    const frozenCurrent = { ...cur, onField, bench };
    const doneIntervals = [...priorIntervals, frozenCurrent];

    // Not "back of a queue they were already waiting in" — a brand-new
    // arrival's consecBench naturally comes out at "however many
    // intervals have already happened" (buildCarryState counts every
    // prior interval they weren't part of), which is the right instinct
    // here: it prioritizes bringing them on soon rather than treating a
    // midway arrival as having zero claim on minutes.
    const carryState = buildCarryState(newAvailableIds, doneIntervals);

    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const currentGkId = lastGkId(doneIntervals);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailableThisInterval,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId,
      preferredGkByInterval: extractGkByInterval(plan),
    });
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: frozenCurrent.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
    setAvailableIds(newAvailableIds);
  };

  // The opposite of addArrival: an available player leaves early. Deliberately
  // *not* the same thing as an injury (handleInjury/rebuildFromInterval) —
  // this is plain "not here anymore", not "hurt", so it never touches
  // injuredThisGame/injuredAt and the player never gets the red-cross
  // treatment elsewhere in the UI. Mechanically identical to
  // rebuildFromInterval's own pattern otherwise: rebuilds from the
  // *current* interval (not +1) since README > A7-Squad-change says
  // removing someone already on the pitch is real — they come off
  // immediately, same as an injury would, just without the injury framing.
  const removeAvailability = (playerId) => {
    if (!availableIds.includes(playerId)) return;
    const newAvailableIds = availableIds.filter((id) => id !== playerId);

    const remainingAvailable = newAvailableIds.filter((id) => !injuredThisGame.includes(id));
    const priorIntervals = plan.slice(0, activeInterval);
    const carryState = buildCarryState(newAvailableIds, priorIntervals);

    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const currentGkId = lastGkId(priorIntervals);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval,
      carryState,
      keeperShiftIntervals,
      currentGkId,
      preferredGkByInterval: extractGkByInterval(plan),
    });
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: priorIntervals[priorIntervals.length - 1]?.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, ...rebuiltRemainder]);
    setAvailableIds(newAvailableIds);
  };

  // Manual override: swap any two players — either could currently be on
  // the bench or already on the pitch (including the keeper). Targets
  // `targetIndex` (defaults to the live interval, `activeInterval`) —
  // every existing call site swaps live and leans on that default, but a
  // coach can also reach one interval *ahead* with this by passing
  // pendingIndex+1 explicitly (see MatchView.jsx's final-60 execute sheet:
  // "a kid who's about to be subbed on doesn't want to go back on" needs
  // to redirect who's coming on *before* the boundary even crosses, which
  // is a different interval than whatever's currently live). Covers what
  // used to be two separate functions:
  //   - one on the bench, one on the pitch: the bench player takes over
  //     whatever role (GK or outfield) the pitch player had, exactly like
  //     the original bench "Swap in" flow.
  //   - both already on the pitch: they simply trade roles in place, bench
  //     untouched — this is what a separate performKeeperSwap used to do.
  //     Swapping with whoever's currently in goal *is* "make yourself
  //     keeper," so a coach doing that through this one generic action gets
  //     the same result "Make keeper" used to give as a special case —
  //     there's no separate code path needed for it.
  //   - both on the bench: nothing meaningful to do, no-op.
  // Guards against putting a non-keeper-eligible player into the keeper
  // role either way — the original bench-swap path never actually checked
  // this (a coach could swap a non-eligible player straight onto the pitch
  // in place of the keeper), which is a real gap this closes now that the
  // check lives in one shared place instead of only performKeeperSwap.
  // Future intervals rebuild normally from this new state and go through
  // the same repairBenchToKeeper guarantee as every other rebuild, so this
  // one deliberate exception doesn't cascade into more of them — the very
  // next *automatic* keeper change still has to come from the bench as usual.
  const performSwap = (playerAId, playerBId, targetIndex = activeInterval) => {
    if (playerAId === playerBId) return; // nothing to swap with themselves
    const cur = plan[targetIndex];
    const aOnField = cur.onField.find((p) => p.id === playerAId);
    const bOnField = cur.onField.find((p) => p.id === playerBId);
    const aOnBench = cur.bench.includes(playerAId);
    const bOnBench = cur.bench.includes(playerBId);
    if ((!aOnField && !aOnBench) || (!bOnField && !bOnBench)) return; // one of them isn't actually here this interval
    if (aOnBench && bOnBench) return; // both on the bench — nothing to swap

    let newOnField, newBench;
    if (aOnField && bOnField) {
      if (aOnField.isGk && !keeperEligibleIds.includes(playerBId)) return;
      if (bOnField.isGk && !keeperEligibleIds.includes(playerAId)) return;
      newOnField = cur.onField.map((p) => {
        if (p.id === playerAId) return { id: playerAId, isGk: bOnField.isGk };
        if (p.id === playerBId) return { id: playerBId, isGk: aOnField.isGk };
        return p;
      });
      newBench = cur.bench;
    } else {
      const outgoing = aOnField || bOnField;
      const fieldId = aOnField ? playerAId : playerBId;
      const benchId = aOnField ? playerBId : playerAId;
      if (outgoing.isGk && !keeperEligibleIds.includes(benchId)) return;
      newOnField = cur.onField.map((p) => (p.id === fieldId ? { id: benchId, isGk: outgoing.isGk } : p));
      newBench = cur.bench.filter((id) => id !== benchId).concat(fieldId);
    }

    const priorIntervals = plan.slice(0, targetIndex);
    const frozenCurrent = { ...cur, onField: newOnField, bench: newBench };
    const doneIntervals = [...priorIntervals, frozenCurrent];
    const carryState = buildCarryState(availableIds, doneIntervals);

    const remainingAvailable = availableIds.filter((id) => !injuredThisGame.includes(id));
    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const currentGkId = lastGkId(doneIntervals);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: targetIndex + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId,
      preferredGkByInterval: extractGkByInterval(plan),
    });
    // See handleInjury's identical call for why — guarantees a keeper
    // change here actually arrives from the bench. This is the exact
    // scenario reported: an outfield-only swap shouldn't be able to hand
    // keeper duty to someone who was already on the field.
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: frozenCurrent.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
    setSwapPickId(null);
  };

  // Restarts today's game from 0:00 on the SAME rotation plan — clock, sub
  // log, and which interval the board's showing all rewind, nothing about
  // the plan itself changes. Deliberately doesn't touch injuries: a real
  // injury already happened, and rewinding the clock shouldn't quietly
  // un-injure someone.
  //
  // Existed pre-match-day-redesign (a header icon next to the cog), then
  // briefly as its own action-bar button (real-use feedback: "those reset
  // buttons look terrible") — now a hidden gesture, tapping the timer
  // display itself opens a confirm dialog (see MatchView.jsx). The
  // underlying action is unchanged either way; only the trigger moved.
  const resetClock = () => {
    setTimerRunning(false);
    setRunStartedAt(null);
    setBaseElapsedSec(0);
    setElapsedSec(0);
    setSubLog({});
    // Without this, the clock could show 0:00 while the pitch board still
    // displayed whatever interval the coach last happened to be browsing —
    // same reasoning as startPlanning's own reset above.
    lastLiveIntervalRef.current = 0;
    setActiveInterval(0);
  };

  return {
    availableIds, setAvailableIds,
    gameSettings, setGameSettings,
    plan, setPlan,
    activeInterval, setActiveInterval,
    lastLiveIntervalRef,
    injuredThisGame, setInjuredThisGame,
    injuredAt, setInjuredAt,
    elapsedSec, setElapsedSec,
    baseElapsedSec, setBaseElapsedSec,
    runStartedAt, setRunStartedAt,
    timerRunning, setTimerRunning,
    subLog, setSubLog,
    swapPickId, setSwapPickId,
    startingGkId, setStartingGkId,
    saveError, setSaveError,
    keeperEligibleIds,
    startPlanning, handleInjury, bringBack, performSwap, addArrival, removeAvailability, resetClock,
  };
}
