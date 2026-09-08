// Match Link — handover session model and permission checks.
//
// Pure logic only (no Firestore/Auth imports), same style as fairness.js/
// rotation.js — independently unit-testable, and written so it IS the exact
// spec firestore.rules must mirror for teams/{teamId}/matchState. If a rule
// here changes, firestore.rules needs the equivalent change alongside it —
// see the comment there pointing back to this file.
//
// A handover document lives at teams/{teamId}/matchHandover/current,
// sibling to the existing matchState/current singleton (one active handover
// per team's current match, matching "one link per match, not per parent").
// Shape:
//   {
//     level: "subs" | "full",      // DISPLAY ONLY — which sub-line/banner
//                                   // copy the parent's screen shows. Does
//                                   // not change what either party can do;
//                                   // see canWriteMatch/canControlClock.
//     createdAt, createdBy,        // coach's uid
//     stopsAtFullTime: boolean,
//     expiresAt: number,           // ms epoch — see initialExpiresAt/
//                                   // expiresAtOnFullTime below
//     revokedAt: number | null,    // coach switches Match Link off entirely
//     requireEmailClaim: boolean,
//     claimToken: string,          // regenerating = new token + claim: null
//     claim: {
//       email: string | null,      // null if requireEmailClaim was off
//       claimedAt: number,
//       claimedByUid: string,      // an anonymous-auth uid — the same
//                                   // non-account mechanism auth.js's
//                                   // signInAnon already gives a first-time
//                                   // coach, reused here rather than
//                                   // invented fresh
//       deviceBoundAt: number,
//       revokedAt: number | null,  // coach revokes THIS holder specifically
//                                   // ("WHO HAS THE GAME"), independent of
//                                   // revoking the handover as a whole
//     } | null,
//   }

const HARD_CAP_MS = 4 * 60 * 60 * 1000; // kickoff + 4 hours

// The expiry set when a handover is first created. Always the hard cap,
// regardless of the "stops at full time" toggle — if that toggle is on,
// expiresAtOnFullTime (below) brings it forward for real; if it's off, this
// hard cap is the only expiry that ever applies.
export function initialExpiresAt(kickoffAt) {
  return kickoffAt + HARD_CAP_MS;
}

// Called when full time is actually recorded, if stopsAtFullTime is on.
// Brings expiresAt forward to now rather than replacing it outright, so a
// handover that's already past its hard cap for some unrelated reason
// doesn't get accidentally extended by a late full-time call.
export function expiresAtOnFullTime(handover, now = Date.now()) {
  if (!handover.stopsAtFullTime) return handover.expiresAt;
  return Math.min(handover.expiresAt, now);
}

// True only while a claim genuinely, currently has the match: the handover
// itself isn't revoked, hasn't expired, and this specific holder hasn't
// been revoked either. All four have to hold — this is the one check every
// other function here is built on.
export function isHandoverActive(handover, now = Date.now()) {
  if (!handover || handover.revokedAt) return false;
  if (handover.expiresAt != null && now >= handover.expiresAt) return false;
  if (!handover.claim || handover.claim.revokedAt) return false;
  return true;
}

// Match-day actions — subs, injuries, swaps, keeper changes: everything the
// coach's match screen already does. Concurrent, not exclusive: the coach
// and an active holder can both act at once, last write wins per player
// (README, "Permissions during the match") — this is the same shared write
// path the app already uses for these, not a new per-action distinction.
//
// actor is "coach" or "parent" — never anything else. There's no function
// here for squad editing, season history, or team settings: the parent is
// never added to a team's memberIds, so firestore.rules' existing
// membership checks already exclude all of that by construction. Nothing
// new to encode for that boundary.
export function canWriteMatch(actor, handover, now = Date.now()) {
  return actor === "coach" || (actor === "parent" && isHandoverActive(handover, now));
}

// The clock is the one exclusive, single-owner control (README: "control_
// clock is single-owner"). Ownership is unconditional on level — level only
// changes what the parent's screen says, never who owns the clock. Whoever
// currently holds an active claim owns it; the coach does not, for as long
// as it's active.
export function canControlClock(actor, handover, now = Date.now()) {
  return isHandoverActive(handover, now) ? actor === "parent" : actor === "coach";
}
