// The one fairness-state lookup shared by the rotation-progress success
// card, and the mid-match fairness toast — a single source of truth
// for the three tiers so the ring colour, beam tilt, and copy can never
// drift out of sync between the places that show them. Keyed off the same
// spread-in-minutes metric the rest of the app already uses for fairness
// (computeFairnessSpread, rotation.js) — max minus min pitch time across
// today's available players.
const FAIRNESS_STATES = [
  { key: "fair", max: 2, ring: "#2E7D53", tilt: 0, label: "Fair", toast: "Subs still fair" },
  { key: "nearlyFair", max: 4, ring: "#F5B93B", tilt: 9, label: "Nearly fair", toast: "Nearly even" },
  // No upper bound — anything past the "nearly fair" ceiling lands here.
  { key: "needsAttention", max: Infinity, ring: "#C4482A", tilt: 21, label: "Needs attention", toast: "Evening it up" },
];

// spreadMin: max - min pitch time (minutes) across today's players. Picks
// the first tier whose own ceiling the spread still fits under — 0-2 is
// "fair", 3-4 is "nearly fair", 5+ is "needs attention".
export function getFairnessState(spreadMin) {
  return FAIRNESS_STATES.find((s) => spreadMin <= s.max) || FAIRNESS_STATES[FAIRNESS_STATES.length - 1];
}
