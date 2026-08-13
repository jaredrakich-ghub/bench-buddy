// Season history: one archived document per completed game, under
// teams/{teamId}/games/{gameId}. Deliberately separate from
// firestoreTeams.js (which owns the team registry and the *live*/current
// match) — this is the read-mostly, append-only archive of games that have
// already finished, a genuinely different access pattern.
//
// A game record is built as { date, settings, players }, where `players` is
// a snapshot of each involved player's roster fields (id, name,
// keeperEligible today, whatever else gets added to a roster entry later —
// e.g. a position, once that's built) merged with their computed minutes
// for that specific game. Deliberately not a fixed/typed shape — see the
// note on firestore.rules' games match block for why.
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "./firebaseClient.js";

const TEAMS_COLLECTION = "teams";
const GAMES_SUBCOLLECTION = "games";

export async function archiveGame(teamId, game) {
  const ref = doc(collection(db, TEAMS_COLLECTION, teamId, GAMES_SUBCOLLECTION));
  await setDoc(ref, game);
  return { id: ref.id, ...game };
}

// Newest first — matches how a coach would actually want to scan history
// ("how did the last few games look"), and is the order the season-summary
// view assumes when it wants to describe "the last N games."
export async function fetchGameHistory(teamId) {
  const q = query(collection(db, TEAMS_COLLECTION, teamId, GAMES_SUBCOLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Deletes every archived game under a team — used by deleteTeamDoc (see
// firestoreTeams.js) before the team doc itself is removed, for the same
// reason matchState has to go first: the games rule proves membership via
// get() on the parent team doc, which would otherwise already be gone by
// the time these deletes are attempted, silently orphaning them forever.
export async function deleteAllGames(teamId) {
  const snap = await getDocs(collection(db, TEAMS_COLLECTION, teamId, GAMES_SUBCOLLECTION));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
