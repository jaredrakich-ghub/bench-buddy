// @vitest-environment jsdom
//
// Tests useMatchState against a mocked firestoreTeams.js. The rotation
// algorithm itself (generatePlan, resolveBringBack, etc.) already has
// thorough coverage in rotation.test.js — these tests are about the things
// only this hook does: the startPlanning() success/failure contract (the
// exact thing that broke once already — see the "Save & Regenerate doesn't
// close the modal" fix), the guard clauses in handleInjury/bringBack/
// performSwap, persisting to Firestore, and the clock tick.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useMatchState } from "./useMatchState.js";

vi.mock("../lib/firestoreTeams.js", () => ({
  saveMatchState: vi.fn().mockResolvedValue(undefined),
  describeSaveError: (err) => (err?.code === "unavailable" ? "You're offline — changes will sync once you're back online." : "Couldn't save."),
}));
import { saveMatchState } from "../lib/firestoreTeams.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ROSTER = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
const TEAM_DATA = { id: "t1", name: "Scorpions", roster: ROSTER, settings: { fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 } };

function setup() {
  const saveTeamData = vi.fn();
  const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: TEAM_DATA, saveTeamData }));
  return { result, saveTeamData };
}

// Shared setup for tests that need an actual generated plan to act on.
function setupWithPlan() {
  const { result, saveTeamData } = setup();
  act(() => {
    result.current.setAvailableIds(ROSTER.map((p) => p.id));
    result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
  });
  act(() => result.current.startPlanning());
  return { result, saveTeamData };
}

describe("useMatchState — startPlanning", () => {
  it("returns false and generates nothing when settings are invalid (not enough available players)", () => {
    const { result, saveTeamData } = setup();
    let ok;
    act(() => {
      ok = result.current.startPlanning();
    });
    expect(ok).toBe(false);
    expect(result.current.plan).toBeNull();
    expect(saveTeamData).not.toHaveBeenCalled();
  });

  it("returns true, generates a plan, saves the settings, and resets match state when valid", () => {
    const { result, saveTeamData } = setup();
    act(() => {
      result.current.setAvailableIds(ROSTER.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
    });
    let ok;
    act(() => {
      ok = result.current.startPlanning();
    });
    expect(ok).toBe(true);
    expect(result.current.plan).not.toBeNull();
    expect(result.current.plan.length).toBeGreaterThan(0);
    expect(result.current.activeInterval).toBe(0);
    expect(result.current.injuredThisGame).toEqual([]);
    expect(saveTeamData).toHaveBeenCalledWith(
      expect.objectContaining({ settings: { fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 } })
    );
  });
});

describe("useMatchState — guard clauses", () => {
  it("handleInjury does nothing if the player is already marked injured", () => {
    const { result } = setupWithPlan();
    act(() => result.current.handleInjury("p0"));
    const planAfterFirstInjury = result.current.plan;
    act(() => result.current.handleInjury("p0")); // already injured
    expect(result.current.plan).toBe(planAfterFirstInjury); // nothing rebuilt — same reference
  });

  it("bringBack does nothing if the player was never marked injured", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => result.current.bringBack("p0"));
    expect(result.current.plan).toBe(planBefore);
  });

  it("performSwap does nothing if the given field player isn't actually on the current interval", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => result.current.performSwap("some-bench-id", "not-a-real-field-id"));
    expect(result.current.plan).toBe(planBefore);
  });
});

describe("useMatchState — persisting to Firestore", () => {
  it("does not save while there's no plan yet", async () => {
    setup();
    await act(async () => {
      await Promise.resolve();
    });
    expect(saveMatchState).not.toHaveBeenCalled();
  });

  it("saves match state once a plan exists", async () => {
    const { result } = setupWithPlan();
    await act(async () => {
      await Promise.resolve();
    });
    expect(saveMatchState).toHaveBeenCalledWith("t1", expect.objectContaining({ plan: result.current.plan, activeInterval: 0 }));
  });

  it("surfaces a friendly error if the save fails", async () => {
    saveMatchState.mockRejectedValueOnce({ code: "unavailable" });
    const { result } = setupWithPlan();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve(); // rejection needs an extra microtask turn to settle
    });
    expect(result.current.saveError).toMatch(/offline/);
  });
});

describe("useMatchState — clock tick", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances elapsedSec once running, and freezes at full time instead of running past it", () => {
    const { result } = setupWithPlan(); // 12-minute game -> 720 sec cap
    act(() => {
      result.current.setRunStartedAt(Date.now());
      result.current.setTimerRunning(true);
    });

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.elapsedSec).toBeGreaterThanOrEqual(4);
    expect(result.current.elapsedSec).toBeLessThanOrEqual(6);

    act(() => vi.advanceTimersByTime(800_000)); // well past the 720s cap
    expect(result.current.elapsedSec).toBe(720);
    expect(result.current.timerRunning).toBe(false);
  });
});
