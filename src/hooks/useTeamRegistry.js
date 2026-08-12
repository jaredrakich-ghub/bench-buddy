import { useState, useCallback } from "react";
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

  // Updates the active team's data (roster/settings). Updates local state
  // immediately for a snappy UI (no waiting on a network round-trip to see
  // your own edit), and fires the real Firestore write in the background.
  const saveTeamData = useCallback((data) => {
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
