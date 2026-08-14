import { useState, useEffect, useRef } from "react";
import {
  intervalAtElapsed, computeIntervals, buildCarryState, generatePlan, keeperShiftIntervalsFor, lastGkId,
  resolveBringBack, computeMinutesSummary, repairBenchToKeeper,
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
  const [elapsedSec, setElapsedSec] = useState(0); // derived display value — recomputed from baseElapsedSec/runStartedAt, see the tick effect below
  const [baseElapsedSec, setBaseElapsedSec] = useState(0); // elapsed time as of the start of the current run segment (or the frozen value while paused)
  const [runStartedAt, setRunStartedAt] = useState(null); // Date.now() timestamp the clock was last started, or null while paused
  const [timerRunning, setTimerRunning] = useState(false);
  const [subLog, setSubLog] = useState({}); // intervalIndex -> elapsedSec when sub was confirmed made
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
          availableIds, gameSettings, plan, activeInterval, injuredThisGame, subLog, baseElapsedSec, runStartedAt, timerRunning,
        });
        setSaveError(null);
      } catch (err) {
        setSaveError(describeSaveError(err));
      }
    })();
  }, [activeTeamId, availableIds, gameSettings, plan, activeInterval, injuredThisGame, subLog, baseElapsedSec, runStartedAt, timerRunning]);

  // Tick the clock — recomputed from the real-time anchor every second
  // rather than counted, and auto-frozen once the match reaches full time.
  useEffect(() => {
    if (!timerRunning || !plan) return;
    const capSec = plan[plan.length - 1].endMin * 60;

    const sync = () => {
      const live = computeLiveElapsedSec(baseElapsedSec, runStartedAt, capSec);
      setElapsedSec(live);
      if (live >= capSec) {
        // Full time — freeze the clock rather than let it run past the game.
        setBaseElapsedSec(capSec);
        setRunStartedAt(null);
        setTimerRunning(false);
      }
    };

    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [timerRunning, runStartedAt, baseElapsedSec, plan]);

  // While the timer's running, jump the board to the live interval on every
  // boundary crossing — no exception for a coach having browsed elsewhere.
  // An earlier version left the board alone if it wasn't already showing
  // the previous live interval, meaning to let a coach check ahead without
  // getting yanked back mid-check — but real use showed that's the wrong
  // default: a coach who steps away to fix an upcoming interval (or just
  // taps around) wants to land back on live automatically once play
  // actually moves on, not stay stranded wherever they last looked while
  // the game continues without them noticing. Browsing mid-interval still
  // works exactly the same as before; this only fires at an actual
  // boundary crossing.
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
    // Defense in depth: SquadSettingsForm already disables the submit
    // button when settings are invalid, but this guard stays here too so
    // startPlanning itself can never run with e.g. subIntervalMinutes <= 0,
    // which would otherwise hang the tab in an infinite loop.
    if (!validateGameSettings(gameSettings, availableIds.length).valid) return false;

    // Archive the just-finished game to season history before regenerating.
    // Fire-and-forget (not awaited) so the coach isn't stuck waiting on a
    // network write just to set up the next game — a failure here surfaces
    // through the same saveError banner as everything else, but never blocks
    // starting the new game. Only archives a game that actually reached full
    // time: editing settings mid-game (the "Save & Regenerate" flow, same
    // button/function, different moment) already warns it restarts the
    // rotation, and archiving there too would flood history with abandoned
    // partial games rather than real completed ones.
    if (plan && activeTeamId && elapsedSec >= plan[plan.length - 1].endMin * 60) {
      const summary = computeMinutesSummary(plan, availableIds);
      const players = summary.map((s) => ({ ...(teamData?.roster.find((p) => p.id === s.id) || {}), ...s }));
      archiveGame(activeTeamId, { date: Date.now(), settings: gameSettings, players }).catch((err) => {
        setSaveError(describeSaveError(err));
      });
    }

    const settings = { ...gameSettings };
    saveTeamData({ ...teamData, settings });
    const { numIntervals } = computeIntervals(settings.gameMinutes, settings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(settings.subIntervalMinutes, settings.keeperShiftMinutes);
    const planArgs = {
      availableIds,
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

  // Manual override: swap a specific bench player on for a specific player
  // currently on the pitch, effective for the rest of the current interval.
  // The swapped-in player takes over whatever role (GK or outfield) the
  // player they replaced had. Future intervals then rebuild normally from
  // this new state, so the swap feeds fairly into ongoing rotation.
  const performSwap = (benchId, fieldId) => {
    const cur = plan[activeInterval];
    const outgoing = cur.onField.find((p) => p.id === fieldId);
    if (!outgoing) return;

    const priorIntervals = plan.slice(0, activeInterval);
    const frozenCurrent = {
      ...cur,
      onField: cur.onField.map((p) => (p.id === fieldId ? { id: benchId, isGk: outgoing.isGk } : p)),
      bench: cur.bench.filter((id) => id !== benchId).concat(fieldId),
    };
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
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId,
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

  // Manual override: swap keeper duty directly between two players who are
  // BOTH already on the pitch — the current keeper steps out to outfield,
  // `newKeeperId` steps in — without touching the bench at all. Distinct
  // from performSwap (which always brings someone on FROM the bench): this
  // is for "I want a different keeper right now" without needing a bench
  // rotation to justify it — a coach course-correcting at a natural break
  // in play, not waiting for whoever happens to be arriving next. Future
  // intervals rebuild normally from this new state and go through the same
  // repairBenchToKeeper guarantee as every other rebuild, so this one
  // deliberate exception doesn't cascade into more of them — the very next
  // *automatic* keeper change still has to come from the bench as usual.
  const performKeeperSwap = (newKeeperId) => {
    const cur = plan[activeInterval];
    const currentKeeper = cur.onField.find((p) => p.isGk);
    const target = cur.onField.find((p) => p.id === newKeeperId);
    if (!currentKeeper || !target || target.isGk || !keeperEligibleIds.includes(newKeeperId)) return;

    const priorIntervals = plan.slice(0, activeInterval);
    const frozenCurrent = {
      ...cur,
      onField: cur.onField.map((p) => {
        if (p.id === newKeeperId) return { id: p.id, isGk: true };
        if (p.id === currentKeeper.id) return { id: p.id, isGk: false };
        return p;
      }),
    };
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
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId,
    });
    repairBenchToKeeper({
      intervals: rebuiltRemainder, keeperEligibleIds, currentGkId, carryState,
      previousOnFieldIds: frozenCurrent.onField.map((p) => p.id),
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
  };

  return {
    availableIds, setAvailableIds,
    gameSettings, setGameSettings,
    plan, setPlan,
    activeInterval, setActiveInterval,
    lastLiveIntervalRef,
    injuredThisGame, setInjuredThisGame,
    elapsedSec, setElapsedSec,
    baseElapsedSec, setBaseElapsedSec,
    runStartedAt, setRunStartedAt,
    timerRunning, setTimerRunning,
    subLog, setSubLog,
    swapPickId, setSwapPickId,
    startingGkId, setStartingGkId,
    saveError, setSaveError,
    keeperEligibleIds,
    startPlanning, handleInjury, bringBack, performSwap, performKeeperSwap,
  };
}
