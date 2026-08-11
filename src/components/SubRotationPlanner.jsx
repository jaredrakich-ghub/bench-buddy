import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { intervalAtElapsed, computeIntervals, buildCarryState, generatePlan, keeperShiftIntervalsFor, lastGkId } from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { generateId } from "../lib/id.js";
import { defaultSettings, normalizeTeam, migrateLegacyTeam, createTeam, findTeam, addTeam, updateTeam, removeTeam } from "../lib/teams.js";
import { fetchTeams, createTeamDoc, updateTeamDoc, deleteTeamDoc, fetchMatchState, saveMatchState } from "../lib/firestoreTeams.js";
import { signOutUser } from "../lib/auth.js";
import { fontStyle, styles } from "./styles.js";
import SummaryModal from "./SummaryModal.jsx";
import SquadSettingsForm from "./SquadSettingsForm.jsx";
import MatchView from "./MatchView.jsx";
import TeamSwitcher from "./TeamSwitcher.jsx";

// Both of these are now read-only, used exactly once each: migrating an
// existing browser's local data into the signed-in user's Firestore account
// the first time they sign in (see the migration effect below). Nothing
// writes to either of these keys anymore — Firestore is the ongoing store.
const TEAMS_STORAGE_KEY = "teams-v1";
const LEGACY_TEAM_STORAGE_KEY = "team-data-v2";

// A save failing is rare, but worth explaining in plain terms rather than a
// raw error — the coach can't do anything about a stack trace, but "you're
// offline" or "you don't have access" is actionable.
const describeSaveError = (err) => {
  if (err?.code === "permission-denied") {
    return "You don't have access to save changes to this team.";
  }
  if (err?.code === "unavailable") {
    return "You're offline — changes will sync once you're back online.";
  }
  return "Changes aren't saving right now — don't close this tab until this is resolved.";
};

