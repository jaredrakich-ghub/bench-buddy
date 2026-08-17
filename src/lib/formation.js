// Lay out the on-field players into a formation (GK + 2 or 3 outfield rows).
// Splits outfielders evenly across however many rows fit the headcount —
// 3 rows once there are enough outfielders to make that look sensible
// (5+), otherwise the original 2-row back/front split. Deliberately not
// position-based (no "these are the defenders" data anywhere) — purely an
// even visual spread, same as before, just generalized to more than 2 rows.
//
// Row 0 (first slice of `outfielders`) always lands nearest the goal, the
// last row furthest away — matches the pre-existing back/front convention,
// so a 2-row game (the common 5-a-side case) produces byte-for-byte the
// same topPct values as before (62/30), not just a visually similar result.
export function getFormationLayout(onField) {
  const gk = onField.find((p) => p.isGk);
  const outfielders = onField.filter((p) => !p.isGk);
  const numRows = outfielders.length > 4 ? 3 : 2;

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

  // Evenly spaced from 62 (nearest goal) down to 30 (furthest forward) —
  // the same two endpoints the original 2-row layout used, just with
  // however many rows actually exist spaced between them. A single row
  // (e.g. a genuinely tiny game) falls back to sitting at the midpoint.
  const gap = rows.length > 1 ? 32 / (rows.length - 1) : 0;
  const laidOut = rows.flatMap((row, i) => spread(row, 62 - i * gap));

  return [...(gk ? [{ ...gk, topPct: 88, leftPct: 50 }] : []), ...laidOut];
}

// How big a pitch token should render, purely based on how many outfielders
// are sharing the pitch right now — a small game (4 or fewer outfielders,
// the common 5-a-side case) gets today's full 40px size; busier games get
// progressively smaller tokens so a 3-row formation doesn't overlap itself
// on a phone-width screen.
export function computeTokenSize(outfieldCount) {
  if (outfieldCount <= 4) return 40;
  if (outfieldCount <= 6) return 34;
  return 28;
}
