// Availability link — Firestore I/O for teams/{teamId}/availability/current.
// Deliberately separate from availability.js (pure model, no Firestore
// imports), same split as matchHandoverIo.js/matchHandover.js.
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient.js";
import { createAvailabilityRequest, reopenAvailabilityRequest, isRequestClosed } from "./availability.js";

const TEAMS_COLLECTION = "teams";
const AVAILABILITY_SUBCOLLECTION = "availability";
const AVAILABILITY_DOC = "current";

function availabilityRef(teamId) {
  return doc(db, TEAMS_COLLECTION, teamId, AVAILABILITY_SUBCOLLECTION, AVAILABILITY_DOC);
}

// The coach's own read — a plain single fetch, used to seed the compose
// screen (1a) on load. Live updates while the coach is actually looking at
// it come from subscribeAvailabilityRequest below, not this.
export async function fetchAvailabilityRequest(teamId) {
  const snap = await getDoc(availabilityRef(teamId));
  return snap.exists() ? snap.data() : null;
}

// A brand new request, or a full regenerate (new token, every existing
// answer discarded) — see availability.js's own comment on why there's no
// partial path for this specific action.
export async function createOrRegenerateAvailabilityRequest(teamId, coachUid, { teamName, closingAt, matchAt, opponent, location, squad }) {
  const data = createAvailabilityRequest({ createdBy: coachUid, teamName, closingAt, matchAt, opponent, location, squad });
  await setDoc(availabilityRef(teamId), data);
  return data;
}

// Editing the closing time on an already-shared request — reopening if it
// had already passed, a plain edit otherwise (availability.js's own
// reopenAvailabilityRequest decides which). Never touches the token or any
// existing answers.
export async function updateClosingTime(teamId, currentRequest, newClosingAt) {
  const updated = reopenAvailabilityRequest(currentRequest, newClosingAt);
  await updateDoc(availabilityRef(teamId), { closingAt: updated.closingAt, reopenedAt: updated.reopenedAt });
  return updated;
}

// Turns the request off entirely — distinct from letting the closing time
// pass (README: closing time alone never refuses an answer). The public
// route's own write rule checks exactly this field.
export async function revokeAvailabilityRequest(teamId) {
  await updateDoc(availabilityRef(teamId), { revokedAt: Date.now() });
}

// The public write — a parent answering for their child. `token` is the
// value the parent's own URL carried; firestore.rules re-verifies it
// matches the document's own stored token server-side (see that rule's own
// comment) — this function doesn't and can't enforce that itself, it just
// submits what the caller has, same blind-write pattern Match Link's own
// Stage A/B established.
export async function submitAnswer(teamId, childId, answer, token) {
  await updateDoc(availabilityRef(teamId), { [`answers.${childId}`]: answer, lastAnsweredViaToken: token });
}

// Live updates for the coach's own compose screen (1a) — so "3 of 9
// answered" moves in front of them as replies actually arrive, without a
// reload. The parent's own page (1c) never needs this: it reads once,
// submits once, and shows a confirmation — there's nothing further for it
// to watch for.
export function subscribeAvailabilityRequest(teamId, cb) {
  return onSnapshot(availabilityRef(teamId), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

// Re-exported for callers that only need the display check, not the whole
// model module — mirrors how MatchLinkScreen.jsx reaches for isHandoverActive.
export { isRequestClosed };
