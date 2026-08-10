// Pure data-management functions for the multi-team registry. Kept
// separate from React/storage so the shape rules (what a team looks like,
// how legacy single-team data becomes a team) are readable and testable on
// their own — same pattern as rotation.js/clock.js/formation.js.

import { generateId } from "./id.js";

// The default settings a brand-new team starts with.
export function defaultSettings() {
  return { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 };
}

// Normalizes a raw/loaded team object into the shape the rest of the app
// expects: a real id, a name, every roster entry defaulting keeperEligible
// to true (matches the original single-team behavior), and settings merged
// over the defaults so an older or partial settings object still works.
export function normalizeTeam(raw) {
  return {
    id: raw.id || generateId(),
    name: raw.name || "My Team",
    roster: (raw.roster || []).map((p) => ({ ...p, keeperEligible: p.keeperEligible !== false })),
    settings: { ...defaultSettings(), ...(raw.settings || {}) },
  };
}

// A brand-new, empty team.
export function createTeam(name) {
  return normalizeTeam({ name, roster: [], settings: defaultSettings() });
}

// Wraps a single legacy team-data-v2-shaped object ({ roster, settings },
// no id/name) into the new multi-team shape — used once, to migrate an
// existing single-team user's data without losing it.
export function migrateLegacyTeam(legacyData, name = "My Team") {
  return normalizeTeam({ ...legacyData, name });
}

export function findTeam(teams, id) {
  return teams.find((t) => t.id === id) || null;
}

export function addTeam(teams, team) {
  return [...teams, team];
}

// Replaces one team's data (roster/settings/name/etc.) by id, leaving the
// others untouched.
export function updateTeam(teams, id, updates) {
  return teams.map((t) => (t.id === id ? { ...t, ...updates } : t));
}

export function removeTeam(teams, id) {
  return teams.filter((t) => t.id !== id);
}
