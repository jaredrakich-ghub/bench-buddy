import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, History } from "lucide-react";
import { intervalAtElapsed } from "../lib/rotation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { generateId } from "../lib/id.js";
import { normalizeTeam, migrateLegacyTeam, createTeam, findTeam, addTeam, removeTeam } from "../lib/teams.js";
import { fetchTeams, createTeamDoc, deleteTeamDoc, fetchMatchState, describeSaveError } from "../lib/firestoreTeams.js";
import { signOutUser, deleteAccount } from "../lib/auth.js";
import { useTeamRegistry } from "../hooks/useTeamRegistry.js";
import { useMatchState } from "../hooks/useMatchState.js";
import { fontStyle, styles } from "./styles.js";
import SummaryModal from "./SummaryModal.jsx";
import SeasonSummaryModal from "./SeasonSummaryModal.jsx";
import SquadSettingsForm from "./SquadSettingsForm.jsx";
import MatchView from "./MatchView.jsx";
import TeamSwitcher from "./TeamSwitcher.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import headerMascot from "../assets/header-mascot.jpg";

// Both of these are now read-only, used exactly once each: migrating an
// existing browser's local data into the signed-in user's Firestore account
// the first time they sign in (see the migration effect below). Nothing
// writes to either of these keys anymore — Firestore is the ongoing store.
const TEAMS_STORAGE_KEY = "teams-v1";
const LEGACY_TEAM_STORAGE_KEY = "team-data-v2";

