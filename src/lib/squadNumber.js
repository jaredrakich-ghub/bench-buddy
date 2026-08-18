// The match-day redesign puts a squad number on every shirt (see
// design_handoff_bench_buddy_match_day/README.md), which today's roster
// data doesn't have — entries are just { id, name, keeperEligible }. A real,
// coach-assignable `number` field is being added to the roster in the setup
// step of this redesign (SquadSettingsForm.jsx); until a player has one set,
// this falls back to their 1-based position in the roster so every shirt has
// *something* to show in the meantime. Once a real number is set, it always
// wins — the fallback only ever fills a genuine gap, never overrides.
export function getSquadNumber(player, roster) {
  if (player?.number != null) return player.number;
  const idx = roster.findIndex((p) => p.id === player?.id);
  return idx === -1 ? "?" : idx + 1;
}
