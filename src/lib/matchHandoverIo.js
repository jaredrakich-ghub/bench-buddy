// Match Link — Firestore I/O for teams/{teamId}/matchHandover/current.
// Deliberately separate from matchHandover.js (pure model/permission logic,
// no Firestore imports) the same way gameHistory.js sits apart from
// firestoreTeams.js — this file is the read/write side, that one is the
// spec side.
//
// Unlike firestoreTeams.js's fetch-once matchState pattern (a deliberate
// choice there, see its own top comment), this screen subscribes live: the
// whole point of "Who has the game" is seeing a parent's claim land without
// the coach having to back out and reopen the screen. Nothing else in the
// app uses onSnapshot yet — Step 7 is where that becomes the norm for
// matchState too, once both parties are live on the same match at once.
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseClient.js";
import { initialExpiresAt, generateClaimToken } from "./matchHandover.js";

const TEAMS_COLLECTION = "teams";
const HANDOVER_SUBCOLLECTION = "matchHandover";
const HANDOVER_DOC = "current";

function handoverRef(teamId) {
  return doc(db, TEAMS_COLLECTION, teamId, HANDOVER_SUBCOLLECTION, HANDOVER_DOC);
}

// Turns Match Link on for this match, from scratch: a brand new, unclaimed
// handover with a fresh claimToken. Only ever called when there's no
// handover yet, or the existing one was switched off (revokedAt set) —
// see MatchLinkScreen.jsx. A plain setDoc, not updateDoc.
export async function createHandover(teamId, coachUid, { level, stopsAtFullTime, requireEmailClaim, kickoffAt }) {
  const data = {
    level,
    createdAt: Date.now(),
    createdBy: coachUid,
    stopsAtFullTime,
    expiresAt: initialExpiresAt(kickoffAt),
    revokedAt: null,
    requireEmailClaim,
    claimToken: generateClaimToken(),
    pendingClaim: null,
    claim: null,
  };
  await setDoc(handoverRef(teamId), data);
  return data;
}

// Changes the level/toggles on an ALREADY-shared handover without touching
// claimToken/claim/pendingClaim — a coach flipping "stops at full time"
// shouldn't silently kick out a parent who's already claimed the link, or
// hand out a new URL for no security reason. Deliberately a narrow
// updateDoc (only the keys actually passed in `updates`), not a full
// re-write.
export async function updateHandoverSettings(teamId, updates) {
  await updateDoc(handoverRef(teamId), updates);
}

// A new token, discarding any existing claim/pendingClaim — this is the
// deliberate, explicit "get a new link" action (e.g. a coach suspects the
// old one circulated too widely), distinct from updateHandoverSettings
// above. Keeps the current level/toggle choices rather than asking the
// caller to re-supply them.
export async function regenerateClaimToken(teamId, currentHandover) {
  const data = {
    ...currentHandover,
    claimToken: generateClaimToken(),
    pendingClaim: null,
    claim: null,
  };
  await setDoc(handoverRef(teamId), data);
  return data;
}

// Switches Match Link off entirely for this match — the coach's own "turn
// this off" action, distinct from revoking one holder (below).
export async function revokeHandover(teamId) {
  await updateDoc(handoverRef(teamId), { revokedAt: Date.now() });
}

// Revokes THIS holder specifically ("Who has the game" row's own revoke),
// independent of switching the whole handover off — matchHandover.js's own
// claim.revokedAt field exists exactly for this distinction.
export async function revokeHolder(teamId, currentClaim) {
  await updateDoc(handoverRef(teamId), { claim: { ...currentClaim, revokedAt: Date.now() } });
}

// Live subscription — cb receives the handover doc (or null if none exists
// yet) every time it changes, including the moment a parent completes
// their claim. Returns the unsubscribe function.
export function subscribeHandover(teamId, cb) {
  return onSnapshot(handoverRef(teamId), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

// Step 4 — MatchClaimPage's own read. A plain single getDoc, not a
// subscription: this page's job ends the moment a claim succeeds (or fails),
// it doesn't sit around watching for further changes the way the coach's
// MatchLinkScreen does.
export async function fetchHandoverForClaim(teamId) {
  const snap = await getDoc(handoverRef(teamId));
  return snap.exists() ? snap.data() : null;
}

// Stage A — submit an email, mint a fresh single-use deviceToken. A blind
// write by design (see matchHandover.js's own top comment and
// firestore.rules): `viaToken` must be the claimToken the parent's URL
// actually carried, which firestore.rules re-verifies server-side against
// the document's own stored claimToken — this function doesn't (and can't)
// enforce that itself, it just submits what the caller has.
export async function submitClaimEmail(teamId, { email, viaToken }) {
  const deviceToken = generateClaimToken();
  await updateDoc(handoverRef(teamId), {
    pendingClaim: { email, deviceToken, requestedAt: Date.now(), viaToken },
  });
  return deviceToken;
}

// Stage B — or the single-stage direct claim when requireEmailClaim is off.
// `claim` is the full object per matchHandover.js's own shape (email,
// viaToken, claimedAt, claimedByUid, deviceBoundAt, revokedAt) — built by
// the caller (MatchClaimPage), since which `viaToken` is correct depends on
// which of the two paths this is. Same blind-write pattern as
// submitClaimEmail: firestore.rules is what actually enforces viaToken
// matches, not this function.
export async function confirmClaim(teamId, claim) {
  await updateDoc(handoverRef(teamId), { claim, pendingClaim: null });
}
