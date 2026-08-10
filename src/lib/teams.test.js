import { describe, it, expect } from "vitest";
import { defaultSettings, normalizeTeam, createTeam, migrateLegacyTeam, findTeam, addTeam, updateTeam } from "./teams.js";

describe("defaultSettings", () => {
  it("returns the expected defaults", () => {
    expect(defaultSettings()).toEqual({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 });
  });
});

describe("normalizeTeam", () => {
  it("fills in an id and name when missing", () => {
    const team = normalizeTeam({ roster: [], settings: {} });
    expect(typeof team.id).toBe("string");
    expect(team.id.length).toBeGreaterThan(0);
    expect(team.name).toBe("My Team");
  });

  it("keeps an existing id and name", () => {
    const team = normalizeTeam({ id: "abc", name: "Scorpions", roster: [], settings: {} });
    expect(team.id).toBe("abc");
    expect(team.name).toBe("Scorpions");
  });

  it("defaults keeperEligible to true for roster entries that don't specify it", () => {
    const team = normalizeTeam({ roster: [{ id: "p1", name: "A" }, { id: "p2", name: "B", keeperEligible: false }] });
    expect(team.roster[0].keeperEligible).toBe(true);
    expect(team.roster[1].keeperEligible).toBe(false);
  });

  it("merges settings over the defaults rather than replacing them wholesale", () => {
    const team = normalizeTeam({ roster: [], settings: { gameMinutes: 60 } });
    expect(team.settings).toEqual({ fieldSize: 5, gameMinutes: 60, subIntervalMinutes: 6 });
  });

  it("handles a completely empty input", () => {
    const team = normalizeTeam({});
    expect(team.roster).toEqual([]);
    expect(team.settings).toEqual(defaultSettings());
  });
});

describe("createTeam", () => {
  it("creates an empty team with the given name", () => {
    const team = createTeam("Scorpions");
    expect(team.name).toBe("Scorpions");
    expect(team.roster).toEqual([]);
    expect(team.settings).toEqual(defaultSettings());
    expect(typeof team.id).toBe("string");
  });

  it("two created teams get different ids", () => {
    const a = createTeam("A");
    const b = createTeam("B");
    expect(a.id).not.toBe(b.id);
  });
});

describe("migrateLegacyTeam", () => {
  it("wraps a legacy { roster, settings } shape into a named team, preserving the roster exactly", () => {
    const legacy = {
      roster: [
        { id: "p1", name: "Jack", keeperEligible: true },
        { id: "p2", name: "Atu", keeperEligible: false },
      ],
      settings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
    };
    const migrated = migrateLegacyTeam(legacy);
    expect(migrated.name).toBe("My Team");
    expect(migrated.roster).toEqual(legacy.roster);
    expect(migrated.settings).toEqual(legacy.settings);
    expect(typeof migrated.id).toBe("string");
  });

  it("accepts a custom name", () => {
    const migrated = migrateLegacyTeam({ roster: [], settings: {} }, "Scorpions");
    expect(migrated.name).toBe("Scorpions");
  });
});

describe("findTeam / addTeam / updateTeam", () => {
  const teamA = createTeam("A");
  const teamB = createTeam("B");
  const teams = [teamA, teamB];

  it("findTeam finds by id, or returns null", () => {
    expect(findTeam(teams, teamA.id)).toEqual(teamA);
    expect(findTeam(teams, "nonexistent")).toBe(null);
  });

  it("addTeam appends without mutating the original array", () => {
    const teamC = createTeam("C");
    const updated = addTeam(teams, teamC);
    expect(updated.length).toBe(3);
    expect(teams.length).toBe(2); // original untouched
  });

  it("updateTeam replaces only the matching team's fields, leaving others untouched", () => {
    const updated = updateTeam(teams, teamA.id, { name: "Renamed A" });
    expect(findTeam(updated, teamA.id).name).toBe("Renamed A");
    expect(findTeam(updated, teamB.id).name).toBe("B"); // unaffected
    expect(teams[0].name).toBe("A"); // original untouched
  });

  it("updateTeam is a no-op if the id doesn't match any team", () => {
    const updated = updateTeam(teams, "nonexistent", { name: "X" });
    expect(updated).toEqual(teams);
  });
});
