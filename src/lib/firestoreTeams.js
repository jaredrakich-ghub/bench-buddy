// Firestore-backed replacement for the old localStorage team/match-state
// persistence. team CRUD stays fetch-once/write-on-change (the old window.
// storage shape) — teams themselves are edited by one coach at a time.
//
// matchState is different as of Match Link Step 7: subscribeMatchState
// below is a real live onSnapshot, because two people (a coach and an
// active Match Link holder) can now genuinely be on the same match at
// once. See useMatchState.js's own comment on why that also meant
// switching its writes from one whole-document saveMatchState per change
// to scoped updateMatchState calls — a stale full-document overwrite from
// one device would otherwise silently erase the other's changes.
//
// Data model: a `teams` collection where each document has
// { name, roster, settings, ownerId, memberIds: [uid, ...] } — membership by
// uid, not a single owner field, so inviting a collaborator later is adding
// a uid to that array, not a schema change. Each team's in-progress match
// lives in a `matchState/current` subdocument underneath it.
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebaseClient.js";
import { deleteAllGames } from "./gameHistory.js";

const TEAMS_COLLECTION = "teams";
const MATCH_STATE_DOC = "current";

// A save failing is rare, but worth explaining in plain terms rather than a
// raw error — the coach can't do anything about a stack trace, but "you're
// offline" or "you don't have access" is actionable. Shared by every caller
// that writes here (team CRUD and match-state persistence both use it),
// hence living next to the calls it's describing errors for.
export const describeSaveError = (err) => {
  if (err?.code === "permission-denied") {
    return "You don't have access to save changes to this team.";
  }
  if (err?.code === "unavailable") {
    return "You're offline — changes will sync once you're back online.";
  }
  return "Changes aren't saving right now — don't close this tab until this is resolved.";
};

export async function fetchTeams(uid) {
  const q = query(collection(db, TEAMS_COLLECTION), where("memberIds", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Step 5 — a direct fetch by id, not a membership query. ParentMatchSession
// needs this: fetchTeams(uid) above finds teams a caller is a *member* of,
// which a parent never is — they only ever have the one teamId their claim
// link named. Returns null rather than throwing if the team doesn't exist
// or firestore.rules denies it (e.g. the handover was revoked between the
// claim page loading and this call), same "missing means null" shape as
// fetchMatchState below.
export async function fetchTeamById(teamId) {
  const snap = await getDoc(doc(db, TEAMS_COLLECTION, teamId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
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
  // Delete matchState and every archived game BEFORE the team doc, not
  // after. Both subcollections' rules prove membership via get() on the
  // parent team doc — if the team doc is already gone, that get() returns
  // null and the rule evaluation errors out (denying the delete), silently
  // orphaning whatever's left underneath forever. Caught the hard way (for
  // matchState) via the Firestore emulator integration tests in
  // firebase-tests/ — same fix applies to games now that it exists too.
  try {
    await deleteDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC));
  } catch {
    // fine if there wasn't one to delete
  }
  try {
    await deleteAllGames(teamId);
  } catch {
    // fine if there was no history to delete
  }
  await deleteDoc(doc(db, TEAMS_COLLECTION, teamId));
}

export async function fetchMatchState(teamId) {
  const snap = await getDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC));
  return snap.exists() ? snap.data() : null;
}

// The ONE full-document write matchState ever gets — a brand new match
// starting (commitFreshPlan, useMatchState.js), where a full replace is
// exactly right: every field genuinely IS starting fresh. Every ordinary
// in-match change after that uses updateMatchState below instead.
export async function saveMatchState(teamId, state) {
  await setDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC), state);
}

// Step 7 — a scoped partial write: only `fields`' own keys are touched,
// everything else in the document is left exactly as it was. This is what
// actually makes two people on one match safe — see useMatchState.js's own
// comment for the full reasoning (a whole-document saveMatchState from a
// second device would otherwise silently clobber whatever the first
// device had just changed, even in fields this write never meant to touch).
export async function updateMatchState(teamId, fields) {
  await updateDoc(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC), fields);
}

// Step 7 — live updates for matchState, used by BOTH the coach's own
// useMatchState instance and the parent's (ParentMatchSession renders the
// exact same hook) — this is what lets either side's changes actually
// appear on the other's screen without a reload.
//
// Deliberately does NOT filter on snapshot.metadata.hasPendingWrites, even
// though a first instinct is "skip the echo of this client's own write."
// Tried that; it's actively wrong for this app. hasPendingWrites reflects
// this client's WHOLE pending-write queue for the document, not just the
// one write that just happened — a phone with patchy field signal (exactly
// this app's real operating condition, see firebaseClient.js's own comment
// on persistentLocalCache) can leave it stuck true for a while, which
// would silently stop every future snapshot from ever reaching cb() until
// the backlog clears. The actual echo-loop risk this was meant to guard
// against is handled at the source instead — see useMatchState.js's
// suppressPersistRef — so re-applying an occasional echo of this client's
// own write here is a harmless no-op, not a loop.
export function subscribeMatchState(teamId, cb) {
  return onSnapshot(doc(db, TEAMS_COLLECTION, teamId, "matchState", MATCH_STATE_DOC), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}
