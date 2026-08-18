import { describe, it, expect } from "vitest";
import { getSquadNumber } from "./squadNumber.js";

describe("getSquadNumber", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("uses the player's real number when they have one set", () => {
    expect(getSquadNumber({ id: "b", number: 9 }, roster)).toBe(9);
  });

  it("falls back to 1-based roster position when no number is set", () => {
    expect(getSquadNumber({ id: "a" }, roster)).toBe(1);
    expect(getSquadNumber({ id: "c" }, roster)).toBe(3);
  });

  it("treats a real number of 0 as set, not missing", () => {
    // 0 is a legitimate (if unusual) squad number — only null/undefined
    // should trigger the fallback, not falsiness.
    expect(getSquadNumber({ id: "a", number: 0 }, roster)).toBe(0);
  });

  it("returns a safe placeholder for a player who isn't in the roster at all", () => {
    expect(getSquadNumber({ id: "ghost" }, roster)).toBe("?");
  });
});
