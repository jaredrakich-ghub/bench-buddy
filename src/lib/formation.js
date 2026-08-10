// Lay out the on-field players into a formation (GK + two rows), e.g. 1-2-2
// for a 5-a-side team. Splits outfielders evenly across a back and front row.
export function getFormationLayout(onField) {
  const gk = onField.find((p) => p.isGk);
  const outfielders = onField.filter((p) => !p.isGk);
  const backCount = Math.ceil(outfielders.length / 2);
  const back = outfielders.slice(0, backCount);
  const front = outfielders.slice(backCount);

  const spread = (row, topPct) =>
    row.map((p, i) => ({ ...p, topPct, leftPct: ((i + 1) / (row.length + 1)) * 100 }));

  return [...(gk ? [{ ...gk, topPct: 88, leftPct: 50 }] : []), ...spread(back, 62), ...spread(front, 30)];
}
