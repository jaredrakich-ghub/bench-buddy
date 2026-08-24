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

// spreadMin: max - min pitch time (minutes) across today's available
// players (computeFairnessSpread, rotation.js). intervalLen: the length
// in minutes of one sub-interval in this game's own rotation
// (computeIntervals's own return, or derived straight from a real plan —
// see FairnessMark's own comment for exactly how each caller gets it).
export function getFairnessState(spreadMin, intervalLen) {
  if (spreadMin <= intervalLen) return FAIR;
  const twoIntervalMin = intervalLen * 2;
  if (spreadMin <= twoIntervalMin) {
    return twoIntervalMin <= FAIR_TWO_INTERVAL_CEILING_MIN ? FAIR : NEARLY_FAIR;
  }
  return NEEDS_ATTENTION;
}
