import { useState, useEffect } from "react";
import { fetchTeamById } from "../lib/firestoreTeams.js";
import { useMatchState, fetchResumeData } from "../hooks/useMatchState.js";
import { getSquadNumber } from "../lib/squadNumber.js";
import { styles } from "./styles.js";
import MatchView from "./MatchView.jsx";
import SummaryModal from "./SummaryModal.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import headerMascot from "../assets/header-mascot.svg";

// Match Link, Step 5 — the parent's own match session (README 2c subs,
// 2d full game). This is deliberately the SAME <MatchView> the coach's own
// SubRotationPlanner renders (rule 2: "different controls live", never a
// second UI) — everything here is just getting that one component the data
// it needs when the caller isn't a team member, plus the two small props
// (parentMode/roleLine) that change what's live. See matchHandover.js's own
// comment on canControlClock for why subs vs. full only changes copy here,
// never capability: an active holder owns the clock and can make subs/mark
// injuries either way — level is display-only, by deliberate design.
//
// No squad editing, no season data, no team settings, no team switcher —
// there's simply no prop wiring any of those callbacks to, the same way
// the parent is excluded from teams/{teamId}'s write rule regardless of
// what this component does or doesn't render.
export default function ParentMatchSession({ teamId, level }) {
  const [team, setTeam] = useState(undefined); // undefined = loading, null = not found/no longer accessible
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // saveTeamData exists only for buildFreshPlanArgs' settings-persist call
  // (useMatchState.js), itself only reachable from startPlanning/
  // previewImprovedFairness — a coach building/rebuilding a rotation. This
  // session never calls either (no Game settings route to reach them from),
  // so this never actually runs; a plain no-op rather than wiring a real
  // team-registry write a parent must never make.
  const match = useMatchState({ activeTeamId: teamId, teamData: team, saveTeamData: () => {} });
  const { plan, availableIds, activeInterval } = match;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetchedTeam = await fetchTeamById(teamId);
      if (cancelled || !fetchedTeam) {
        if (!cancelled) setTeam(null);
        return;
      }
      // Same ordering requirement as SubRotationPlanner's own activateTeam
      // (see its comment, and applyMatchState's in useMatchState.js): the
      // resume fetch finishes fully before any state changes, then
      // setTeam + applyMatchState's own setters land together.
      const resume = await fetchResumeData(teamId);
      if (cancelled) return;
      setTeam(fetchedTeam);
      match.applyMatchState(fetchedTeam, resume);
    })();
    return () => {
      cancelled = true;
    };
    // teamId is this component's whole identity — it never changes under
    // an already-mounted ParentMatchSession (a fresh claim always means a
    // fresh page load), so this intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (team === undefined) {
    return <LoadingScreen message="Loading…" />;
  }
  if (team === null) {
    return (
      <div style={styles.mdClaimPage}>
        <div style={styles.mdClaimInner}>
          <div style={styles.mdClaimCrest}>
            <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
          </div>
          <div style={styles.mdClaimTitle}>Couldn't load the game</div>
          <div style={styles.mdClaimBody}>Check your connection and reopen the link.</div>
        </div>
      </div>
    );
  }

  const nameOf = (id) => team.roster.find((p) => p.id === id)?.name || "?";
  const numberOf = (id) => getSquadNumber(team.roster.find((p) => p.id === id) || { id }, team.roster);
  const roleLine = level === "full" ? "You're running the whole game today" : "You're on subs today";

  if (!plan) {
    // The coach hasn't built a rotation yet — nothing for MatchView to
    // show. Same crest/title/body shell every other MatchClaimPage-family
    // state uses (mdClaimPage/mdClaimInner), not a new visual language.
    return (
      <div style={styles.mdClaimPage}>
        <div style={styles.mdClaimInner}>
          <div style={styles.mdClaimCrest}>
            <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
          </div>
          <div style={styles.mdClaimTitle}>Not set up yet</div>
          <div style={styles.mdClaimBody}>The coach hasn't built today's rotation yet. Check back shortly.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MatchView
        plan={plan}
        activeInterval={activeInterval}
        setActiveInterval={match.setActiveInterval}
        elapsedSec={match.elapsedSec}
        setElapsedSec={match.setElapsedSec}
        baseElapsedSec={match.baseElapsedSec}
        setBaseElapsedSec={match.setBaseElapsedSec}
        runStartedAt={match.runStartedAt}
        setRunStartedAt={match.setRunStartedAt}
        timerRunning={match.timerRunning}
        setTimerRunning={match.setTimerRunning}
        subLog={match.subLog}
        swapPickId={match.swapPickId}
        setSwapPickId={match.setSwapPickId}
        injuredThisGame={match.injuredThisGame}
        injuredAt={match.injuredAt}
        keeperEligibleIds={match.keeperEligibleIds}
        availableIds={availableIds}
        breakSegments={match.gameSettings.breakSegments || 1}
        nameOf={nameOf}
        numberOf={numberOf}
        teamName={team.name}
        crestSrc={headerMascot}
        availableCount={availableIds.length}
        onInjury={match.handleInjury}
        onBringBack={match.bringBack}
        onSwap={match.performSwap}
        onReset={match.resetClock}
        onShowSummary={() => setShowSummaryModal(true)}
        parentMode
        roleLine={roleLine}
      />

      {showSummaryModal && (
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
    </>
  );
}
