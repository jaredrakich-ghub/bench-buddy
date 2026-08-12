import { useState, useEffect, useRef } from "react";
import {
  intervalAtElapsed, computeIntervals, buildCarryState, generatePlan, keeperShiftIntervalsFor, lastGkId,
  resolveBringBack, resolveAutoFollowInterval,
} from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { defaultSettings } from "../lib/teams.js";
import { saveMatchState, describeSaveError } from "../lib/firestoreTeams.js";

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

  // While the timer's running, follow the live interval — but only across
  // an actual boundary crossing (the live interval changing to a new one),
  // and only if the board was already showing the previous live interval.
  // That second condition is what lets a coach tap ahead/back to check
  // another interval without instantly getting dragged back to the live
  // one on the next tick: the moment they navigate away, activeInterval no
  // longer matches lastLiveIntervalRef, so this stops touching it until
  // they navigate back to live themselves (which re-syncs the two and lets
  // auto-follow resume from there).
  useEffect(() => {
    if (!timerRunning || !plan) return;
    const live = intervalAtElapsed(plan, elapsedSec);
    if (live === lastLiveIntervalRef.current) return;
    // Functional setState form deliberately kept here (rather than passing
    // activeInterval from the closure) so this is correct even though
    // activeInterval isn't a dependency of this effect — React guarantees
    // `current` is the true latest value, not a possibly-stale closed-over
    // one. resolveAutoFollowInterval only decides WHAT the new value should
    // be; see rotation.js for the actual "should we follow or not" rule.
    setActiveInterval((current) =>
      resolveAutoFollowInterval({ liveInterval: live, lastLiveInterval: lastLiveIntervalRef.current, currentActiveInterval: current })
    );
    lastLiveIntervalRef.current = live;
  }, [elapsedSec, timerRunning, plan]);

  const keeperEligibleIds = teamData ? teamData.roster.filter((p) => p.keeperEligible).map((p) => p.id) : [];

  const startPlanning = () => {
    // Defense in depth: SquadSettingsForm already disables the submit
    // button when settings are invalid, but this guard stays here too so
    // startPlanning itself can never run with e.g. subIntervalMinutes <= 0,
    // which would otherwise hang the tab in an infinite loop.
    if (!validateGameSettings(gameSettings, availableIds.length).valid) return;
    const settings = { ...gameSettings };
    saveTeamData({ ...teamData, settings });
    const { numIntervals } = computeIntervals(settings.gameMinutes, settings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(settings.subIntervalMinutes, settings.keeperShiftMinutes);
    const { intervals } = generatePlan({
      availableIds,
      gameMinutes: settings.gameMinutes,
      numIntervals,
      fieldSize: settings.fieldSize,
      keeperEligibleIds,
      keeperShiftIntervals,
    });
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
  };

  // rebuild the remainder of the plan from the current interval onward using
  // a given set of injured (sidelined) player ids
  const rebuildFromInterval = (newInjuredList) => {
    const remainingAvailable = availableIds.filter((id) => !newInjuredList.includes(id));
    const priorIntervals = plan.slice(0, activeInterval);
    const carryState = buildCarryState(availableIds, priorIntervals);

    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const keeperShiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval,
      carryState,
      keeperShiftIntervals,
      currentGkId: lastGkId(priorIntervals),
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
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId: lastGkId(doneIntervals),
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
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
      keeperShiftIntervals,
      currentGkId: lastGkId(doneIntervals),
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
    setSwapPickId(null);
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
    saveError, setSaveError,
    startPlanning, handleInjury, bringBack, performSwap,
  };
}
