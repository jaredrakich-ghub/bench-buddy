import { describe, it, expect, vi, afterEach } from "vitest";
import { computeLiveElapsedSec, fmtClock } from "./clock.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("computeLiveElapsedSec", () => {
  it("returns the frozen base value when paused (no start timestamp)", () => {
    expect(computeLiveElapsedSec(120, null, 3000)).toBe(120);
  });

  it("adds real elapsed time since the run started when running", () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    vi.advanceTimersByTime(65_000); // 65 real seconds pass
    expect(computeLiveElapsedSec(100, startedAt, 3000)).toBeCloseTo(165, 0);
  });

  it("catches up correctly even after a long gap (e.g. the app was backgrounded)", () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes away, e.g. tab got reloaded
    expect(computeLiveElapsedSec(0, startedAt, 3000)).toBeCloseTo(240, 0);
  });

  it("clamps at capSec once the match has run its full length (match over, stop counting)", () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    vi.advanceTimersByTime(10 * 60 * 1000); // way past the cap
    expect(computeLiveElapsedSec(0, startedAt, 300)).toBe(300);
  });

  it("a paused value already past the cap is still clamped for display", () => {
    expect(computeLiveElapsedSec(999, null, 300)).toBe(300);
  });

  it("never goes negative even with a bad/future startedAt", () => {
    const future = Date.now() + 10_000;
    expect(computeLiveElapsedSec(0, future, 3000)).toBe(0);
  });
});

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
