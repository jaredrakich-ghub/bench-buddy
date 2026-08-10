import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { intervalAtElapsed, computeIntervals, buildCarryState, generatePlan } from "../lib/rotation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { fontStyle, styles } from "./styles.js";
import SummaryModal from "./SummaryModal.jsx";
import SquadSettingsForm from "./SquadSettingsForm.jsx";
import MatchView from "./MatchView.jsx";

const STORAGE_KEY = "team-data-v2";
// Separate key from the roster/settings above: this is the *in-progress
// match* (plan, clock, injuries, subs so far) — see the Phase 3 note above
// the load effect for why it's kept apart.
const MATCH_STORAGE_KEY = "match-state-v1";

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultTeamData = () => ({
  roster: [],
  settings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
});

export default function SubRotationPlanner() {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [availableIds, setAvailableIds] = useState([]);
  const [gameSettings, setGameSettings] = useState(defaultTeamData().settings);
  const [plan, setPlan] = useState(null);
  const [activeInterval, setActiveInterval] = useState(0);
  const [injuredThisGame, setInjuredThisGame] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0); // derived display value — recomputed from baseElapsedSec/runStartedAt, see the tick effect below
  const [baseElapsedSec, setBaseElapsedSec] = useState(0); // elapsed time as of the start of the current run segment (or the frozen value while paused)
  const [runStartedAt, setRunStartedAt] = useState(null); // Date.now() timestamp the clock was last started, or null while paused
  const [timerRunning, setTimerRunning] = useState(false);
  const [subLog, setSubLog] = useState({}); // intervalIndex -> elapsedSec when sub was confirmed made
  const [swapPickId, setSwapPickId] = useState(null); // bench player id awaiting a pitch target to swap with
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [importText, setImportText] = useState("");
  const [importConfirming, setImportConfirming] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  // Load the roster/settings, then try to resume an in-progress match if one
  // was saved (Phase 3). The clock is reconstructed from a real timestamp
  // rather than a raw counter, so it comes back correct even after a long
  // gap — as long as it was actually running (not paused) when last saved.
  useEffect(() => {
    (async () => {
      let roster = [];
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        const raw = res ? JSON.parse(res.value) : defaultTeamData();
        const data = {
          roster: (raw.roster || []).map((p) => ({ ...p, keeperEligible: p.keeperEligible !== false })),
          settings: { ...defaultTeamData().settings, ...raw.settings },
        };
        roster = data.roster;
        setTeamData(data);
        setGameSettings(data.settings);
        setAvailableIds(data.roster.map((p) => p.id)); // default: everyone on the squad is assumed available
      } catch {
        setTeamData(defaultTeamData());
      }

      try {
        const matchRes = await window.storage.get(MATCH_STORAGE_KEY, false);
        const saved = matchRes ? JSON.parse(matchRes.value) : null;
        if (saved?.plan?.length) {
          const capSec = saved.plan[saved.plan.length - 1].endMin * 60;
          const live = computeLiveElapsedSec(saved.baseElapsedSec, saved.timerRunning ? saved.runStartedAt : null, capSec);
          const stillRunning = saved.timerRunning && live < capSec;

          setAvailableIds(saved.availableIds || roster.map((p) => p.id));
          setGameSettings(saved.gameSettings || defaultTeamData().settings);
          setPlan(saved.plan);
          setInjuredThisGame(saved.injuredThisGame || []);
          setSubLog(saved.subLog || {});
          setBaseElapsedSec(live);
          setElapsedSec(live);
          setRunStartedAt(stillRunning ? saved.runStartedAt : null);
          setTimerRunning(stillRunning);
          setActiveInterval(intervalAtElapsed(saved.plan, live));
        }
      } catch {
        // no in-progress match to resume — normal on a first run
      }

      setLoading(false);
    })();
  }, []);

  const saveTeamData = useCallback(async (data) => {
    setTeamData(data);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
    } catch {
      // best-effort; ignore failure in-session
    }
  }, []);

  // Persist the in-progress match so a refresh, a backgrounded tab getting
  // reloaded, or closing the browser doesn't lose it. This deliberately does
  // NOT fire every second — only baseElapsedSec/runStartedAt change (on
  // Start/Pause/Reset/full-time), not the ticking display value — so saving
  // stays cheap and infrequent.
  useEffect(() => {
    if (!plan) return;
    (async () => {
      try {
        await window.storage.set(
          MATCH_STORAGE_KEY,
          JSON.stringify({ availableIds, gameSettings, plan, activeInterval, injuredThisGame, subLog, baseElapsedSec, runStartedAt, timerRunning }),
          false
        );
      } catch {
        // best-effort; ignore failure in-session
      }
    })();
  }, [availableIds, gameSettings, plan, activeInterval, injuredThisGame, subLog, baseElapsedSec, runStartedAt, timerRunning]);

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

  // while the timer is running, keep the pitch board following the live interval
  useEffect(() => {
    if (!timerRunning || !plan) return;
    setActiveInterval(intervalAtElapsed(plan, elapsedSec));
  }, [elapsedSec, timerRunning, plan]);

  if (loading || !teamData) {
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Loading squad…</div>
      </div>
    );
  }

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const newId = uid();
    const roster = [...teamData.roster, { id: newId, name, keeperEligible: true }];
    saveTeamData({ ...teamData, roster });
    setAvailableIds((prev) => [...prev, newId]); // new players default to available
    setNewPlayerName("");
  };

  const removePlayer = (id) => {
    const roster = teamData.roster.filter((p) => p.id !== id);
    saveTeamData({ ...teamData, roster });
    setAvailableIds((prev) => prev.filter((x) => x !== id));
  };

  const toggleAvailable = (id) => {
    setAvailableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleKeeperEligible = (id) => {
    const roster = teamData.roster.map((p) => (p.id === id ? { ...p, keeperEligible: !p.keeperEligible } : p));
    saveTeamData({ ...teamData, roster });
  };

  const keeperEligibleIds = teamData.roster.filter((p) => p.keeperEligible).map((p) => p.id);

  const startPlanning = () => {
    if (availableIds.length < 2) return;
    const settings = { ...gameSettings };
    saveTeamData({ ...teamData, settings });
    const { numIntervals } = computeIntervals(settings.gameMinutes, settings.subIntervalMinutes);
    const { intervals } = generatePlan({
      availableIds,
      gameMinutes: settings.gameMinutes,
      numIntervals,
      fieldSize: settings.fieldSize,
      keeperEligibleIds,
    });
    setPlan(intervals);
    setActiveInterval(0);
    setInjuredThisGame([]);
    setElapsedSec(0);
    setBaseElapsedSec(0);
    setRunStartedAt(null);
    setTimerRunning(false);
    setSubLog({});
    setSwapPickId(null);
    setShowSettingsModal(false);
  };

  // rebuild the remainder of the plan from the current interval onward using
  // a given set of injured (sidelined) player ids
  const rebuildFromInterval = (newInjuredList) => {
    const remainingAvailable = availableIds.filter((id) => !newInjuredList.includes(id));
    const priorIntervals = plan.slice(0, activeInterval);
    const carryState = buildCarryState(availableIds, priorIntervals);

    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval,
      carryState,
    });

    setPlan([...priorIntervals, ...rebuiltRemainder]);
    setInjuredThisGame(newInjuredList);
  };

  const handleInjury = (playerId) => {
    if (injuredThisGame.includes(playerId)) return;
    rebuildFromInterval([...injuredThisGame, playerId]);
  };

  // A returning player joins the bench for whatever's left of the current
  // interval (nobody currently on the pitch gets bumped for them), and their
  // consecutive-bench streak resets to zero so they go to the back of the
  // queue rather than jumping it on the strength of their injury time.
  const bringBack = (playerId) => {
    if (!injuredThisGame.includes(playerId)) return;
    const newInjuredList = injuredThisGame.filter((id) => id !== playerId);

    const priorIntervals = plan.slice(0, activeInterval);
    const frozenCurrent = { ...plan[activeInterval], bench: [...plan[activeInterval].bench, playerId] };
    const doneIntervals = [...priorIntervals, frozenCurrent];

    const carryState = buildCarryState(availableIds, doneIntervals);
    if (carryState[playerId]) carryState[playerId].consecBench = 0; // back of the queue, not front

    const remainingAvailable = availableIds.filter((id) => !newInjuredList.includes(id));
    const { numIntervals } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
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
    const { intervals: rebuiltRemainder } = generatePlan({
      availableIds: remainingAvailable,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      startInterval: activeInterval + 1,
      carryState,
    });

    setPlan([...priorIntervals, frozenCurrent, ...rebuiltRemainder]);
    setSwapPickId(null);
  };

  const exportText = JSON.stringify({ roster: teamData.roster, settings: teamData.settings }, null, 2);

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("Copied!");
    } catch {
      setCopyStatus("Couldn't auto-copy — tap the text box and copy manually");
    }
    setTimeout(() => setCopyStatus(""), 2500);
  };

  const runImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || !Array.isArray(parsed.roster)) throw new Error("bad format");
      const normalizedRoster = parsed.roster.map((p) => ({ ...p, keeperEligible: p.keeperEligible !== false }));
      const normalizedSettings = { ...defaultTeamData().settings, ...(parsed.settings || {}) };
      saveTeamData({ roster: normalizedRoster, settings: normalizedSettings });
      setGameSettings(normalizedSettings);
      setAvailableIds(normalizedRoster.map((p) => p.id));
      setImportText("");
      setImportConfirming(false);
      setImportStatus("Squad restored.");
    } catch {
      setImportStatus("Couldn't read that — check you pasted the whole backup and try again.");
      setImportConfirming(false);
    }
    setTimeout(() => setImportStatus(""), 3000);
  };

  const nameOf = (id) => teamData.roster.find((p) => p.id === id)?.name || "?";

  // Shared props for SquadSettingsForm — used both for first-time setup
  // (inline) and later edits (modal), so this is built once and reused
  // rather than duplicated at each call site.
  const squadSettingsProps = {
    roster: teamData.roster,
    gameSettings,
    setGameSettings,
    availableIds,
    setAvailableIds,
    newPlayerName,
    setNewPlayerName,
    addPlayer,
    removePlayer,
    toggleAvailable,
    toggleKeeperEligible,
    showBackupPanel,
    setShowBackupPanel,
    exportText,
    handleCopyExport,
    copyStatus,
    importText,
    setImportText,
    importConfirming,
    setImportConfirming,
    importStatus,
    runImport,
    showRestartWarning: Boolean(plan && (elapsedSec > 0 || Object.keys(subLog).length > 0)),
  };

  return (
    <div style={styles.app}>
      <style>{fontStyle}</style>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoMark}>⚽</div>
          <div style={styles.headerTitle}>SUB TRACKER</div>
        </div>
      </header>

      <main style={styles.main}>
        {!plan && (
          <section>
            <h2 style={styles.sectionTitle}>Set up today's game</h2>
            <SquadSettingsForm {...squadSettingsProps} onSubmit={startPlanning} submitLabel="Generate Rotation" />
          </section>
        )}

        {plan && (
          <MatchView
            plan={plan}
            activeInterval={activeInterval}
            setActiveInterval={setActiveInterval}
            elapsedSec={elapsedSec}
            setElapsedSec={setElapsedSec}
            baseElapsedSec={baseElapsedSec}
            setBaseElapsedSec={setBaseElapsedSec}
            runStartedAt={runStartedAt}
            setRunStartedAt={setRunStartedAt}
            timerRunning={timerRunning}
            setTimerRunning={setTimerRunning}
            subLog={subLog}
            setSubLog={setSubLog}
            swapPickId={swapPickId}
            setSwapPickId={setSwapPickId}
            injuredThisGame={injuredThisGame}
            nameOf={nameOf}
            onInjury={handleInjury}
            onBringBack={bringBack}
            onSwap={performSwap}
            onShowSummary={() => setShowSummaryModal(true)}
            onShowSettings={() => setShowSettingsModal(true)}
          />
        )}
      </main>

      {showSettingsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit Game Settings</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowSettingsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <SquadSettingsForm {...squadSettingsProps} onSubmit={startPlanning} submitLabel="Save & Regenerate" />
          </div>
        </div>
      )}

      {showSummaryModal && plan && (
        <SummaryModal plan={plan} availableIds={availableIds} nameOf={nameOf} onClose={() => setShowSummaryModal(false)} />
      )}
    </div>
  );
}

