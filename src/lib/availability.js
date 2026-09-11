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
//     teamName: string,            // denormalized, same reasoning as squad
//                                   // below — the public claim page can't
//                                   // read teams/{teamId} to get this.
//     matchAt: number,             // ms epoch — the fixture's own kickoff
//                                   // time, no relation to gameSettings
//     opponent: string,            // free text, e.g. "Rovers" — "" if unset
//     location: string,            // free text, e.g. "Hillcrest Park"
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

// A query string on the app's own root, not a path — same reasoning as
// Match Link's own claim URL (its own comment has the full story: GitHub
// Pages needs no extra config for a query string on "/", where a real
// path would need a 404.html SPA-redirect shim). &a= is this feature's
// own param name, distinct from Match Link's &t= so a URL can never
// ambiguously carry both. Shared here (not duplicated per component) since
// both AvailabilityScreen.jsx (the coach's own share/copy/nudge) and this
// module's own tests need the identical construction.
export function buildAvailabilityUrl(teamId, token) {
  return `https://app.benchbuddysports.com/?team=${encodeURIComponent(teamId)}&a=${encodeURIComponent(token)}`;
}

// The preset note chips (README > Notes) — one shared source of truth for
// the parent's page (1b/1c), so a label or key never drifts anywhere else
// that reads it. "Can keep goal" was here too originally, but real-use
// feedback was clear: parents shouldn't be asked that at all. Dropped
// rather than just hidden — see keeperNoteIds' own removal, same commit.
export const NOTE_CHIP_OPTIONS = [
  { key: "late", label: "Arriving late" },
  { key: "early", label: "Leaving early" },
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
// opponent/matchAt/location: the fixture card 1a shows ("Tigers FC v
// Rovers" / "Sat 13 Sep · 9:30 am · Hillcrest Park") has no existing home
// anywhere in this app — gameSettings (teams.js) only ever holds
// fieldSize/gameMinutes/subIntervalMinutes, no opponent/date/venue concept
// at all. Rather than growing that model for one feature, these live only
// on the availability request itself, entered fresh each time the coach
// composes one — matchAt a real timestamp (same native datetime-local
// picker as closingAt), opponent/location plain text.
// teamName is denormalized here too, same reasoning as squad — the public
// claim page (1c) can't read teams/{teamId} (membership-gated) to get it,
// so it has to already be sitting on the one document that route CAN read.
export function createAvailabilityRequest({ createdBy, teamName, closingAt, matchAt, opponent, location, squad }) {
  return {
    createdAt: Date.now(),
    createdBy,
    teamName,
    matchAt,
    opponent,
    location,
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

// Real-use feedback: closing time doesn't need to be a coach decision every
// single time — most coaches want the same thing (give parents until the
// day after kickoff), so 1a's own create form no longer asks for it at all.
// Still editable afterward from the manage screen's own "Closes… Tap to
// change" — this is only the default a coach never has to think about up
// front.
export function defaultClosingAt(matchAt) {
  return matchAt + 24 * 60 * 60 * 1000;
}

// Real-use feedback: nothing ever marked a request "done" once its own
// match had been played, so a coach setting up the NEXT game kept seeing
// last game's answers presented as if they were live for this one — same
// summary pill, same pre-filled "Who's here". matchAt (the kickoff time
// entered when the request was composed) is the one signal already sitting
// on the document that distinguishes "for the game I'm setting up" from
// "for a game that's already happened" — a request whose own match has
// passed is stale regardless of revokedAt/closingAt (a coach could easily
// leave the closing time itself in the past and still be inside a live
// match at the time). Callers treat a stale request the same as no request
// at all — this doesn't delete or revoke anything server-side, it's a
// display-time check only, so a coach who reopens the SAME upcoming game's
// setup still sees their real answers; a stale request just isn't wired to
// any UI while it looks like this.
export function isRequestStale(request, now = Date.now()) {
  return !!request && request.matchAt != null && now >= request.matchAt;
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

// 1d's one-line summary — "6 of 9 answered. Sarah is out." Names every
// "out" child individually up to a small cap (the same "+N more" instinct
// the squad card already uses elsewhere in this app, not a new pattern) so
// the sentence can't run away on a big squad. Returns null when nobody's
// answered yet — 1d falls back to its own plain "Who's here" state with
// nothing to summarize (no link sent yet, or sent but silent so far).
//
// Real-use feedback: this used to end with its own "N haven't replied"
// clause ("...Ben is out. 3 haven't replied.") — dropped as pure
// redundancy, not a copy trim for its own sake: "2 of 5 answered" already
// implies 3 didn't, and the Nudge button rendered right below this same
// line already says "Nudge the 3 still waiting" — the same fact a third
// time in as many lines.
const MAX_NAMED_OUT = 3;
export function describeSetupSummary(squad, answers) {
  const { answeredCount } = summarizeAnswers(squad, answers);
  if (answeredCount === 0) return null;

  const outNames = squad.filter((p) => answers[p.id]?.status === "out").map((p) => p.name);
  const parts = [`${answeredCount} of ${squad.length} answered.`];
  if (outNames.length > 0) {
    const named = outNames.slice(0, MAX_NAMED_OUT).join(", ");
    const rest = outNames.length - MAX_NAMED_OUT;
    const outPhrase = rest > 0 ? `${named} +${rest} more` : named;
    parts.push(`${outPhrase} ${outNames.length === 1 ? "is" : "are"} out.`);
  }
  return parts.join(" ");
}

// Step 6's own "Nudge the two waiting" — who, by name, hasn't answered at
// all yet. Distinct from summarizeAnswers' own waitingCount, which only
// needs the number; the nudge action needs to actually name them in the
// reminder it composes.
export function waitingChildren(squad, answers) {
  return squad.filter((p) => !answers[p.id]);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Sat 13 Sep · 9:30 am" — the date/time half of 1a's own fixture card and
// message preview. Plain Date getters (local time, matching what a native
// datetime-local input already gave the coach), no Intl — this app has no
// other date formatting anywhere to stay consistent with, and a fixed,
// predictable format matters more here than locale-awareness for a single
// coach typing their own match time.
export function formatMatchWhen(matchAt) {
  if (!matchAt) return "";
  const d = new Date(matchAt);
  const day = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const hours24 = d.getHours();
  const hours = hours24 % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} · ${hours}:${minutes} ${hours24 >= 12 ? "pm" : "am"}`;
}

// "Saturday, 12 Sep 2026" and "9:30 am" — real-use feedback, second round:
// native <input type="date">/<input type="time"> render their own value
// through browser-internal layout that plain CSS (text-align included)
// can't reliably reach in either Safari or Chrome — appearance:none fixes
// the input's own box styling but not this. The actual fix is to make the
// native input itself invisible-but-interactive (still opens the real OS
// picker on tap) and show our OWN left-aligned text on top of it — these
// are that text. Take the RAW string straight off the input (not a
// matchAt ms timestamp) so there's no Date-parsing timezone ambiguity;
// explicit Y/M/D construction, same "plain getters, no Intl" convention
// as formatMatchWhen above.
export function formatDateStringFull(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${WEEKDAYS_FULL[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}
export function formatTimeStringAmPm(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const hours = h % 12 || 12;
  return `${hours}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

// "Tigers FC v Rovers" — falls back to just the team name if no opponent
// was entered (a friendly/training session still needs a fixture line).
export function formatFixture(teamName, opponent) {
  return opponent ? `${teamName} v ${opponent}` : teamName;
}

// The WhatsApp message itself — README > Screens > 1a is explicit that
// what ships must be byte-identical to what the preview shows, so this is
// the ONE place that copy is ever generated; the compose screen's own
// preview card renders this same string, not a separate hand-typed one.
// `url` is appended by the caller (MatchAvailabilityScreen.jsx), which is
// the one place that knows the app's own domain — this function stays
// domain-agnostic on principle, same reasoning as MatchLinkScreen.jsx's
// own URL construction living in the component, not the pure model.
//
// Real-use feedback: the fixture line and the instruction used to run
// together as one sentence ("...9:30 am. Tap your child..."), and "takes
// ten seconds" read as filler. The blank line between them (\n\n — a real
// line break, not just a period) is why the coach's own "WHAT THE GROUP
// SEES" preview needs white-space: pre-line (see mdAvailPreviewWell) to
// actually render it; WhatsApp and every other destination for this exact
// string render a real newline natively, no such change needed there.
// Instruction line itself later changed again, screen 4 feedback: "Tap
// your child's name to confirm they're playing" -> "Select a player to
// confirm their availability." — matches the parent-facing picker
// screen's own "Select a player" title (AvailabilityClaimPage.jsx).
export function buildShareMessage({ teamName, opponent, matchAt, location }) {
  const fixture = formatFixture(teamName, opponent);
  const when = formatMatchWhen(matchAt);
  const atLocation = location ? ` at ${location}` : "";
  return `${fixture}, ${when}${atLocation}.\n\nSelect a player to confirm their availability.`;
}

// Step 6 — "Nudge the two waiting". Same URL as the original share (README
// never describes a second link for this — it's a reminder, not a new
// request), so it reads as a targeted follow-up in the same group chat,
// not a duplicate of the first ask.
//
// Real-use feedback: this used to name every still-waiting child in the
// chat ("Still waiting to hear from Ben and Charlie…") — not something a
// coach wants broadcast to the whole group. Counts only now, same "X of Y"
// shape the compose/manage screen's own summary line already uses
// elsewhere in this file (describeSetupSummary/describeReplyState).
export function buildNudgeMessage({ answeredCount, totalCount }) {
  const waitingCount = totalCount - answeredCount;
  return `${answeredCount} of ${totalCount} have replied — ${waitingCount} still to confirm. Could you tap the link above and let us know?`;
}
