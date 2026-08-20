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
// here at all now; the header's context chip shows the game's total
// length instead of how far into it play currently is.
// Convert straight to seconds and let fmtClock round to the nearest
// second — rounding to the nearest whole *minute* first (as an earlier
// version of this did) throws away real precision.
function fmtMin(minutes) {
  const totalSec = Math.round(minutes * 60);
  return totalSec === 0 ? "—" : fmtClock(totalSec);
}

export default function SummaryModal({ plan, availableIds, nameOf, numberOf, keeperEligibleIds, onClose }) {
  const totalMin = plan[plan.length - 1].endMin;
  const summary = computeMinutesSummary(plan, availableIds);

  const outfieldValues = summary.map((s) => s.outfieldMin);
  const spreadMin = summary.length ? Math.max(...outfieldValues) - Math.min(...outfieldValues) : 0;

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
        <div style={styles.mdSubHeaderTitle}>Minutes</div>
        <span style={styles.mdSubHeaderChip}>{fmtClock(totalMin * 60)}</span>
      </div>

      <div style={styles.mdMinutesNote}>Pitch time is within {fmtMin(spreadMin)} across the full game.</div>

      <div style={styles.mdMinutesColHeads}>
        <span style={styles.mdMinutesColHeadPitch}>PITCH</span>
        <span style={styles.mdMinutesColHeadGoal}>GOAL</span>
        <span style={styles.mdMinutesColHeadBench}>BENCH</span>
      </div>

      <div style={styles.mdMinutesList}>
        {rows.map((r) => {
          const isKeeper = keeperEligibleIds.includes(r.id);
          return (
            <div key={r.id} style={styles.mdMinutesRow}>
              <span style={{ ...styles.mdMinutesDisc, ...(isKeeper ? styles.mdMinutesDiscKeeper : {}) }}>
                {numberOf(r.id)}
              </span>
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
