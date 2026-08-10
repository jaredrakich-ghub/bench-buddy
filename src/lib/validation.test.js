import { describe, it, expect } from "vitest";
import { validateGameSettings } from "./validation.js";

const goodSettings = { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 15 };

describe("validateGameSettings", () => {
  it("is valid for sensible settings with enough available players", () => {
    expect(validateGameSettings(goodSettings, 7)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a sub interval of 0 (the case that would otherwise hang the tab)", () => {
    const result = validateGameSettings({ ...goodSettings, subIntervalMinutes: 0 }, 7);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Sub interval must be greater than 0 minutes.");
  });

  it("rejects a negative sub interval", () => {
    const result = validateGameSettings({ ...goodSettings, subIntervalMinutes: -5 }, 7);
    expect(result.valid).toBe(false);
  });

  it("rejects a game length of 0 or less", () => {
    expect(validateGameSettings({ ...goodSettings, gameMinutes: 0 }, 7).valid).toBe(false);
    expect(validateGameSettings({ ...goodSettings, gameMinutes: -10 }, 7).valid).toBe(false);
  });

  it("rejects fewer than 2 players on the field", () => {
    expect(validateGameSettings({ ...goodSettings, fieldSize: 1 }, 7).valid).toBe(false);
    expect(validateGameSettings({ ...goodSettings, fieldSize: 0 }, 7).valid).toBe(false);
  });

  it("rejects non-numeric values (e.g. a field left as an empty string)", () => {
    expect(validateGameSettings({ ...goodSettings, gameMinutes: "" }, 7).valid).toBe(false);
    expect(validateGameSettings({ ...goodSettings, subIntervalMinutes: NaN }, 7).valid).toBe(false);
  });

  it("treats a blank/undefined keeperShiftMinutes as valid (means 'same as sub interval')", () => {
    expect(validateGameSettings({ ...goodSettings, keeperShiftMinutes: "" }, 7).valid).toBe(true);
    expect(validateGameSettings({ ...goodSettings, keeperShiftMinutes: undefined }, 7).valid).toBe(true);
  });

  it("rejects a negative keeperShiftMinutes when one is actually set", () => {
    expect(validateGameSettings({ ...goodSettings, keeperShiftMinutes: -3 }, 7).valid).toBe(false);
  });

  it("rejects fewer than 2 available players", () => {
    expect(validateGameSettings(goodSettings, 1).valid).toBe(false);
    expect(validateGameSettings(goodSettings, 0).valid).toBe(false);
  });

  it("reports multiple errors at once when several fields are invalid", () => {
    const result = validateGameSettings({ fieldSize: 0, gameMinutes: 0, subIntervalMinutes: 0 }, 0);
    expect(result.errors.length).toBe(4);
  });
});
