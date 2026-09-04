import { computeMinutesSummary } from "../lib/rotation.js";
import { fmtClock } from "../lib/clock.js";
import { styles } from "./styles.js";

// README > A5-Minutes (#11b) — three columns (pitch / in goal / bench)
// instead of one total, so a coach can audit that the rotation is sharing
// all three kinds of time fairly.
//
// Full-game projection, not a live/elapsed-capped audit: this screen used
// to show "how many minutes will each player end up with by full time" —
// an earlier pass of this redesign made it a mid-game snapshot instead
// (capped to elapsed time), but that was a deliberate behavior change from
// what the app had always shown, and it turned out that wasn't wanted —
// reverted back to the full plan, same as before. No elapsedSec dependency
// here at all now. The header's own context chip (the game's total
// length) is gone too — real-use feedback: paired with the longer
// "Today's Minutes" title it pushed the header onto two lines; every
// other screen's header is title-only, this one now matches.
// Convert straight to seconds and let fmtClock round to the nearest
// second — rounding to the nearest whole *minute* first (as an earlier
// version of this did) throws away real precision.
function fmtMin(minutes) {
  const totalSec = Math.round(minutes * 60);
  return totalSec === 0 ? "—" : fmtClock(totalSec);
}

export default function SummaryModal({ plan, availableIds, nameOf, numberOf, onClose }) {
  const summary = computeMinutesSummary(plan, availableIds);

  // Real-use feedback: this screen used to open with its own "Pitch time
  // is within N min across the full game" note — a pure outfield-minutes
  // spread computed here. Removed: the post-build success card
  // (RotationProgressOverlay.jsx) and the mid-match fairness toast both
  // show a same-worded "Pitch time is within N min" line too, but from
  // computeFairnessSpread (goal+outfield combined) — a genuinely
  // different number that can legitimately disagree with this screen's
  // own outfield-only one for the same rotation. Two notes with identical
  // wording but different meanings read as a bug even when neither is
  // wrong, so this one's gone rather than relabelled — the PITCH column
  // right below already shows the real per-player numbers directly.

  // Simple descending-by-pitch-time order, same convention A6-Season uses
  // for its own averages — no "live keeper first" special case now that
  // this isn't a live snapshot (there's no one "current" keeper to pin
  // when the table covers the whole game).
  const rows = [...summary].sort((a, b) => b.outfieldMin - a.outfieldMin);

  const totals = summary.reduce(
    (acc, r) => ({
      outfieldMin: acc.outfieldMin + r.outfieldMin,
      gkMin: acc.gkMin + r.gkMin,
      benchMin: acc.benchMin + r.benchMin,
    }),
    { outfieldMin: 0, gkMin: 0, benchMin: 0 }
  );

  return (
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Today's Minutes</div>
      </div>

      <div style={styles.mdMinutesColHeads}>
        <span style={styles.mdMinutesColHeadPitch}>PITCH</span>
        <span style={styles.mdMinutesColHeadGoal}>GOAL</span>
        <span style={styles.mdMinutesColHeadBench}>BENCH</span>
      </div>

      <div style={styles.mdMinutesList}>
        {rows.map((r) => {
          return (
            <div key={r.id} style={styles.mdMinutesRow}>
              {/* Plain green/white disc for everyone here, no gold
                  keeper-eligible variant — too much yellow on a page
                  where several players are often keeper-eligible, per
                  explicit feedback. Season (#10c) still uses the gold
                  variant; this is scoped to Minutes only. */}
              <span style={styles.mdMinutesDisc}>{numberOf(r.id)}</span>
              <span style={styles.mdMinutesName}>{nameOf(r.id)}</span>
              <span style={{ ...styles.mdMinutesValuePitch, ...(r.outfieldMin === 0 ? styles.mdMinutesZero : {}) }}>
                {fmtMin(r.outfieldMin)}
              </span>
              <span style={{ ...styles.mdMinutesValueGoal, ...(r.gkMin === 0 ? styles.mdMinutesZero : {}) }}>
                {fmtMin(r.gkMin)}
              </span>
              <span style={{ ...styles.mdMinutesValueBench, ...(r.benchMin === 0 ? styles.mdMinutesZero : {}) }}>
                {fmtMin(r.benchMin)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={styles.mdMinutesTotalsRow}>
        <span style={styles.mdMinutesTotalsName}>Total</span>
        <span style={styles.mdMinutesValuePitch}>{fmtMin(totals.outfieldMin)}</span>
        <span style={styles.mdMinutesValueGoal}>{fmtMin(totals.gkMin)}</span>
        <span style={styles.mdMinutesValueBench}>{fmtMin(totals.benchMin)}</span>
      </div>
    </section>
  );
}
