// Lay out the on-field players into a formation (GK + 2 or 3 outfield rows).
// Splits outfielders evenly across however many rows fit the headcount —
// 3 rows once there are enough outfielders to make that look sensible
// (5+), otherwise the original 2-row back/front split. Deliberately not
// position-based (no "these are the defenders" data anywhere) — purely an
// even visual spread, same as before, just generalized to more than 2 rows.
//
// Row 0 (first slice of `outfielders`) always lands nearest the goal, the
// last row furthest away — matches the pre-existing back/front convention.
//
// Row-to-row vertical spread. The back row (nearest goal) sits at
// BACK_ROW_TOP_PCT, the front row (furthest from goal) at
// FRONT_ROW_TOP_PCT, with any middle row(s) evenly between. Both moved up
// (was 67/25) per real-use feedback showing the whole formation sitting
// too low, leaving the top of the pitch empty above the front row while
// crowding the halfway line — shifting both up uses that empty space
// instead. Not shifted by an equal amount this time: the back row had a
// lot of slack before the goal box and could move up more than the front
// row needed to. A 3-row formation's middle row still lands at the
// midpoint of the two, same as before.
//
// The 3-row case gets its own, smaller FRONT_ROW_TOP_PCT/GK topPct pair
// rather than reusing the 2-row ones — real-device feedback on a big
// roster (7+ outfielders, 3 rows) showed a lot of dead green below the
// goalkeeper with the top row comparatively cramped. That's because the
// 2-row pair was tuned against a *shorter* pitch card (see
// MatchView.jsx's pitchInnerHeight) — reused at the taller 3-row card
// height, the same percentages scale up into far more absolute pixels of
// clearance at the bottom (GK) than at the top (front row), which is
// exactly the asymmetry that showed up. FRONT_ROW_TOP_PCT_3ROW and
// GK_TOP_PCT_3ROW are deliberately symmetric (14 and 100-14) so both ends
// get equal clearance regardless of card height.
const BACK_ROW_TOP_PCT = 56;
const FRONT_ROW_TOP_PCT = 18;
const FRONT_ROW_TOP_PCT_3ROW = 14;
const GK_TOP_PCT_3ROW = 100 - FRONT_ROW_TOP_PCT_3ROW;

export function getFormationLayout(onField) {
  const gk = onField.find((p) => p.isGk);
  const outfielders = onField.filter((p) => !p.isGk);
  const numRows = outfielders.length > 4 ? 3 : 2;
  const frontRowTopPct = numRows === 3 ? FRONT_ROW_TOP_PCT_3ROW : FRONT_ROW_TOP_PCT;

  const perRow = Math.ceil(outfielders.length / numRows);
  const rows = [];
  for (let i = 0; i < numRows; i++) {
    const row = outfielders.slice(i * perRow, (i + 1) * perRow);
    if (row.length > 0) rows.push(row);
  }

  // The evenly-divided position (e.g. 33%/67% for a row of 2) sits closer
  // to the center circle than looks right on a real pitch — stretched
  // 1.35x further from center (50%) so players read as spread out
  // diagonally away from it, not clustered around it. A lone player in a
  // row (raw position already 50) is unaffected — nothing to stretch away
  // from when there's only one of them.
  const spread = (row, topPct) =>
    row.map((p, i) => {
      const raw = ((i + 1) / (row.length + 1)) * 100;
      const leftPct = Math.max(6, Math.min(94, 50 + (raw - 50) * 1.35));
      return { ...p, topPct, leftPct };
    });

  // Evenly spaced from BACK_ROW_TOP_PCT (nearest goal) down to
  // frontRowTopPct (furthest forward), however many rows actually exist
  // spaced between them. A single row (e.g. a genuinely tiny game) falls
  // back to sitting at the midpoint.
  const gap = rows.length > 1 ? (BACK_ROW_TOP_PCT - frontRowTopPct) / (rows.length - 1) : 0;
  const laidOut = rows.flatMap((row, i) => spread(row, BACK_ROW_TOP_PCT - i * gap));

  // 78 (2-row case): moved up from 88 on real-device feedback ("goalkeeper
  // badge needs to move up from the bottom") — with the bigger tokens
  // (computeTokenSize) and taller name label underneath, 88 left the
  // keeper's own name crowded right up against (or clipped by) the pitch
  // card's bottom edge. GK_TOP_PCT_3ROW (86) is the 3-row case's own,
  // separately-tuned value — see the comment above frontRowTopPct.
  const gkTopPct = numRows === 3 ? GK_TOP_PCT_3ROW : 78;
  return [...(gk ? [{ ...gk, topPct: gkTopPct, leftPct: 50 }] : []), ...laidOut];
}

// How big a pitch token should render, purely based on how many outfielders
// are sharing the pitch right now — a small game (4 or fewer outfielders,
// the common 5-a-side case) gets the full 48px size; busier games get
// progressively smaller tokens so a 3-row formation doesn't overlap itself
// on a phone-width screen. Bumped up from 40/34/28 on real-device feedback
// ("the badges and names are too small").
export function computeTokenSize(outfieldCount) {
  if (outfieldCount <= 4) return 48;
  if (outfieldCount <= 6) return 40;
  return 34;
}
