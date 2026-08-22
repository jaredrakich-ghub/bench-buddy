import React, { useState, useEffect, useCallback, useRef } from "react";
import { intervalAtElapsed } from "../lib/rotation.js";
import { computeLiveElapsedSec } from "../lib/clock.js";
import { generateId } from "../lib/id.js";
import { getSquadNumber } from "../lib/squadNumber.js";
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
import TeamAccountScreen from "./TeamAccountScreen.jsx";
import ManageSquadScreen from "./ManageSquadScreen.jsx";
import SquadChangeScreen from "./SquadChangeScreen.jsx";
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
    injuredThisGame, setInjuredThisGame, injuredAt, setInjuredAt, elapsedSec, setElapsedSec,
    baseElapsedSec, setBaseElapsedSec, runStartedAt, setRunStartedAt,
    timerRunning, setTimerRunning, subLog, setSubLog, swapPickId, setSwapPickId,
    startingGkId, setStartingGkId,
    keeperEligibleIds,
    startPlanning, handleInjury, bringBack, performSwap, addArrival, removeAvailability, resetClock,
  } = match;

  const [newPlayerName, setNewPlayerName] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showTeamSwitcher, setShowTeamSwitcher] = useState(false);
  const [showSquadChange, setShowSquadChange] = useState(false);
  // Team & account's own "Manage squad" row — a dedicated screen now
  // (ManageSquadScreen.jsx), not a pre-expanded section inside Game
  // settings. Real-use feedback: Game settings/new-team setup no longer
  // need this at all (Who's here already covers add/availability, the new
  // Keepers section already covers eligibility) — number/name/delete
  // moved here instead, reachable any time, not tied to a specific game.
  const [showManageSquad, setShowManageSquad] = useState(false);
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
    setShowSquadChange(false);
    setSwapPickId(null);
    setStartingGkId(null);

    if (resume) {
      const { saved, live, stillRunning } = resume;
      setAvailableIds(saved.availableIds || team.roster.map((p) => p.id));
      setGameSettings(saved.gameSettings || team.settings);
      setPlan(saved.plan);
      setInjuredThisGame(saved.injuredThisGame || []);
      setInjuredAt(saved.injuredAt || {});
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
      setInjuredAt({});
      setElapsedSec(0);
      setBaseElapsedSec(0);
      setRunStartedAt(null);
      setTimerRunning(false);
      setSubLog({});
    }
  }, [
    setActiveTeamId, setSwapPickId, setStartingGkId, setAvailableIds, setGameSettings, setPlan, setInjuredThisGame, setInjuredAt,
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

  // Squad-change's own "+ Player" (a brand-new roster entry, not an
  // existing player toggling back) — deliberately does NOT touch
  // availableIds the way addPlayer above does. This can fire mid-game,
  // where "available" has to mean "actually threaded into the plan from
  // now on", not just a flag — that's addArrival's job (useMatchState.js),
  // called right after this with the id this returns. addArrival bails
  // out early if the player is already in availableIds, so doing that here
  // too would make it a no-op and leave the new player showing as
  // available while never actually being placed in any interval.
  const addRosterPlayer = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newId = generateId();
    const roster = [...teamData.roster, { id: newId, name: trimmed, keeperEligible: true }];
    saveTeamData({ ...teamData, roster });
    return newId;
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

  // Bulk sibling to toggleKeeperEligible above — the new-team-setup
  // Keepers section's own "Select all" (real-use feedback: everyone's
  // already eligible by default, so this exists for restoring that after
  // turning some off, not for a from-scratch pick).
  const setAllKeeperEligible = (value) => {
    const roster = teamData.roster.map((p) => ({ ...p, keeperEligible: value }));
    saveTeamData({ ...teamData, roster });
  };

  // A real, coach-assignable squad number — added for the match-day
  // redesign (previously every shirt just showed roster position, see
  // getSquadNumber's own comment in squadNumber.js). `null` clears it back
  // to unset, same as any other optional field; getSquadNumber falls back
  // to roster position again once it's gone rather than showing nothing.
  const setPlayerNumber = (id, number) => {
    const roster = teamData.roster.map((p) => (p.id === id ? { ...p, number } : p));
    saveTeamData({ ...teamData, roster });
  };

  // Manage squad's own new name-edit capability (Team & account, real-use
  // feedback: "we may want to give the ability to edit existing kids
  // names"). Safe against every player already being keyed by `id`, not
  // name, everywhere minutes are tracked — aggregateSeasonSummary
  // (rotation.js) already rolls totals up by id and already prefers
  // whichever name a player's *most recent* archived game recorded, so a
  // rename here shows up as their current name going forward without
  // touching any past game's own snapshot of who they were called then.
  // Blank/whitespace-only guarded the same way SquadChangeScreen's own
  // add-player flow is — never silently commit an empty name.
  const renamePlayer = (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const roster = teamData.roster.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
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
  // Squad numbers are new (match-day redesign) — see getSquadNumber's own
  // comment in src/lib/squadNumber.js for the fallback this leans on until
  // SquadSettingsForm lets a coach actually assign one.
  const numberOf = (id) => getSquadNumber(teamData.roster.find((p) => p.id === id) || { id }, teamData.roster);

  const isMatchComplete = Boolean(plan) && elapsedSec >= plan[plan.length - 1].endMin * 60;

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
    toggleAvailable,
    toggleKeeperEligible,
    setAllKeeperEligible,
    numberOf,
    // Drives the edit layout's own "rebuild rotation" confirm sheet —
    // real-use feedback replaced a blanket restart-warning banner (shown
    // on *every* visit, even ones with nothing to lose) with this
    // targeted check. !isMatchComplete matters: a just-finished game's
    // own elapsedSec/subLog are still both truthy while "Set up next
    // game" is open, but that old game is *done*, not "in progress" —
    // nothing at risk, so no confirmation needed there either.
    gameInProgress: Boolean(plan && !isMatchComplete && (elapsedSec > 0 || Object.keys(subLog).length > 0)),
    elapsedSec,
    startingGkId,
    setStartingGkId,
  };

  return (
    <div style={styles.app}>
      <style>{fontStyle}</style>
      {/* No separate app-level header for the pre-match/setup screen
          anymore — SquadSettingsForm's own "inline" header now covers
          this job itself, context-aware for first-team-ever (crest +
          "Set up new team", no back target) vs. an additional team
          (the same back-chevron shell "Game settings" uses, returning to
          Team & account) — see its own `header` const for the full
          story. Real-use feedback: this used to be a genuinely separate
          header stacked above SquadSettingsForm's own, doing overlapping
          jobs ("a lot of the old UI appearing... we only get one chance
          to make a good first impression"). MatchView still supplies its
          own team-identity header (crest, name, cog menu) once a match
          is underway, unaffected by any of this. */}

      {saveError && <div style={styles.saveErrorBanner}>⚠️ {saveError}</div>}

      <main style={styles.main}>
        {!plan && (
          <section>
            <SquadSettingsForm
              {...squadSettingsProps}
              variant="inline"
              title="Set up new team"
              crestSrc={headerMascot}
              // Real-use feedback: this screen needed to know which
              // first-time-setup moment it is. teams.length > 1 means a
              // coach deliberately added an *additional* team (via Team &
              // account's own "+ Add a team" row) — a real "back" target
              // exists (that screen), so hand it a real onClose to
              // return there and get the same back-chevron header shape
              // "edit" (Game settings) already uses. A brand-new sign-in
              // bootstraps exactly one team automatically (see
              // migration/bootstrap above), so teams.length === 1 here
              // reliably means "this is that very first team, fresh off
              // sign-in" — nowhere to go back to, so no onClose at all.
              onClose={teams.length > 1 ? () => setShowTeamSwitcher(true) : undefined}
              onSubmit={handleGenerate}
              submitLabel="Build new rotation"
            />
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
            injuredAt={injuredAt}
            keeperEligibleIds={keeperEligibleIds}
            breakSegments={gameSettings.breakSegments || 1}
            nameOf={nameOf}
            numberOf={numberOf}
            teamName={teamData.name}
            crestSrc={headerMascot}
            availableCount={availableIds.length}
            gameSettingsSummary={`${gameSettings.fieldSize} a side · sub ${gameSettings.subIntervalMinutes}′`}
            onInjury={handleInjury}
            onBringBack={bringBack}
            onSwap={performSwap}
            onReset={resetClock}
            onShowSummary={() => setShowSummaryModal(true)}
            onShowSeason={() => setShowSeasonModal(true)}
            onShowSettings={() => setShowSettingsModal(true)}
            onShowSquadChange={() => setShowSquadChange(true)}
            onShowTeamSwitcher={() => setShowTeamSwitcher(true)}
          />
        )}
      </main>

      {showTeamSwitcher && (
        // README > A8-Team-account — full-screen takeover, not a floating
        // modal (see mdFullScreenTakeover* in styles.js for why it's split
        // into an outer/inner wrapper).
        //
        // Rendered FIRST among these six overlays, deliberately — its own
        // "Manage squad" row opens showManageSquad *without* closing this
        // screen underneath it (so its own back arrow returns here, not
        // straight to the match screen — a proper drill-down, not a screen
        // swap). All of these sibling overlays share the same fixed
        // z-index (mdFullScreenTakeoverOuter), so with equal z-index it's
        // DOM order that decides which one paints on top — this used to be
        // declared *last*, which meant it silently painted over
        // Season/Settings instead of the other way around, making
        // "Season data"/"Manage squad" look broken (the state flipped
        // correctly; nothing ever became visible). Keep this first if any
        // more rows like this are added. (Season data itself moved out of
        // here entirely — see the cog menu's own "Season Minutes" row,
        // MatchView.jsx.)
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <TeamAccountScreen
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
              onShowManageSquad={() => setShowManageSquad(true)}
              crestSrc={headerMascot}
            />
          </div>
        </div>
      )}

      {showSettingsModal && (
        // README > A4-Setup-collapsed/expanded — same full-screen takeover
        // pattern as every other secondary screen now (was the last
        // holdout still using the old centered modalOverlay/modalCard).
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <SquadSettingsForm
              {...squadSettingsProps}
              variant="edit"
              // "Game settings" — matches the cog menu's own row label that
              // opens this screen (real-use feedback: same expectation as
              // "Today's Minutes" and "Who's here", whose own headers
              // already match their menu rows). "Set up next game" stays
              // distinct for the
              // match-complete case — a genuinely different moment (a fresh
              // game, not editing today's), not reached via that same row.
              title={isMatchComplete ? "Set up next game" : "Game settings"}
              onClose={() => setShowSettingsModal(false)}
              onSubmit={handleGenerate}
              // Same label regardless of entry point — matches the confirm
              // sheet's own button text (SquadSettingsForm.jsx), so a coach
              // sees the phrase they tapped repeated back.
              submitLabel="Build new rotation"
            />
          </div>
        </div>
      )}

      {showManageSquad && (
        // Same full-screen takeover pattern as every sibling overlay here.
        // Reached only from Team & account's own "Manage squad" row now —
        // real-use feedback moved this out of Game settings/new-team setup
        // entirely (Who's here already covers add/availability, Keepers
        // already covers eligibility), so it's a standalone, durable-roster
        // screen rather than a pre-expanded section of a per-game form.
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <ManageSquadScreen
              roster={teamData.roster}
              numberOf={numberOf}
              setPlayerNumber={setPlayerNumber}
              renamePlayer={renamePlayer}
              removePlayer={removePlayer}
              onClose={() => setShowManageSquad(false)}
            />
          </div>
        </div>
      )}

      {showSummaryModal && plan && (
        // README > A5-Minutes — full-screen takeover, same wrapper pattern
        // as A8-Team-account (see mdFullScreenTakeover* in styles.js).
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <SummaryModal
              plan={plan}
              availableIds={availableIds}
              nameOf={nameOf}
              numberOf={numberOf}
              onClose={() => setShowSummaryModal(false)}
            />
          </div>
        </div>
      )}

      {showSeasonModal && (
        // README > A6-Season — same full-screen takeover pattern as
        // A8-Team-account and A5-Minutes.
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <SeasonSummaryModal
              teamId={activeTeamId}
              numberOf={numberOf}
              onClose={() => setShowSeasonModal(false)}
            />
          </div>
        </div>
      )}

      {showSquadChange && plan && (
        // README > A7-Squad-change — same full-screen takeover pattern as
        // every other non-match screen.
        <div style={styles.mdFullScreenTakeoverOuter}>
          <div style={styles.mdFullScreenTakeoverInner}>
            <SquadChangeScreen
              roster={teamData.roster}
              availableIds={availableIds}
              plan={plan}
              activeInterval={activeInterval}
              numberOf={numberOf}
              onAddArrival={addArrival}
              onRemoveAvailability={removeAvailability}
              onAddRosterPlayer={addRosterPlayer}
              onClose={() => setShowSquadChange(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
