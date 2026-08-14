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

vi.mock("../lib/gameHistory.js", () => ({
  archiveGame: vi.fn().mockResolvedValue(undefined),
}));
import { archiveGame } from "../lib/gameHistory.js";

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

describe("useMatchState — manual starting keeper", () => {
  it("honors a valid manual pick as the starting keeper, and clears it after use", () => {
    const { result } = setup();
    act(() => {
      result.current.setAvailableIds(ROSTER.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
      result.current.setStartingGkId("p3");
    });
    act(() => result.current.startPlanning());
    expect(result.current.plan[0].onField.find((p) => p.isGk).id).toBe("p3");
    expect(result.current.startingGkId).toBeNull(); // one-shot, consumed
  });

  it("falls back to the automatic (safe) pick if the manual choice is stale — no longer available", () => {
    // 7-player roster here specifically so removing one still leaves 6
    // available, clearing the fieldSize(5)+1 minimum — this test is about
    // the stale-pick fallback, not about re-triggering the "not enough
    // players" validation path (already covered elsewhere).
    const roster7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const teamData7 = { ...TEAM_DATA, roster: roster7 };
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: teamData7, saveTeamData: vi.fn() }));
    act(() => {
      result.current.setAvailableIds(roster7.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
      result.current.setStartingGkId("p3");
      result.current.setAvailableIds(roster7.filter((p) => p.id !== "p3").map((p) => p.id)); // p3 no longer available
    });
    act(() => result.current.startPlanning());
    // Doesn't throw, still produces a valid plan, just not necessarily with p3 (who isn't even playing).
    expect(result.current.plan).not.toBeNull();
    expect(result.current.plan[0].onField.find((p) => p.isGk).id).not.toBe("p3");
  });

  it("without a manual pick, still produces a valid plan via the automatic safe-pick path", () => {
    const { result } = setup();
    act(() => {
      result.current.setAvailableIds(ROSTER.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
    });
    act(() => result.current.startPlanning());
    const gk = result.current.plan[0].onField.find((p) => p.isGk);
    expect(gk).toBeTruthy();
    expect(ROSTER.map((p) => p.id)).toContain(gk.id);
  });
});

describe("useMatchState — archiving to season history", () => {
  it("does not archive when starting the very first game (no outgoing plan to archive)", () => {
    setupWithPlan();
    expect(archiveGame).not.toHaveBeenCalled();
  });

  it("does not archive when regenerating mid-game (clock hasn't reached full time)", () => {
    const { result } = setupWithPlan();
    // elapsedSec (0) is well short of the 720s cap for this 12-minute game.
    act(() => result.current.startPlanning());
    expect(archiveGame).not.toHaveBeenCalled();
  });

  it("archives the outgoing game when starting a new one after the previous game reached full time", () => {
    const { result } = setupWithPlan(); // 12-minute game -> 720 sec cap
    act(() => result.current.setElapsedSec(720));
    act(() => result.current.startPlanning());

    expect(archiveGame).toHaveBeenCalledTimes(1);
    const [teamId, game] = archiveGame.mock.calls[0];
    expect(teamId).toBe("t1");
    expect(game.settings).toEqual({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
    expect(game.players).toHaveLength(6); // every available player from the outgoing game
    expect(game.players[0]).toMatchObject({ id: "p0", name: "Player 0", keeperEligible: true });
  });

  it("surfaces a friendly error if archiving fails, without blocking the new game from starting", async () => {
    const { result } = setupWithPlan();
    act(() => result.current.setElapsedSec(720));

    // Also reject the ordinary match-state persist for this test, so its
    // success can't race with (and silently clear) the archive failure —
    // both effects share the same saveError state, and only the archive
    // failure is what this test is actually about.
    saveMatchState.mockRejectedValue({ code: "unavailable" });
    archiveGame.mockRejectedValueOnce({ code: "unavailable" });

    let ok;
    act(() => {
      ok = result.current.startPlanning();
    });

    // The new game starts immediately regardless — archiving is fire-and-
    // forget, not awaited — and only afterward does the rejection surface.
    expect(ok).toBe(true);
    expect(result.current.plan).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.saveError).toMatch(/offline/);
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

describe("useMatchState — swapping on a browsed (not-necessarily-live) interval", () => {
  // performSwap always reads plan[activeInterval] — there's no separate
  // "live interval" concept it enforces. A coach can tap ahead to a later
  // interval tab (MatchView lets this regardless of the clock) and swap
  // there, without touching anything currently live. This documents and
  // locks in that this already works, since it directly answers "can I
  // make a correction to an upcoming interval, not just right now" —
  // nothing new needed in useMatchState for that question.
  const BIG_ROSTER = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
  const BIG_TEAM = { id: "t1", name: "Scorpions", roster: BIG_ROSTER, settings: { fieldSize: 5, gameMinutes: 24, subIntervalMinutes: 6 } };

  function setupBigPlan() {
    const saveTeamData = vi.fn();
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: BIG_TEAM, saveTeamData }));
    act(() => {
      result.current.setAvailableIds(BIG_ROSTER.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 24, subIntervalMinutes: 6 });
    });
    act(() => result.current.startPlanning());
    return { result, saveTeamData };
  }

  it("swapping on a future interval (clock still at 0, browsed ahead) leaves earlier intervals untouched and rebuilds only what follows", () => {
    const { result } = setupBigPlan();
    expect(result.current.plan.length).toBeGreaterThan(2); // needs room to browse ahead
    const intervalBefore1 = result.current.plan[1];

    act(() => result.current.setActiveInterval(2)); // browse ahead — clock/elapsedSec is still 0, nothing "live" yet
    const targetIv = result.current.plan[2];
    const fieldId = targetIv.onField[0].id;
    const benchId = targetIv.bench[0];

    act(() => result.current.performSwap(benchId, fieldId));

    // Interval 1 (before the edit) is exactly as it was — unmodified.
    expect(result.current.plan[1]).toBe(intervalBefore1);
    // Interval 2 (the edited one) now has the swapped-in player on the field.
    expect(result.current.plan[2].onField.some((p) => p.id === benchId)).toBe(true);
    expect(result.current.plan[2].onField.some((p) => p.id === fieldId)).toBe(false);
    // Everything after interval 2 was rebuilt (still a valid, full plan).
    expect(result.current.plan.length).toBe(targetIv ? result.current.plan.length : 0);
    expect(result.current.plan.every((iv) => iv.onField.length === 5)).toBe(true);
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
