import { describe, it, expect } from "vitest";
import { fmtClock } from "./SubRotationPlanner.jsx";

// fmtClock is a display-formatting helper (not part of the rotation
// algorithm), so it stays in the component file rather than moving to
// src/lib/rotation.js — but it's still a plain function worth testing
// in isolation.
describe("fmtClock", () => {
  it("formats whole minutes and seconds", () => {
    expect(fmtClock(0)).toBe("0:00");
    expect(fmtClock(65)).toBe("1:05");
    expect(fmtClock(125)).toBe("2:05");
  });

  it("pads single-digit seconds", () => {
    expect(fmtClock(61)).toBe("1:01");
  });

  it("clamps negative input to zero instead of going negative", () => {
    expect(fmtClock(-10)).toBe("0:00");
  });

  it("rounds fractional seconds", () => {
    expect(fmtClock(59.6)).toBe("1:00");
  });
});
