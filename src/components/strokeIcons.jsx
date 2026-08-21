// Drawn (stroke, not solid-fill) icons shared across more than one screen —
// a deliberately different visual family from matchDayIcons.jsx (that
// file's icons are explicitly solid-fill by design). fill="none"/round
// caps+joins on every one, matching the app's one drawn-icon convention.
//
// Most of this family (goalkeeper-glove, swap, breaks, squad) still lives
// local to SquadSettingsForm.jsx, the only place they're used. RotateIcon
// moved here once MatchView's own Reset button needed the exact glyph
// SquadSettingsForm's "rebuild rotation" confirm sheet already used —
// real-use feedback liked it enough to ask for it reused, not redrawn.
import { tokens } from "./styles.js";

export function RotateIcon({ size = 20, color = tokens.color.deepGreen, strokeWidth = 2.1 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 5.5v5h-5" />
      <path d="M19.5 10.2A8 8 0 1 0 12 20" />
    </svg>
  );
}
