// Firestore-backed replacement for the old localStorage team/match-state
// persistence. Deliberately mirrors the shape of the old window.storage
// calls it replaces (fetch once, write on change) rather than using a live
// onSnapshot subscription — real-time sync across devices/collaborators is
// a natural upgrade for later (right when actual team-sharing gets built),
// but isn't needed yet and would add real complexity (reconciling optimistic
// local edits against live echoes) for no current benefit with a single user.
//
// Data model: a `teams` collection where each document has
// { name, roster, settings, ownerId, memberIds: [uid, ...] } — membership by
// uid, not a single owner field, so inviting a collaborator later is adding
// a uid to that array, not a schema change. Each team's in-progress match
// lives in a `matchState/current` subdocument underneath it.
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "./firebaseClient.js";

const TEAMS_COLLECTION = "teams";
const MATCH_STATE_DOC = "current";

export async function fetchTeams(uid) {
  const q = query(collection(db, TEAMS_COLLECTION), where("memberIds", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createTeamDoc(uid, team) {
  const ref = doc(collection(db, TEAMS_COLLECTION));
  const data = { name: team.name, roster: team.roster, settings: team.settings, ownerId: uid, memberIds: [uid] };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

export async function updateTeamDoc(teamId, updates) {
  await updateDoc(doc(db, TEAMS_COLLECTION, teamId), updates);
}

export async function deleteTeamDoc(teamId) {
  await deleteDoc(doc(db, TEAMS_COLLECTION, teamId));
  try {
    await deleteDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC));
  } catch {
    // fine if there wasn't one to delete
  }
}

export async function fetchMatchState(teamId) {
  const snap = await getDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC));
  return snap.exists() ? snap.data() : null;
}

export async function saveMatchState(teamId, state) {
  await setDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC), state);
}
