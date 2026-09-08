// Availability link — request/answer model and derived summaries.
//
// Pure logic only (no Firestore/Auth imports), same style as matchHandover.js:
// independently unit-testable, and written to be the exact spec
// firestore.rules mirrors for teams/{teamId}/availability. If a rule here
// changes, firestore.rules needs the equivalent change alongside it.
//
// A request lives at teams/{teamId}/availability/current, sibling to
// matchHandover/current and matchState/current — one active availability
// request per team, matching "one link per match, not per parent" (README
// > The link).
//
// Shape:
//   {
//     createdAt, createdBy,        // coach's uid
//     closingAt: number,           // ms epoch — display framing only, see
//                                   // isRequestClosed below. Never a hard gate.
//     reopenedAt: number | null,   // set when the coach pushes closingAt
//                                   // later AFTER it had already passed —
//                                   // an audit trail, not a gate.
//     revokedAt: number | null,    // coach turns the request off entirely
//                                   // (regenerating mints a fresh token,
//                                   // see createAvailabilityRequest).
//     token: string,               // the public share token
//     squad: [{ id, name, number }],
//                                   // denormalized at creation time — the
//                                   // ONLY child data the public route ever
//                                   // serves (README > Identity, and its
//                                   // limits: "do not show phone numbers,
//                                   // emails, addresses... Child first
//                                   // names and shirt numbers only").
//                                   // Reading the real roster is never part
//                                   // of the public route's job.
//     answers: {
//       [childId]: {
//         status: "in" | "out",    // "unanswered" is never stored — it's
//                                   // just the absence of an entry here,
//                                   // same "null means not yet" pattern
//                                   // matchHandover.js already uses for an
//                                   // unclaimed handover's own `claim`.
//         noteChips: string[],     // subset of NOTE_CHIP_OPTIONS' own keys
//         noteText: string,
//         answeredAt: number,
//         changedAt: number,       // == answeredAt on the first answer;
//                                   // updated on every re-answer. Last
//                                   // write wins per child (README).
//       }
//     },
//   }

import { generateToken } from "./token.js";

export function generateAvailabilityToken() {
  return generateToken();
}

// The three preset note chips (README > Notes) — one shared source of
// truth for both the parent's page (1b/1c) and the coach's setup screen
// (1d), so a label or key never drifts between the two.
export const NOTE_CHIP_OPTIONS = [
  { key: "late", label: "Arriving late" },
  { key: "early", label: "Leaving early" },
  { key: "goalkeeper", label: "Can keep goal" },
];

// A brand new request — always a full replace (mirrors matchHandover.js's
// own createHandover/generateClaimToken precedent): a fresh token, an
// empty answers map. Regenerating (the coach hits "get a new link" after
// this already exists) is the exact same call — every existing answer is
// deliberately discarded along with the old token, matching "regenerating
// a link invalidates the old token" (README > The link). There's no
// partial-update path for this the way Match Link's handover toggles have
// one — an availability request has nothing worth preserving across a
// genuine token rotation the way a claim does.
export function createAvailabilityRequest({ createdBy, closingAt, squad }) {
  return {
    createdAt: Date.now(),
    createdBy,
    closingAt,
    reopenedAt: null,
    revokedAt: null,
    token: generateAvailabilityToken(),
    squad,
    answers: {},
  };
}

// Purely a display concern — README > The link is explicit that closing
// time "never refuses an answer; it only changes the page's framing".
// Nothing in this file (or firestore.rules) ever gates a write on this.
export function isRequestClosed(request, now = Date.now()) {
  return !!request && request.closingAt != null && now >= request.closingAt;
}

// A genuine "reopen" is pushing closingAt to a later time after it had
// already passed — worth recording (reopenedAt) since the coach explicitly
// acted, unlike editing a not-yet-passed closing time, which is just normal
// setup. Reopening never touches the token or any existing answers.
export function reopenAvailabilityRequest(request, newClosingAt, now = Date.now()) {
  const wasClosed = isRequestClosed(request, now);
  return { ...request, closingAt: newClosingAt, reopenedAt: wasClosed ? now : request.reopenedAt };
}