export default function SubRotationPlanner({ user }) {
  // Team registry (which teams exist, which is active) and the currently
  // running match (plan, clock, injuries) are two separate hooks — see
  // useTeamRegistry.js and useMatchState.js. Switching teams needs both to
  // update together though (see activateTeam below), so that orchestration
  // deliberately stays here rather than inside either hook.
  const teamRegistry = useTeamRegistry();
  const { teams, setTeams, activeTeamId, setActiveTeamId, teamData, loading, setLoading, saveTeamData, renameTeamById } = teamRegistry;
  const match = useMatchState({ activeTeamId, teamData, saveTeamData });
  const {
    availableIds, setAvailableIds, gameSettings, setGameSettings, plan, setPlan,
    activeInterval, setActiveInterval, lastLiveIntervalRef,
    injuredThisGame, setInjuredThisGame, elapsedSec, setElapsedSec,
    baseElapsedSec, setBaseElapsedSec, runStartedAt, setRunStartedAt,
    timerRunning, setTimerRunning, subLog, setSubLog, swapPickId, setSwapPickId,
    startingGkId, setStartingGkId,
    keeperEligibleIds,
    startPlanning, handleInjury, bringBack, performSwap, performKeeperSwap,
  } = match;

  const [newPlayerName, setNewPlayerName] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);
  // Set when a save fails — either a team-registry save or a match-state
  // save — surfaced as a persistent banner rather than swallowed, so a
  // coach isn't silently trusting saves that aren't happening. Whichever
  // hook most recently failed wins; either succeeding clears its own half.
  const saveError = teamRegistry.saveError || match.saveError;

  // Makes `team` the active one and loads whatever match state belongs to
  // it (resuming an in-progress game, Phase 3 style, or starting fresh if
  // there isn't one) — shared between the initial page load and switching
  // teams via the switcher, so both stay in sync.
  //
  // The async storage read happens first, and every setState call happens
  // together afterward in one synchronous burst (React 18 batches these
  // into a single update, across both hooks' setters). This matters: if
  // activeTeamId changed before plan/gameSettings/etc. caught up, the
  // match-state-persist effect in useMatchState could fire in between and
  // write the *previous* team's game into the *new* team's storage slot.
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
    setShowSeasonModal(false);
    setSwapPickId(null);
    setStartingGkId(null);

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
      lastLiveIntervalRef.current = intervalAtElapsed(saved.plan, live);
      setActiveInterval(lastLiveIntervalRef.current);
    } else {
      setAvailableIds(team.roster.map((p) => p.id)); // default: everyone on the squad is assumed available
      setGameSettings(team.settings);
      setPlan(null);
      lastLiveIntervalRef.current = 0;
      setActiveInterval(0);
      setInjuredThisGame([]);
      setElapsedSec(0);
      setBaseElapsedSec(0);
      setRunStartedAt(null);
      setTimerRunning(false);
      setSubLog({});
    }
  }, [
    setActiveTeamId, setSwapPickId, setStartingGkId, setAvailableIds, setGameSettings, setPlan, setInjuredThisGame,
    setSubLog, setBaseElapsedSec, setElapsedSec, setRunStartedAt, setTimerRunning, setActiveInterval, lastLiveIntervalRef,
  ]);

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
  //
  // loadStartedForUser guards against this effect's async body running
  // twice concurrently for the same account — React StrictMode
  // deliberately double-invokes effects in development, and without this
  // guard both invocations would see "zero teams" and each create their
  // own bootstrap/migrated team, producing duplicates. A ref (not state)
  // on purpose: setting it needs to happen synchronously, before any
  // await, which a state update can't guarantee.
  const loadStartedForUser = useRef(null);
  useEffect(() => {
    if (!user || loadStartedForUser.current === user.uid) return;
    loadStartedForUser.current = user.uid;
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
  }, [user, activateTeam, setTeams, setLoading]);

  if (loading || !teamData) {
    return <LoadingScreen message="Loading squad…" />;
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
      teamRegistry.setSaveError(null);
    } catch (err) {
      teamRegistry.setSaveError(describeSaveError(err));
    }
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
      teamRegistry.setSaveError(null);
    } catch (err) {
      teamRegistry.setSaveError(describeSaveError(err));
    }
  };

  // Deletes every one of the signed-in user's teams (and everything under
  // them), then the Firebase Auth account itself. Team deletion happens
  // sequentially and is allowed to throw: if any one team fails to delete,
  // this stops there rather than going on to delete the account anyway —
  // deleting the account is the irreversible step, and it's safer to leave
  // the user with "an account, minus whatever teams did get removed" (still
  // recoverable) than to delete the account while some team data is
  // orphaned in Firestore with no signed-in owner left to remove it.
  const deleteMyAccount = async () => {
    for (const team of teams) {
      await deleteTeamDoc(team.id);
    }
    await deleteAccount();
    // No further state to update here on success — deleteAccount() firing
    // triggers onAuthChange(null) up in AuthGate, which swaps this whole
    // component out for the sign-in screen.
  };

  // startPlanning reports back whether it actually generated a plan (it
  // bails out on invalid settings) — only close the modal on success, same
  // as it always did back when this and the modal flag lived together.
  const handleGenerate = () => {
    if (startPlanning()) setShowSettingsModal(false);
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
    showRestartWarning: Boolean(plan && (elapsedSec > 0 || Object.keys(subLog).length > 0)),
    startingGkId,
    setStartingGkId,
  };

  const isMatchComplete = Boolean(plan) && elapsedSec >= plan[plan.length - 1].endMin * 60;

  return (
    <div style={styles.app}>
      <style>{fontStyle}</style>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLogoGroup}>
            <div style={styles.logoMark}>
              <img src={headerMascot} alt="" style={styles.logoMarkImg} />
            </div>
            <div style={styles.headerTitle}>BENCH BUDDY</div>
          </div>
          <div style={styles.headerBtnGroup}>
            <button style={styles.seasonBtn} onClick={() => setShowSeasonModal(true)} title="View season history">
              <History size={14} /> Season
            </button>
            <button style={styles.teamSwitcherTrigger} onClick={() => setShowTeamSwitcher(true)} title="Switch teams">
              {teamData.name} ▾
            </button>
          </div>
        </div>
      </header>

      {saveError && <div style={styles.saveErrorBanner}>⚠️ {saveError}</div>}

      <main style={styles.main}>
        {!plan && (
          <section>
            <h2 style={styles.sectionTitle}>Set up today's game</h2>
            <SquadSettingsForm {...squadSettingsProps} onSubmit={handleGenerate} submitLabel="Generate Rotation" />
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
            keeperEligibleIds={keeperEligibleIds}
            nameOf={nameOf}
            onInjury={handleInjury}
            onBringBack={bringBack}
            onSwap={performSwap}
            onSwapKeeper={performKeeperSwap}
            onShowSummary={() => setShowSummaryModal(true)}
            onShowSettings={() => setShowSettingsModal(true)}
          />
        )}
      </main>

      {showSettingsModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{isMatchComplete ? "Set Up New Game" : "Edit Game Settings"}</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowSettingsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <SquadSettingsForm
              {...squadSettingsProps}
              onSubmit={handleGenerate}
              submitLabel={isMatchComplete ? "Start Game" : "Save & Regenerate"}
            />
          </div>
        </div>
      )}

      {showSummaryModal && plan && (
        <SummaryModal plan={plan} availableIds={availableIds} nameOf={nameOf} onClose={() => setShowSummaryModal(false)} />
      )}

      {showSeasonModal && (
        <SeasonSummaryModal teamId={activeTeamId} onClose={() => setShowSeasonModal(false)} />
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
          onDeleteAccount={deleteMyAccount}
        />
      )}
    </div>
  );
}