export default function SubRotationPlanner({ user }) {
  // The full team registry, and which one is currently active. `teamData`
  // (the active team's { id, name, roster, settings }) is derived from
  // these below rather than its own state — see the note right before it's
  // computed.
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [availableIds, setAvailableIds] = useState([]);
  const [gameSettings, setGameSettings] = useState(defaultSettings());
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
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);
  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [importText, setImportText] = useState("");
  const [importConfirming, setImportConfirming] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  // Set when a save to browser storage fails (e.g. storage full or
  // disabled) — surfaced as a persistent banner rather than swallowed, so a
  // coach isn't silently trusting saves that aren't happening. Cleared the
  // next time either save succeeds.
  const [saveError, setSaveError] = useState(null);

  // Makes `team` the active one and loads whatever match state belongs to
  // it (resuming an in-progress game, Phase 3 style, or starting fresh if
  // there isn't one) — shared between the initial page load and switching
  // teams via the switcher, so both stay in sync.
  //
  // The async storage read happens first, and every setState call happens
  // together afterward in one synchronous burst (React 18 batches these
  // into a single update). This matters: if activeTeamId changed before
  // plan/gameSettings/etc. caught up, the match-state-persist effect below
  // could fire in between and write the *previous* team's game into the
  // *new* team's storage slot.
  const activateTeam = useCallback(async (team) => {
    let resume = null;
    try {
      const saved = await fetchMatchState(team.id);
      if (saved?.plan?.length) {
        const capSec = saved.plan[saved.plan.length - 1].endMin * 60;
        const live = computeLiveElapsedSec(saved.baseElapsedSec, saved.timerRunning ? saved.runStartedAt : null, capSec);
        resume = { saved, live, stillRunning: saved.timerRunning && live < capSec };
      }
    } catch {
      // no in-progress match for this team — normal
    }

    setActiveTeamId(team.id);
    setShowSettingsModal(false);
    setShowSummaryModal(false);
    setSwapPickId(null);

    if (resume) {
      const { saved, live, stillRunning } = resume;
      setAvailableIds(saved.availableIds || team.roster.map((p) => p.id));
      setGameSettings(saved.gameSettings || team.settings);
      setPlan(saved.plan);
      setInjuredThisGame(saved.injuredThisGame || []);
      setSubLog(saved.subLog || {});
      setBaseElapsedSec(live);
      setElapsedSec(live);
      setRunStartedAt(stillRunning ? saved.runStartedAt : null);
      setTimerRunning(stillRunning);
      setActiveInterval(intervalAtElapsed(saved.plan, live));
    } else {
      setAvailableIds(team.roster.map((p) => p.id)); // default: everyone on the squad is assumed available
      setGameSettings(team.settings);
      setPlan(null);
      setActiveInterval(0);
      setInjuredThisGame([]);
      setElapsedSec(0);
      setBaseElapsedSec(0);
      setRunStartedAt(null);
      setTimerRunning(false);
      setSubLog({});
    }
  }, []);

  // Load this account's teams from Firestore. On a brand-new account (no
  // teams yet), migrate whatever's in this browser's local storage instead
  // of starting empty — that's the one-time bridge from the old
  // local-only version of the app into a real account.
  //
  // Known simplification: unlike the old local-storage version, "which team
  // was last active" isn't persisted anywhere server-side, so a reload
  // always lands on the first team Firestore returns rather than
  // remembering your last selection. Reasonable trade-off for now given
  // most accounts will have one or two teams; worth revisiting if that
  // turns out to matter in practice.
  useEffect(() => {
    if (!user) return;
    (async () => {
      let loadedTeams = await fetchTeams(user.uid);

      if (loadedTeams.length === 0) {
        let localTeams = [];
        // window.storage.get throws (rather than returning null) when a key
        // doesn't exist, so "no teams-v1 locally" and "corrupted teams-v1"
        // both land here — either way, fall back to the older single-team
        // format before giving up and bootstrapping a fresh empty team.
        try {
          const res = await window.storage.get(TEAMS_STORAGE_KEY, false);
          const parsed = JSON.parse(res.value);
          localTeams = (parsed.teams || []).map(normalizeTeam);
        } catch {
          try {
            const legacyRes = await window.storage.get(LEGACY_TEAM_STORAGE_KEY, false);
            localTeams = [migrateLegacyTeam(JSON.parse(legacyRes.value))];
          } catch {
            // nothing local to migrate — normal for a brand-new user
          }
        }
        if (localTeams.length === 0) {
          localTeams = [createTeam("My Team")];
        }
        loadedTeams = await Promise.all(localTeams.map((t) => createTeamDoc(user.uid, t)));
      }

      setTeams(loadedTeams);
      await activateTeam(loadedTeams[0]);
      setLoading(false);
    })();
  }, [user, activateTeam]);

  // Updates the active team's data (roster/settings). Updates local state
  // immediately for a snappy UI (no waiting on a network round-trip to see
  // your own edit), and fires the real Firestore write in the background.
  const saveTeamData = useCallback((data) => {
    setTeams((prev) => updateTeam(prev, activeTeamId, data));
    updateTeamDoc(activeTeamId, data)
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(describeSaveError(err)));
  }, [activeTeamId]);

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

  // while the timer is running, keep the pitch board following the live interval
  useEffect(() => {
    if (!timerRunning || !plan) return;
    setActiveInterval(intervalAtElapsed(plan, elapsedSec));
  }, [elapsedSec, timerRunning, plan]);

  // The active team's data, derived from the registry rather than its own
  // state — see saveTeamData above for why the registry is the single
  // source of truth.
  const teamData = findTeam(teams, activeTeamId);

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
    const newId = generateId();
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

  const switchTeam = (id) => {
    const team = findTeam(teams, id);
    if (team) activateTeam(team);
    setShowTeamSwitcher(false);
  };

  // Creates a new empty team and immediately switches to it — a coach
  // hitting "+ Add Team" is about to start setting up that team's squad.
  // Firestore assigns the real id, so this has to wait for the write to
  // come back before it can add the team locally or switch to it.
  const addNewTeam = async (name) => {
    setShowTeamSwitcher(false);
    try {
      const team = await createTeamDoc(user.uid, createTeam(name));
      setTeams((prev) => addTeam(prev, team));
      await activateTeam(team);
      setSaveError(null);
    } catch (err) {
      setSaveError(describeSaveError(err));
    }
  };

  const renameTeamById = (id, name) => {
    const newName = name.trim() || findTeam(teams, id)?.name;
    setTeams((prev) => updateTeam(prev, id, { name: newName }));
    updateTeamDoc(id, { name: newName })
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(describeSaveError(err)));
  };

  const deleteTeamById = async (id) => {
    const remaining = removeTeam(teams, id);
    if (remaining.length === 0) return; // TeamSwitcher already disables deleting the last team
    setTeams(remaining);
    if (id === activeTeamId) {
      await activateTeam(remaining[0]);
    }
    try {
      await deleteTeamDoc(id); // also removes that team's matchState subdocument
      setSaveError(null);
    } catch (err) {
      setSaveError(describeSaveError(err));
    }
  };

  const keeperEligibleIds = teamData.roster.filter((p) => p.keeperEligible).map((p) => p.id);

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
      const normalizedSettings = { ...defaultSettings(), ...(parsed.settings || {}) };
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
          <div style={styles.headerLogoGroup}>
            <div style={styles.logoMark}>⚽</div>
            <div style={styles.headerTitle}>BENCH BUDDY</div>
          </div>
          <button style={styles.teamSwitcherTrigger} onClick={() => setShowTeamSwitcher(true)} title="Switch teams">
            {teamData.name} ▾
          </button>
        </div>
      </header>

      {saveError && <div style={styles.saveErrorBanner}>⚠️ {saveError}</div>}

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

      {showTeamSwitcher && (
        <TeamSwitcher
          teams={teams}
          activeTeamId={activeTeamId}
          onSwitch={switchTeam}
          onAdd={addNewTeam}
          onRename={renameTeamById}
          onDelete={deleteTeamById}
          onClose={() => setShowTeamSwitcher(false)}
          userEmail={user.email}
          onSignOut={signOutUser}
        />
      )}
    </div>
  );
}

