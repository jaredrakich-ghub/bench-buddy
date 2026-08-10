import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Shuffle, ChevronRight, ChevronLeft, RotateCcw, Play, Pause, Settings, X, BarChart2 } from "lucide-react";
import { intervalAtElapsed, computeIntervals, buildCarryState, generatePlan, computeMinutesSummary } from "../lib/rotation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";

const STORAGE_KEY = "team-data-v2";
// Separate key from the roster/settings above: this is the *in-progress
// match* (plan, clock, injuries, subs so far) — see the Phase 3 note above
// the load effect for why it's kept apart.
const MATCH_STORAGE_KEY = "match-state-v1";

const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtClock = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// Simple running-player pictogram — reads as an active footballer rather
// than a generic person icon.
const FootballerIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="14.5" cy="4.2" r="2.1" />
    <path d="M12.8 7.3c-.5-.2-1-.1-1.4.3l-2.6 2.6-3.4.6a1 1 0 00.3 2l3.9-.7c.3-.1.6-.2.8-.4l1.7-1.7.6 2-3 2.3-1.6 5.1a1 1 0 001.9.6l1.5-4.7 2.1-1.6 1 2.9-1.6 4.1a1 1 0 001.9.7l1.8-4.7a1.6 1.6 0 00-.1-1.3l-1.3-2.7 1.1-3.4 2.6 1.2a1 1 0 10.9-1.8l-3.3-1.6a1.3 1.3 0 00-1.6.4l-1.2 1.7-1.9-.6z" />
  </svg>
);

// Lay out the on-field players into a formation (GK + two rows), e.g. 1-2-2
// for a 5-a-side team. Splits outfielders evenly across a back and front row.
function getFormationLayout(onField) {
  const gk = onField.find((p) => p.isGk);
  const outfielders = onField.filter((p) => !p.isGk);
  const backCount = Math.ceil(outfielders.length / 2);
  const back = outfielders.slice(0, backCount);
  const front = outfielders.slice(backCount);

  const spread = (row, topPct) =>
    row.map((p, i) => ({ ...p, topPct, leftPct: ((i + 1) / (row.length + 1)) * 100 }));

  return [...(gk ? [{ ...gk, topPct: 88, leftPct: 50 }] : []), ...spread(back, 62), ...spread(front, 30)];
}

