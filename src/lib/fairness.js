// The one fairness-state lookup shared by the rotation-progress success
// card and the mid-match fairness toast — a single source of truth for
// the three tiers so the ring colour, beam tilt, and copy can never drift
// out of sync between the places that show them.
//
// Real-use feedback: the original cutoffs were fixed minute counts, which
// doesn't hold up — a 2-interval gap means something very different for a
// 4-minute sub window (8 min apart) than a 7-minute one (14 min apart).
// The bands scale with the game's own interval length instead:
//   - within 1 interval's worth of gap: always Fair.
//   - within 2 intervals' worth: Fair if that's still <=10 real minutes
//     (short sub windows), otherwise Nearly fair (longer sub windows
//     make the same "2 intervals" a bigger real gap).
//   - 3+ intervals' worth of gap, regardless of interval length: Needs
//     attention.
const FAIR_TWO_INTERVAL_CEILING_MIN = 10;

const FAIR = { key: "fair", ring: "#2E7D53", tilt: 0, label: "Fair", toast: "Subs still fair" };
const NEARLY_FAIR = { key: "nearlyFair", ring: "#F5B93B", tilt: 9, label: "Nearly fair", toast: "Nearly even" };
const NEEDS_ATTENTION = { key: "needsAttention", ring: "#C4482A", tilt: 21, label: "Needs attention", toast: "Evening it up" };

const TIER_ORDER = { fair: 0, nearlyFair: 1, needsAttention: 2 };

function baseFairnessState(spreadMin, intervalLen) {
  if (spreadMin <= intervalLen) return FAIR;
  const twoIntervalMin = intervalLen * 2;
  if (spreadMin <= twoIntervalMin) {
    return twoIntervalMin <= FAIR_TWO_INTERVAL_CEILING_MIN ? FAIR : NEARLY_FAIR;
  }
  return NEEDS_ATTENTION;
}

// Real-use feedback, validated against real generated plans (both the
// fresh-build and mid-game-rebuild engines) before landing here — the
// interval-scaled bands above are sound on their own, but interval length
// alone can't tell "a 7-minute gap in a 20-minute game" (a real, legit
// problem — one kid gets half the match) apart from "a 7-minute gap in a
// 60-minute game" (genuinely fine) the way a share of the *whole game*
// can. Owner's own thresholds for that share: <=20% fair, 21-29% nearly
// fair, >=30% needs attention.
//
// Combination rule (owner's own call): the interval-scaled bands stay
// primary. Only when the two disagree does the game-length share win —
// checked against real data first, not assumed: this makes the rating
// *more lenient* for realistic 40+ minute games (interval bands alone
// over-flag a modest gap there) and *stricter* only for short games with
// too few sub-windows to spread minutes around at all (interval bands
// alone can call a literally-half-the-match gap "Fair" there). Never
// invented a threshold beyond what was actually validated against
// generated plans — see the memory note on this feature for the analysis.
const GAME_SHARE_FAIR_MAX_PCT = 20;
const GAME_SHARE_NEARLY_FAIR_MAX_PCT = 29;

function gameShareState(spreadMin, gameMinutes) {
  const pct = (spreadMin / gameMinutes) * 100;
  if (pct <= GAME_SHARE_FAIR_MAX_PCT) return FAIR;
  if (pct <= GAME_SHARE_NEARLY_FAIR_MAX_PCT) return NEARLY_FAIR;
  return NEEDS_ATTENTION;
}

// spreadMin: max - min pitch time (minutes) across today's available
// players (computeFairnessSpread, rotation.js). intervalLen: the length
// in minutes of one sub-interval in this game's own rotation
// (computeIntervals's own return, or derived straight from a real plan —
// see FairnessMark's own comment for exactly how each caller gets it).
// gameMinutes: the whole game's own length — every caller derives this
// straight from the real plan (its last interval's own endMin), not from
// gameSettings, so it always matches what was actually built rather than
// whatever the settings screen currently shows. Optional only so a caller
// mid-migration (or a test not exercising this specifically) still gets
// the pre-existing interval-only behavior rather than a crash — every
// real call site in the app always has a plan to derive it from.
export function getFairnessState(spreadMin, intervalLen, gameMinutes) {
  const base = baseFairnessState(spreadMin, intervalLen);
  if (!gameMinutes) return base;
  const share = gameShareState(spreadMin, gameMinutes);
  return TIER_ORDER[share.key] === TIER_ORDER[base.key] ? base : share;
}
