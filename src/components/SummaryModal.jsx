import { computeMinutesSummary, describeMinutesNote } from "../lib/rotation.js";
import { fmtClock } from "../lib/clock.js";
import { styles } from "./styles.js";

// README > A5-Minutes (#11b) — "the screen exists to audit the rotation,
// so it splits each child's time three ways — pitch, in goal, bench —
// rather than showing one total." A mid-game check, not a projection of
// the full plan: everything here is capped to elapsedSec (see
// computeMinutesSummary's capMin), which is a deliberate behavior change
// from the previous version of this screen (which always showed the full
// planned game regardless of how far in it actually was) — the whole
// point of an audit is checking how it's *actually* gone so far.
// Convert straight to seconds and let fmtClock round to the nearest
// second — rounding to the nearest whole *minute* first (as an earlier
// version of this did) throws away real precision: at 12:40 elapsed,
// someone who's been keeper the entire time should read "12:40", not a
// misleading "13:00" from rounding 12.667 minutes up front.
function fmtMin(minutes) {
  const totalSec = Math.round(minutes * 60);
  return totalSec === 0 ? "—" : fmtClock(totalSec);
}

export default function SummaryModal({ plan, availableIds, nameOf, numberOf, keeperEligibleIds, elapsedSec, onClose }) {
  const totalMin = plan[plan.length - 1].endMin;
  const elapsedMin = Math.min(elapsedSec / 60, totalMin);
  const summary = computeMinutesSummary(plan, availableIds, elapsedMin);

  const currentIv = plan.find((iv) => iv.startMin <= elapsedMin && elapsedMin < iv.endMin) ?? plan[plan.length - 1];
  const currentGkId = currentIv.onField.find((p) => p.isGk)?.id;

  const { spreadMin, continuousKeeperId, shiftEndsAt } = describeMinutesNote({
    summary, plan, elapsedMin, keeperEligibleIds,
  });
  const noteParts = [`Pitch time is within ${fmtMin(spreadMin)} across the squad.`];
  if (continuousKeeperId) {
    noteParts.push(`${nameOf(continuousKeeperId)} has kept all game — shift ends at ${shiftEndsAt}′.`);
  }

  // Keeper (the live one right now) pinned first, everyone else by pitch
  // time descending — README's own "Row order: by pitch time descending,
  // keeper first."
  const rows = [...summary].sort((a, b) => {
    if (a.id === currentGkId) return -1;
    if (b.id === currentGkId) return 1;
    return b.outfieldMin - a.outfieldMin;
  });

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
        <span style={styles.mdSubHeaderChip}>{fmtClock(elapsedSec)}</span>
      </div>

      <div style={styles.mdMinutesNote}>{noteParts.join(" ")}</div>

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