const defaultTeamData = () => ({
  roster: [],
  settings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, mode: "combined" },
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
      mode: settings.mode,
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
      mode: gameSettings.mode,
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
      mode: gameSettings.mode,
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
      mode: gameSettings.mode,
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

  // Shared form for both first-time setup (inline) and later edits (modal).
  // This also doubles as squad management — add, remove, mark available,
  // and mark keeper-eligible, all in one place.
  const renderSettingsForm = (onSubmit, submitLabel) => (
    <>
      <div style={styles.settingsGrid}>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Players on field</span>
          <input
            type="number"
            min={2}
            style={styles.numInput}
            value={gameSettings.fieldSize}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, fieldSize: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, fieldSize: 5 });
            }}
          />
        </label>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Game length (min)</span>
          <input
            type="number"
            min={5}
            style={styles.numInput}
            value={gameSettings.gameMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, gameMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, gameMinutes: 40 });
            }}
          />
        </label>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Sub every (min)</span>
          <input
            type="number"
            min={2}
            step={0.5}
            style={styles.numInput}
            value={gameSettings.subIntervalMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, subIntervalMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, subIntervalMinutes: 6 });
            }}
          />
        </label>
      </div>
      <div style={styles.intervalPreview}>
        {(() => {
          const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
          return `≈ ${intervalLen.toFixed(1)} min per interval · ${numIntervals} sub windows this game`;
        })()}
      </div>

      <div style={styles.modeBlock}>
        <span style={styles.settingLabelText}>Rotation mode</span>
        <div style={styles.modeToggleRow}>
          <button
            style={{ ...styles.modeBtn, ...(gameSettings.mode !== "split" ? styles.modeBtnActive : {}) }}
            onClick={() => setGameSettings({ ...gameSettings, mode: "combined" })}
          >
            Combined
          </button>
          <button
            style={{ ...styles.modeBtn, ...(gameSettings.mode === "split" ? styles.modeBtnActive : {}) }}
            onClick={() => setGameSettings({ ...gameSettings, mode: "split" })}
          >
            Split: Outfield + Keepers
          </button>
        </div>
        <div style={styles.modeHint}>
          {gameSettings.mode === "split"
            ? "Keeper duty rotates only among players marked 🧤 below, separately from outfield rotation."
            : "Anyone on the field can be picked for a turn in goal."}
        </div>
      </div>

      <div style={styles.subTitleRow}>
        <h3 style={styles.subTitle}>Squad &amp; availability</h3>
        <span style={styles.countBadge}>{availableIds.length} available</span>
        {teamData.roster.length > 0 && (
          <button
            style={styles.selectAllBtn}
            onClick={() =>
              setAvailableIds(availableIds.length === teamData.roster.length ? [] : teamData.roster.map((p) => p.id))
            }
          >
            {availableIds.length === teamData.roster.length ? "Clear all" : "Select all"}
          </button>
        )}
      </div>

      <div style={styles.addRow}>
        <input
          style={styles.input}
          placeholder="Add player name"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
        />
        <button style={styles.primaryBtn} onClick={addPlayer}>
          <Plus size={16} /> Add
        </button>
      </div>

      <div style={styles.squadList}>
        {teamData.roster.length === 0 && <div style={styles.emptyState}>No players yet. Add your squad above.</div>}
        {teamData.roster.map((p) => {
          const availIdx = availableIds.indexOf(p.id);
          const isAvailable = availIdx !== -1;
          return (
            <div key={p.id} style={styles.squadRow}>
              <button
                style={{ ...styles.numberBadge, ...(isAvailable ? styles.numberBadgeActive : {}) }}
                onClick={() => toggleAvailable(p.id)}
                title="Toggle available today"
              >
                {isAvailable ? availIdx + 1 : ""}
              </button>
              <span style={styles.squadName}>{p.name}</span>
              <button
                style={{ ...styles.gloveToggle, ...(p.keeperEligible ? styles.gloveToggleActive : {}) }}
                onClick={() => toggleKeeperEligible(p.id)}
                title="Toggle keeper-eligible"
              >
                🧤
              </button>
              <button style={styles.iconBtn} onClick={() => removePlayer(p.id)} title="Remove from squad">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <button style={styles.backupToggle} onClick={() => setShowBackupPanel((v) => !v)}>
        {showBackupPanel ? "Hide" : "Backup & restore squad"}
      </button>

      {showBackupPanel && (
        <div style={styles.backupPanel}>
          <div style={styles.backupSubTitle}>Export</div>
          <p style={styles.backupHint}>Copy this text somewhere safe (notes app, email to yourself) to restore your squad later.</p>
          <textarea
            style={styles.backupTextarea}
            readOnly
            value={exportText}
            onClick={(e) => e.target.select()}
          />
          <button style={styles.backupBtn} onClick={handleCopyExport}>
            Copy backup text
          </button>
          {copyStatus && <div style={styles.backupStatus}>{copyStatus}</div>}

          <div style={{ ...styles.backupSubTitle, marginTop: 18 }}>Import</div>
          <p style={styles.backupHint}>Paste a previously copied backup below to restore it. This replaces your current squad.</p>
          <textarea
            style={styles.backupTextarea}
            placeholder="Paste backup text here"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportConfirming(false);
            }}
          />
          {!importConfirming ? (
            <button style={styles.backupBtn} disabled={!importText.trim()} onClick={() => setImportConfirming(true)}>
              Restore from backup
            </button>
          ) : (
            <div style={styles.backupConfirmRow}>
              <span style={styles.backupHint}>This replaces your current squad — are you sure?</span>
              <button style={styles.backupConfirmBtn} onClick={runImport}>
                Yes, replace it
              </button>
              <button style={styles.backupCancelBtn} onClick={() => setImportConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
          {importStatus && <div style={styles.backupStatus}>{importStatus}</div>}
        </div>
      )}

      {plan && (elapsedSec > 0 || Object.keys(subLog).length > 0) && (
        <div style={styles.modalWarning}>This will restart the rotation from 0:00 and clear this game's progress so far.</div>
      )}

      <button
        style={{ ...styles.primaryBtn, marginTop: 20, opacity: availableIds.length < 2 ? 0.5 : 1 }}
        disabled={availableIds.length < 2}
        onClick={onSubmit}
      >
        <Shuffle size={16} /> {submitLabel}
      </button>
    </>
  );

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
            {renderSettingsForm(startPlanning, "Generate Rotation")}
          </section>
        )}

        {plan && (
          <section>
            <div style={styles.subTrackerHeaderRow}>
              <h2 style={styles.sectionTitle}>Sub Tracker</h2>
              <div style={styles.headerBtnGroup}>
                <button style={styles.editSettingsBtn} onClick={() => setShowSummaryModal(true)} title="View minutes summary">
                  <BarChart2 size={14} /> Summary
                </button>
                <button style={styles.editSettingsBtn} onClick={() => setShowSettingsModal(true)} title="Edit game settings">
                  <Settings size={14} /> Edit
                </button>
              </div>
            </div>

            {(() => {
              const totalGameSec = plan[plan.length - 1].endMin * 60;
              const isMatchComplete = elapsedSec >= totalGameSec;
              const cur = plan[intervalAtElapsed(plan, elapsedSec)];
              const secLeftInInterval = cur.endMin * 60 - elapsedSec;
              const nextIv = plan[cur.index + 1];
              const curGk = cur.onField.find((p) => p.isGk);
              const nextGk = nextIv?.onField.find((p) => p.isGk);
              const gkChanging = nextGk && (!curGk || curGk.id !== nextGk.id);
              const noBenchToRotate = cur.bench.length === 0;
              const inWarningWindow = nextIv && secLeftInInterval <= 60 && (!noBenchToRotate || gkChanging);
              const confirmedAt = subLog[cur.index];

              // Start resumes from wherever the clock is frozen; Pause freezes
              // it at the correct live value (computed from the timestamp
              // anchor, not just whatever the display last happened to show).
              const toggleTimer = () => {
                if (timerRunning) {
                  const live = computeLiveElapsedSec(baseElapsedSec, runStartedAt, totalGameSec);
                  setBaseElapsedSec(live);
                  setElapsedSec(live);
                  setRunStartedAt(null);
                  setTimerRunning(false);
                } else {
                  setRunStartedAt(Date.now());
                  setTimerRunning(true);
                }
              };

              return (
                <>
                  <div style={styles.timerBar}>
                    <div style={styles.clockBlock}>
                      <div style={styles.clockDisplay}>{fmtClock(elapsedSec)}</div>
                      <div style={styles.clockSub}>of {fmtClock(totalGameSec)}</div>
                    </div>
                    {isMatchComplete ? (
                      <button style={{ ...styles.timerBtn, ...styles.timerBtnDone }} disabled title="Match complete — reset the clock to keep tracking (e.g. extra time)">
                        Full Time
                      </button>
                    ) : (
                      <button
                        style={{ ...styles.timerBtn, ...(timerRunning ? styles.timerBtnPause : styles.timerBtnPlay) }}
                        onClick={toggleTimer}
                      >
                        {timerRunning ? <Pause size={18} /> : <Play size={18} />}
                        {timerRunning ? "Pause" : "Start"}
                      </button>
                    )}
                    <button
                      style={styles.iconBtn}
                      title="Reset clock"
                      onClick={() => {
                        setTimerRunning(false);
                        setRunStartedAt(null);
                        setBaseElapsedSec(0);
                        setElapsedSec(0);
                        setSubLog({});
                      }}
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>

                  <div style={styles.intervalCountdown}>
                    Sub window ends in <strong>{fmtClock(Math.max(0, secLeftInInterval))}</strong>
                    {nextIv && confirmedAt === undefined && !inWarningWindow && (
                      <button
                        style={styles.confirmBtnInline}
                        onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
                      >
                        ✓ Sub made early
                      </button>
                    )}
                  </div>

                  {inWarningWindow && confirmedAt === undefined && (
                    <div style={styles.gkWarmup}>
                      <div style={styles.warmupText}>
                        <div>
                          {secLeftInInterval > 0
                            ? noBenchToRotate
                              ? `Keeper swap coming up — window closes in ${fmtClock(secLeftInInterval)}`
                              : `Start looking for the next sub — window closes in ${fmtClock(secLeftInInterval)}`
                            : "Sub window is up — make the change now"}
                        </div>
                        {gkChanging && (
                          <div>
                            <span style={{ marginRight: 4 }}>🧤</span>
                            Send <strong>{nameOf(nextGk.id)}</strong> down to warm up in goal
                          </div>
                        )}
                      </div>
                      <button style={styles.confirmBtn} onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}>
                        ✓ Sub made
                      </button>
                    </div>
                  )}
                  {confirmedAt !== undefined && nextIv && (
                    <div style={styles.confirmedNote}>✓ Sub confirmed at {fmtClock(confirmedAt)}</div>
                  )}
                </>
              );
            })()}

            <div style={styles.intervalTabs}>
              {plan.map((iv) => (
                <button
                  key={iv.index}
                  onClick={() => setActiveInterval(iv.index)}
                  style={{ ...styles.intervalTab, ...(activeInterval === iv.index ? styles.intervalTabActive : {}) }}
                >
                  {iv.startMin}–{iv.endMin}′
                </button>
              ))}
            </div>

            <div style={styles.pitchBoard}>
              {swapPickId && (
                <div style={styles.swapBanner}>
                  Tap a player on the pitch to bring on <strong>{nameOf(swapPickId)}</strong>
                  <button style={styles.swapCancelBtn} onClick={() => setSwapPickId(null)}>
                    Cancel
                  </button>
                </div>
              )}
              <div style={styles.pitchInner}>
                <div style={styles.pitchCenterCircle} />
                <div style={styles.pitchHalfwayLine} />
                <div style={styles.pitchGoalBox} />
                {getFormationLayout(plan[activeInterval].onField).map(({ id, isGk, topPct, leftPct }) => (
                  <div key={id} style={{ ...styles.formationToken, top: `${topPct}%`, left: `${leftPct}%` }}>
                    <div style={styles.tokenWithAction}>
                      <button
                        style={{
                          ...styles.token,
                          ...(isGk ? styles.tokenGk : styles.tokenField),
                          ...(swapPickId ? styles.tokenSwapTarget : {}),
                        }}
                        onClick={() => swapPickId && performSwap(swapPickId, id)}
                        disabled={!swapPickId}
                      >
                        {isGk ? <span style={styles.gloveIcon}>🧤</span> : <FootballerIcon size={17} />}
                      </button>
                      {!injuredThisGame.includes(id) && !swapPickId && (
                        <button style={styles.injuryBtnSide} onClick={() => handleInjury(id)} title="Mark injured / off">
                          🤕
                        </button>
                      )}
                    </div>
                    <span style={styles.tokenName}>{nameOf(id)}</span>
                  </div>
                ))}
              </div>
              <div style={styles.benchInjuredRow}>
                <div style={styles.benchCol}>
                  <div style={styles.pitchLabel}>BENCH</div>
                  <div style={styles.tokenRow}>
                    {plan[activeInterval].bench.length === 0 && <span style={styles.noneText}>Full squad on field</span>}
                    {plan[activeInterval].bench.map((id) => (
                      <div key={id} style={styles.tokenCol}>
                        <div style={{ ...styles.token, ...styles.tokenBench }}>
                          <FootballerIcon size={17} />
                        </div>
                        <span style={styles.tokenName}>{nameOf(id)}</span>
                        <button
                          style={{ ...styles.swapBtn, ...(swapPickId === id ? styles.swapBtnActive : {}) }}
                          onClick={() => setSwapPickId(swapPickId === id ? null : id)}
                        >
                          {swapPickId === id ? "Cancel" : "Swap in"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {injuredThisGame.length > 0 && (
                  <div style={styles.injuredCol}>
                    <div style={styles.pitchLabel}>INJURED</div>
                    <div style={styles.tokenRow}>
                      {injuredThisGame.map((id) => (
                        <div key={id} style={styles.tokenCol}>
                          <div style={{ ...styles.token, ...styles.tokenInjured }}>🤕</div>
                          <span style={styles.tokenName}>{nameOf(id)}</span>
                          <button style={styles.backInBtn} onClick={() => bringBack(id)}>
                            Back in
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.planNav}>
              <button
                style={styles.iconBtn}
                disabled={activeInterval === 0}
                onClick={() => setActiveInterval((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={styles.planNavLabel}>
                Interval {activeInterval + 1} of {plan.length}
              </span>
              <button
                style={styles.iconBtn}
                disabled={activeInterval === plan.length - 1}
                onClick={() => setActiveInterval((i) => Math.min(plan.length - 1, i + 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
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
            {renderSettingsForm(startPlanning, "Save & Regenerate")}
          </div>
        </div>
      )}

      {showSummaryModal && plan && (
        <div style={styles.modalOverlay} onClick={() => setShowSummaryModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Minutes Summary</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowSummaryModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={styles.backupHint}>
              Based on the full {plan[plan.length - 1].endMin}-minute rotation as planned — this updates the moment you
              regenerate or edit the game.
            </p>
            {(() => {
              const summary = computeMinutesSummary(plan, availableIds);
              const anyInjured = summary.some((r) => r.injuredMin > 0);
              return (
                <div style={styles.summaryTable}>
                  <div style={{ ...styles.summaryRow, ...styles.summaryHeadRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
                    <span style={styles.summaryName}>Player</span>
                    <span>Outfield</span>
                    <span>Keeper</span>
                    <span>Bench</span>
                    {anyInjured && <span>Injured</span>}
                  </div>
                  {summary
                    .slice()
                    .sort((a, b) => b.outfieldMin + b.gkMin - (a.outfieldMin + a.gkMin))
                    .map((r) => (
                      <div key={r.id} style={{ ...styles.summaryRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
                        <span style={styles.summaryName}>{nameOf(r.id)}</span>
                        <span>{Math.round(r.outfieldMin)}</span>
                        <span>{Math.round(r.gkMin)}</span>
                        <span>{Math.round(r.benchMin)}</span>
                        {anyInjured && <span>{r.injuredMin > 0 ? Math.round(r.injuredMin) : "—"}</span>}
                      </div>
                    ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

const fontStyle = `
  * { box-sizing: border-box; }
`;

const colors = {
  grass: "#1F4D36",
  grassLight: "#2A6146",
  pitchDark: "#173A28",
  chalk: "#F4F7F2",
  ink: "#0F241A",
  gk: "#E0A526",
  field: "#3E8E68",
  bench: "#8A9A93",
  danger: "#C1502E",
  cardBg: "#FFFFFF",
  border: "#DDE4E0",
};

const styles = {
  app: { fontFamily: "system-ui, -apple-system, sans-serif", background: colors.chalk, minHeight: 500, color: colors.ink },
  loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: 300, background: colors.chalk },
  loadingText: { color: colors.grass, fontWeight: 700 },
  header: { background: colors.grass, padding: "10px 16px" },
  headerInner: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: { fontSize: 20 },
  headerTitle: { color: colors.chalk, fontWeight: 900, letterSpacing: 2, fontSize: 16, textTransform: "uppercase" },
  main: { padding: "12px 16px", maxWidth: 640, margin: "0 auto" },
  sectionTitle: { fontSize: 17, fontWeight: 900, marginBottom: 8, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.5 },
  subTrackerHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  headerBtnGroup: { display: "flex", gap: 6 },
  editSettingsBtn: {
    display: "flex", alignItems: "center", gap: 5, background: "transparent", color: colors.grass,
    border: "1px solid " + colors.border, borderRadius: 8, padding: "5px 10px", fontWeight: 700, fontSize: 12,
    cursor: "pointer", marginBottom: 8,
  },
  addRow: { display: "flex", gap: 8, marginBottom: 12 },
  input: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid " + colors.border, fontSize: 14 },
  numInput: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + colors.border, fontSize: 14 },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: 6, justifyContent: "center", padding: "10px 16px", borderRadius: 10,
    border: "none", background: colors.grass, color: colors.chalk, fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  iconBtn: { border: "none", background: colors.border, borderRadius: 8, padding: 8, cursor: "pointer", color: colors.ink, display: "flex" },
  emptyState: { color: "#7C8983", fontSize: 14, padding: "16px 0" },

  settingsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "start" },
  settingLabel: { display: "flex", flexDirection: "column", fontSize: 12, fontWeight: 700, color: "#5B6B64", textTransform: "uppercase", letterSpacing: 0.3 },
  settingLabelText: { minHeight: 28, display: "flex", alignItems: "flex-end", marginBottom: 4, lineHeight: 1.2 },
  intervalPreview: { fontSize: 12, color: colors.field, fontWeight: 700, marginTop: 8 },

  modeBlock: { marginTop: 20 },
  modeToggleRow: { display: "flex", gap: 8, marginTop: 4 },
  modeBtn: {
    flex: 1, padding: "9px 10px", borderRadius: 10, border: "1px solid " + colors.border, background: colors.cardBg,
    fontSize: 12, fontWeight: 700, color: colors.ink, cursor: "pointer",
  },
  modeBtnActive: { background: colors.grass, color: colors.chalk, border: "1px solid " + colors.grass },
  modeHint: { fontSize: 11, color: "#7C8983", marginTop: 6, lineHeight: 1.4 },

  subTitle: { fontSize: 15, fontWeight: 700, color: colors.ink, margin: 0 },
  subTitleRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 24, marginBottom: 10, flexWrap: "wrap" },
  countBadge: { fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE", padding: "2px 8px", borderRadius: 999 },
  selectAllBtn: {
    background: "transparent", color: colors.field, border: "1px solid " + colors.field, borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 11, cursor: "pointer", marginLeft: "auto",
  },

  squadList: { display: "flex", flexDirection: "column", gap: 6 },
  squadRow: {
    display: "flex", alignItems: "center", gap: 10, background: colors.cardBg,
    border: "1px solid " + colors.border, borderRadius: 10, padding: "8px 10px",
  },
  squadName: { flex: 1, fontWeight: 600, fontSize: 14 },
  numberBadge: {
    width: 26, height: 26, borderRadius: "50%", border: "1.5px solid " + colors.border, background: "transparent",
    color: "#9AA6A0", fontWeight: 800, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  numberBadgeActive: { background: colors.field, borderColor: colors.field, color: "#fff" },
  gloveToggle: {
    width: 30, height: 30, borderRadius: 8, border: "1px solid " + colors.border, background: "transparent",
    fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35, flexShrink: 0,
  },
  gloveToggleActive: { opacity: 1, background: "#FFF6E4", borderColor: colors.gk },

  timerBar: {
    display: "flex", alignItems: "center", gap: 10, background: colors.ink, borderRadius: 12, padding: "10px 14px", marginBottom: 2,
  },
  clockBlock: { display: "flex", flexDirection: "column", flex: 1 },
  clockDisplay: { fontSize: 28, fontWeight: 900, color: colors.chalk, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  clockSub: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 2 },
  timerBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none",
    fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  timerBtnPlay: { background: colors.field, color: "#fff" },
  timerBtnPause: { background: colors.gk, color: "#fff" },
  timerBtnDone: { background: colors.border, color: colors.bench, cursor: "default" },
  intervalCountdown: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    textAlign: "center", fontSize: 12, color: "#5B6B64", fontWeight: 600, margin: "6px 0",
  },
  confirmBtnInline: {
    background: colors.field, color: "#fff", border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer",
  },
  gkWarmup: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: colors.gk, color: "#fff",
    fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 8,
  },
  warmupText: { display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.3 },
  confirmBtn: {
    flex: "0 0 auto", background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "7px 11px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  confirmedNote: {
    textAlign: "center", fontSize: 11, fontWeight: 700, color: colors.field, background: "#E9F5EE",
    padding: "6px 10px", borderRadius: 8, marginBottom: 8,
  },
  intervalTabs: { display: "flex", gap: 6, overflowX: "auto", marginBottom: 8, paddingBottom: 2 },
  intervalTab: {
    flex: "0 0 auto", padding: "6px 10px", borderRadius: 8, border: "1px solid " + colors.border,
    background: colors.cardBg, fontSize: 12, fontWeight: 700, cursor: "pointer", color: colors.ink,
  },
  intervalTabActive: { background: colors.grass, color: colors.chalk, border: "1px solid " + colors.grass },

  pitchBoard: { background: colors.pitchDark, borderRadius: 14, padding: 12 },
  pitchInner: { position: "relative", width: "100%", height: 220, marginBottom: 4 },
  pitchCenterCircle: {
    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
    width: 80, height: 80, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)",
  },
  pitchHalfwayLine: { position: "absolute", top: "40%", left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.2)" },
  pitchGoalBox: {
    position: "absolute", bottom: 0, left: "30%", right: "30%", height: 40,
    border: "2px solid rgba(255,255,255,0.25)", borderBottom: "none", borderRadius: "4px 4px 0 0",
  },
  formationToken: {
    position: "absolute", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 3, width: 76,
  },
  tokenWithAction: { display: "flex", alignItems: "center", gap: 4 },
  injuryBtnSide: {
    width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(193,80,46,0.9)",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer", padding: 0,
  },
  gloveIcon: { fontSize: 16, lineHeight: 1 },
  pitchLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: 800, letterSpacing: 1.2, marginBottom: 6, marginTop: 8 },
  tokenRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  tokenCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 62 },
  token: {
    width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.25)", border: "none", padding: 0, font: "inherit",
  },
  tokenSwapTarget: { cursor: "pointer", boxShadow: "0 0 0 3px rgba(255,255,255,0.85), 0 2px 6px rgba(0,0,0,0.25)" },
  tokenField: { background: colors.field },
  tokenGk: { background: colors.gk },
  tokenBench: { background: "transparent", border: "2px dashed rgba(255,255,255,0.5)", color: "rgba(255,255,255,0.8)" },
  tokenInjured: { background: "transparent", border: "2px dashed " + colors.danger, fontSize: 16 },
  tokenName: { color: "#fff", fontSize: 11, fontWeight: 700, textAlign: "center" },
  noneText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },

  benchInjuredRow: { display: "flex", gap: 14 },
  benchCol: { flex: 1, minWidth: 0 },
  injuredCol: { flex: 1, minWidth: 0, borderLeft: "1px dashed rgba(255,255,255,0.25)", paddingLeft: 12 },
  backInBtn: {
    marginTop: 2, background: colors.field, color: "#fff", border: "none", borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 10, cursor: "pointer",
  },
  swapBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: colors.field,
    color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 10,
  },
  swapCancelBtn: {
    background: "rgba(255,255,255,0.9)", color: colors.ink, border: "none", borderRadius: 8,
    padding: "5px 10px", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
  },
  swapBtn: {
    marginTop: 2, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 999,
    padding: "3px 9px", fontWeight: 700, fontSize: 10, cursor: "pointer",
  },
  swapBtnActive: { background: colors.danger, borderColor: colors.danger },

  planNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 16 },
  planNavLabel: { fontSize: 13, fontWeight: 700, color: "#5B6B64" },

  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(15,36,26,0.55)", display: "flex", alignItems: "center",
    justifyContent: "center", padding: 20, zIndex: 50,
  },
  modalCard: {
    background: colors.cardBg, borderRadius: 16, padding: 20, maxWidth: 480, width: "100%",
    maxHeight: "85vh", overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
  },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: 900, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.4 },
  modalCloseBtn: { background: colors.border, border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", color: colors.ink },
  backupToggle: {
    display: "block", marginTop: 20, background: "transparent", border: "none", color: colors.field,
    fontWeight: 700, fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline",
  },
  backupPanel: { marginTop: 10, background: "#F4F7F2", border: "1px solid " + colors.border, borderRadius: 10, padding: 12 },
  backupSubTitle: { fontSize: 12, fontWeight: 800, color: colors.grass, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  backupHint: { fontSize: 11, color: "#5B6B64", lineHeight: 1.4, margin: "0 0 6px 0" },
  backupTextarea: {
    width: "100%", minHeight: 70, fontSize: 11, fontFamily: "monospace", padding: 8, borderRadius: 8,
    border: "1px solid " + colors.border, resize: "vertical", marginBottom: 6, color: colors.ink, background: "#fff",
  },
  backupBtn: {
    background: colors.grass, color: colors.chalk, border: "none", borderRadius: 8, padding: "7px 12px",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  backupStatus: { marginTop: 6, fontSize: 11, fontWeight: 700, color: colors.field },
  backupConfirmRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 },
  backupConfirmBtn: {
    background: colors.danger, color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px",
    fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  backupCancelBtn: {
    background: "transparent", color: colors.ink, border: "1px solid " + colors.border, borderRadius: 8,
    padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer",
  },
  summaryTable: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  summaryRow: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "9px 10px", background: colors.cardBg,
    border: "1px solid " + colors.border, borderRadius: 8, fontSize: 13,
  },
  summaryRow5: { gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" },
  summaryHeadRow: { background: "transparent", border: "none", fontWeight: 800, color: "#5B6B64", fontSize: 10, textTransform: "uppercase" },
  summaryName: { fontWeight: 700 },
  modalWarning: {
    marginTop: 14, fontSize: 12, color: colors.danger, background: "#FBEAE4", padding: "8px 12px", borderRadius: 8, fontWeight: 600,
  },
};