// The token's own gate — false only once the coach has revoked the whole
// request (turned it off, or regenerated — same createAvailabilityRequest
// call either way, which is what actually invalidates the old token: a
// stale client still holding it just gets a fresh, unclaimed-by-anyone
// document under a new token, not this same one). Deliberately does NOT
// check closingAt — see isRequestClosed's own comment.
export function canAnswer(request) {
  return !!request && request.revokedAt == null;
}

// Builds one child's answer entry — used for both a first answer and a
// re-answer (README: "a parent can change their answer by reopening the
// link... last write wins"). previousAnsweredAt, when given, is carried
// forward so changedAt (not answeredAt) is what actually moves on a
// re-answer — the coach's own "changed-at time" cue (README > Identity).
export function buildAnswer({ status, noteChips = [], noteText = "" }, previousAnsweredAt = null, now = Date.now()) {
  return { status, noteChips, noteText, answeredAt: previousAnsweredAt ?? now, changedAt: now };
}

// Counts by status — the one place both 1a's reply-state line and 1d's
// setup summary derive from, so the two screens can never disagree about
// what "answered" means.
export function summarizeAnswers(squad, answers) {
  let inCount = 0;
  let outCount = 0;
  for (const player of squad) {
    const status = answers[player.id]?.status;
    if (status === "in") inCount++;
    else if (status === "out") outCount++;
  }
  const total = squad.length;
  const answeredCount = inCount + outCount;
  return { total, inCount, outCount, answeredCount, waitingCount: total - answeredCount };
}

// 1a's own reply-state line: "Nobody has answered yet." -> "6 of 9 answered".
export function describeReplyState(squad, answers) {
  const { total, answeredCount } = summarizeAnswers(squad, answers);
  return answeredCount === 0 ? "Nobody has answered yet." : `${answeredCount} of ${total} answered`;
}

// 1d's one-line summary — "6 answered your link. Sarah is out, 2 haven't
// replied." Names every "out" child individually up to a small cap (the
// same "+N more" instinct the squad card already uses elsewhere in this
// app, not a new pattern) so the sentence can't run away on a big squad.
// Returns null when nobody's answered yet — 1d falls back to its own
// plain "Who's here" state with nothing to summarize (no link sent yet,
// or sent but silent so far).
const MAX_NAMED_OUT = 3;
export function describeSetupSummary(squad, answers) {
  const { answeredCount, waitingCount } = summarizeAnswers(squad, answers);
  if (answeredCount === 0) return null;

  const outNames = squad.filter((p) => answers[p.id]?.status === "out").map((p) => p.name);
  const parts = [`${answeredCount} of ${squad.length} answered your link.`];
  if (outNames.length > 0) {
    const named = outNames.slice(0, MAX_NAMED_OUT).join(", ");
    const rest = outNames.length - MAX_NAMED_OUT;
    const outPhrase = rest > 0 ? `${named} +${rest} more` : named;
    parts.push(`${outPhrase} ${outNames.length === 1 ? "is" : "are"} out.`);
  }
  if (waitingCount === 1) parts.push("1 hasn't replied.");
  else if (waitingCount > 1) parts.push(`${waitingCount} haven't replied.`);
  return parts.join(" ");
}

// Step 5's own union: a child who noted "Can keep goal" for THIS match is
// goalkeeper-eligible for THIS rotation build, regardless of their
// roster-level keeperEligible flag (README > Notes: "Can keep goal should
// feed the goalkeeper rotation the app already builds") — additive only,
// never removes an already-eligible player who didn't answer or didn't
// note it.
export function keeperNoteIds(squad, answers) {
  return squad.filter((p) => answers[p.id]?.noteChips?.includes("goalkeeper")).map((p) => p.id);
}

// The two note-driven flags Step 5 needs to surface at rotation-build time
// (README > Notes: "should be visible... not buried") — a plain lookup by
// child id, not a derived list, since the caller already knows which
// child it's rendering a row for.
export function hasNoteChip(answers, childId, chipKey) {
  return !!answers[childId]?.noteChips?.includes(chipKey);
}
