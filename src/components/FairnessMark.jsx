import { getFairnessState } from "../lib/fairness.js";
import { tokens } from "./styles.js";

// One mark, three states — a balance beam inside a ringed circle. The BEAM
// ANGLE carries the meaning (not just the ring colour), so it stays
// readable down to 32px and for anyone who can't rely on colour alone.
// Used both on the rotation-progress success card (44px) and the
// mid-match fairness toast (32px, thinner ring) — same glyph, same
// circle, only the ring colour and the beam's own rotation ever change,
// so a coach recognises this as the one "fairness" symbol wherever it
// shows up.
// intervalLen: the length in minutes of one sub-interval in this game's
// own rotation — the fairness bands scale with it (getFairnessState,
// fairness.js), not a fixed minute count, since a given gap in minutes
// means something different for a short sub window than a long one.
// gameMinutes: the whole game's own length — real-use feedback, the same
// gap also means something different in a 20-minute game than a 60-minute
// one, which intervalLen alone can't capture; see getFairnessState's own
// comment for the validated combination rule.
export default function FairnessMark({ spreadMin, intervalLen, gameMinutes, size = 44, ringWidth = 3, glyphSize = 22 }) {
  const { ring, tilt, label } = getFairnessState(spreadMin, intervalLen, gameMinutes);
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        width: size, height: size, borderRadius: "50%", boxSizing: "border-box",
        border: `${ringWidth}px solid ${ring}`, background: tokens.color.creamPaper,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <svg
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={tokens.color.deepGreen}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform={`rotate(${tilt} 12 8)`}>
          <path d="M4 8h16" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="20" cy="8" r="1.5" />
        </g>
        <path d="M12 8v7" />
        <path d="M8.5 19l3.5-4 3.5 4z" />
      </svg>
    </div>
  );
}
