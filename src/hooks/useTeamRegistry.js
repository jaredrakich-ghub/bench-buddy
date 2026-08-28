import { useState, useCallback, useRef } from "react";
import { findTeam, updateTeam } from "../lib/teams.js";
import { updateTeamDoc, describeSaveError } from "../lib/firestoreTeams.js";

// Owns the team registry itself: the loaded teams, which one is active, and
// the "loading" / "save failed" flags around it. Deliberately does NOT own
// switching/creating/deleting teams — those need to update match state
// (see useMatchState) in the same synchronous batch as activeTeamId, to
// avoid a stale-write race described on activateTeam in
// SubRotationPlanner.jsx — so those stay there, calling the raw setters
// this hook exposes (setTeams, setActiveTeamId, setLoading).
export function useTeamRegistry() {
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when a save to Firestore fails — surfaced as a persistent banner
  // rather than swallowed, so a coach isn't silently trusting saves that
  // aren't happening. Cleared the next time a save succeeds.
  const [saveError, setSaveError] = useState(null);

  // The active team's data, derived from the registry rather than its own
  // state — so there's a single source of truth once a team is updated.
  const teamData = findTeam(teams, activeTeamId);

  // Always-current mirror of teamData, updated the instant saveTeamData
  // runs rather than waiting for the next render. Real bug this fixes: a
  // caller building { ...teamData, roster: [...teamData.roster, x] } reads
  // teamData from its own render closure — if a second such call fires
  // before React re-renders (e.g. quick-add's paste handler followed
  // immediately by another add), the second call's stale roster snapshot
  // silently overwrote the first call's addition, while availableIds (set
  // via its own functional updater elsewhere) kept the "lost" player's id —
  // producing an unresolvable "?" bench/pitch slot once a rotation was
  // built. Passing an updater function to saveTeamData (below) instead of
  // a plain object lets a caller read this ref for the true latest roster,
  // the same way a functional setState avoids the equivalent race.
  const teamDataRef = useRef(teamData);
  teamDataRef.current = teamData;

  // Updates the active team's data (roster/settings). Updates local state
  // immediately for a snappy UI (no waiting on a network round-trip to see
  // your own edit), and fires the real Firestore write in the background.
  // Accepts either a plain object or an updater function `(prev) => data`
  // — the function form reads teamDataRef (see above), not a stale closure.
  const saveTeamData = useCallback((updater) => {
    const data = typeof updater === "function" ? updater(teamDataRef.current) : updater;
    teamDataRef.current = { ...teamDataRef.current, ...data };
    setTeams((prev) => updateTeam(prev, activeTeamId, data));
    updateTeamDoc(activeTeamId, data)
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(describeSaveError(err)));
  }, [activeTeamId]);

  const renameTeamById = (id, name) => {
    const newName = name.trim() || findTeam(teams, id)?.name;
    setTeams((prev) => updateTeam(prev, id, { name: newName }));
    updateTeamDoc(id, { name: newName })
      .then(() => setSaveError(null))
      .catch((err) => setSaveError(describeSaveError(err)));
  };

  return {
    teams, setTeams,
    activeTeamId, setActiveTeamId,
    teamData,
    loading, setLoading,
    saveError, setSaveError,
    saveTeamData,
    renameTeamById,
  };
}
