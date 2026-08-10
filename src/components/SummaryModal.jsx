import { X } from "lucide-react";
import { computeMinutesSummary } from "../lib/rotation.js";
import { styles } from "./styles.js";

// Minutes-summary modal: totals each available player's outfield/keeper/
// bench (and injured, if any happened) minutes across the full generated
// plan. Self-contained — only needs the plan, who's available, and a way
// to look up a player's name.
export default function SummaryModal({ plan, availableIds, nameOf, onClose }) {
  const summary = computeMinutesSummary(plan, availableIds);
  const anyInjured = summary.some((r) => r.injuredMin > 0);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Minutes Summary</h3>
          <button style={styles.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p style={styles.backupHint}>
          Based on the full {plan[plan.length - 1].endMin}-minute rotation as planned — this updates the moment you
          regenerate or edit the game.
        </p>
        <div style={styles.summaryTable}>
          <div style={{ ...styles.summaryRow, ...styles.summaryHeadRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
            <span style={styles.summaryName}>Player</span>
            <span>Outfield</span>
            <span>Keeper</span>
            <span>Bench</span>
            {anyInjured && <span>Injured</span>}
          </div>
          {summary
            .slice()
            .sort((a, b) => b.outfieldMin + b.gkMin - (a.outfieldMin + a.gkMin))
            .map((r) => (
              <div key={r.id} style={{ ...styles.summaryRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
                <span style={styles.summaryName}>{nameOf(r.id)}</span>
                <span>{Math.round(r.outfieldMin)}</span>
                <span>{Math.round(r.gkMin)}</span>
                <span>{Math.round(r.benchMin)}</span>
                {anyInjured && <span>{r.injuredMin > 0 ? Math.round(r.injuredMin) : "—"}</span>}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
