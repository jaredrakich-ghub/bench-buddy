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
//     pendingClaim: {               // Step 2 — set once, when requireEmailClaim
//                                   // is on and someone submits an email
//                                   // (Stage A). Cleared the moment Stage B
//                                   // completes, or superseded by a fresh
//                                   // request if someone else submits an
//                                   // email before Stage B happens.
//       email: string,
//       deviceToken: string,       // fresh, single-use — this is the token
//                                   // Pile 2 (the email extension) actually
//                                   // sends; NOT claimToken itself
//       requestedAt: number,
//       viaToken: string,          // echoes claimToken as of the moment this
//                                   // was requested — see firestore.rules:
//                                   // proves the requester actually had the
//                                   // real share link, not a guessed teamId
//     } | null,
//     claim: {
//       email: string | null,      // null if requireEmailClaim was off
//       viaToken: string,          // which token completed this claim —
//                                   // claimToken directly (requireEmailClaim
//                                   // off) or pendingClaim.deviceToken
//                                   // (requireEmailClaim on). Not a new
//                                   // secret: same value already known from
//                                   // the URL/email, kept for audit only.
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
//
// Step 2 note on the two tokens: claimToken (share link) only ever proves
// someone has that link — with requireEmailClaim on, it's not itself the
// access credential, it just unlocks Stage A (submit an email). The email
// then carries a *second*, single-use deviceToken, minted fresh in
// pendingClaim — opening THAT is Stage B, the one that actually binds
// claimedByUid. With requireEmailClaim off, there's no second token:
// claimToken IS the credential, Stage A and B collapse into one write.
// Sending the actual email is Pile 2 (a Firebase Trigger Email extension
// write, not built yet — see the plan discussion) — everything in this
// file and firestore.rules works independently of whether that's wired up,
// since claiming here only needs the deviceToken to exist, not to have been
// emailed anywhere yet.

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

// A fresh, cryptographically-random token — used for both claimToken (the
// share link) and pendingClaim.deviceToken (the emailed link). Generation
// itself now lives in token.js (extracted there once the Availability-link
// feature needed the exact same thing) — this stays exported under its own
// name so nothing else in Match Link has to change.
export { generateToken as generateClaimToken } from "./token.js";

// Stage A's gate — true while a share link is still open for a NEW claim to
// begin at all: not yet fully claimed, not revoked, not expired. Used
// client-side (Step 4's 2b screen shouldn't show a live form for a dead
// link) and mirrors the first half of firestore.rules' own check.
export function canStartClaim(handover, now = Date.now()) {
  if (!handover || handover.revokedAt) return false;
  if (handover.expiresAt != null && now >= handover.expiresAt) return false;
  return handover.claim == null;
}

// Stage B's gate — true while a pending (emailed) claim exists and is still
// eligible to be confirmed. Only meaningful when requireEmailClaim is on;
// the off case never produces a pendingClaim at all (Stage A and B are the
// same write in that case).
export function canConfirmClaim(handover, now = Date.now()) {
  return canStartClaim(handover, now) && handover.pendingClaim != null;
}

// Step 4 — what MatchClaimPage (2b) should show for a given handover, the
// token from the URL it was opened with, and the viewer's own (anonymous)
// uid. Built entirely on canStartClaim/canConfirmClaim above rather than
// re-deriving revoked/expired/claimed checks — this is the one place that
// combines them into a single UI decision.
//
//   "not-found"        — no handover at all, or the token doesn't match
//                         anything current (e.g. a stale link after the
//                         coach regenerated).
//   "dead"              — the handover itself is revoked or past its hard
//                         cap, and nobody ever claimed it.
//   "already-yours"     — this viewer already holds an active claim (e.g.
//                         they reopened their own link on the same device).
//   "taken-back"        — this viewer's claim exists but was revoked —
//                         distinct from "already-claimed" so the copy can
//                         say what actually happened rather than implying
//                         someone else has it.
//   "already-claimed"   — someone else holds the claim.
//   "needs-email"        — the real share token, requireEmailClaim is on —
//                         show the email form (Stage A).
//   "ready-to-claim"     — the real share token, requireEmailClaim is off —
//                         claim directly, no email step.
//   "ready-to-confirm"   — the emailed deviceToken — complete Stage B.
export function classifyClaimLink(handover, token, viewerUid, now = Date.now()) {
  if (!handover) return "not-found";

  if (handover.claim) {
    if (handover.claim.claimedByUid === viewerUid) {
      return handover.claim.revokedAt ? "taken-back" : "already-yours";
    }
    return "already-claimed";
  }

  if (!canStartClaim(handover, now)) return "dead";

  if (token === handover.claimToken) {
    return handover.requireEmailClaim ? "needs-email" : "ready-to-claim";
  }
  if (canConfirmClaim(handover, now) && token === handover.pendingClaim.deviceToken) {
    return "ready-to-confirm";
  }
  return "not-found";
}
