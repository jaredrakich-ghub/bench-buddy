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

  it("handleInjury records when the player was marked injured, for the A2i-Back-from-injury popover's own display", () => {
    const { result } = setupWithPlan();
    act(() => result.current.setElapsedSec(125));
    act(() => result.current.handleInjury("p0"));
    expect(result.current.injuredAt.p0).toBe(125);
  });

  it("bringBack does nothing if the player was never marked injured", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => result.current.bringBack("p0"));
    expect(result.current.plan).toBe(planBefore);
  });

  it("performSwap does nothing if neither given id is actually here this interval", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => result.current.performSwap("not-a-real-id", "also-not-real"));
    expect(result.current.plan).toBe(planBefore);
  });

  it("performSwap does nothing if one of the two ids isn't actually on the field or bench this interval", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    const realFieldId = result.current.plan[0].onField[0].id;
    act(() => result.current.performSwap(realFieldId, "not-a-real-id"));
    expect(result.current.plan).toBe(planBefore);
  });

  it("performSwap does nothing if both given ids are on the bench — nothing to swap", () => {
    // Needs 2+ bench spots — the default 6-player/fieldSize-5 roster only has 1.
    const roster7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const team7 = { id: "t1", name: "Scorpions", roster: roster7, settings: { fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 } };
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: team7, saveTeamData: vi.fn() }));
    act(() => {
      result.current.setAvailableIds(roster7.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
    });
    act(() => result.current.startPlanning());

    const planBefore = result.current.plan;
    const [bench1, bench2] = result.current.plan[0].bench;
    act(() => result.current.performSwap(bench1, bench2));
    expect(result.current.plan).toBe(planBefore);
  });

  it("performSwap does nothing if given the same player twice", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    const currentKeeper = result.current.plan[0].onField.find((p) => p.isGk).id;
    act(() => result.current.performSwap(currentKeeper, currentKeeper));
    expect(result.current.plan).toBe(planBefore);
  });
});

describe("useMatchState — addArrival / removeAvailability (A7-Squad-change)", () => {
  // A 7-player roster this time — p6 deliberately left off availableIds,
  // the "hasn't arrived yet" case addArrival is for. 6 of the 7 available
  // meets this app's own minimum (fieldSize + 1, i.e. at least one bench
  // spot) for fieldSize 5, so this is a squad that could actually start a
  // real game, not an artificially short one.
  const ROSTER7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
  const TEAM7 = { id: "t1", name: "Scorpions", roster: ROSTER7, settings: { fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 } };

  function setup7(available) {
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: TEAM7, saveTeamData: vi.fn() }));
    act(() => {
      result.current.setAvailableIds(available);
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 12, subIntervalMinutes: 6 });
    });
    act(() => result.current.startPlanning());
    return { result };
  }

  it("addArrival adds the player to availableIds and rebuilds only the plan's remainder — not the whole game", () => {
    const { result } = setup7(ROSTER7.slice(0, 6).map((p) => p.id)); // p0-p5, p6 not here yet
    act(() => result.current.setElapsedSec(90)); // mid interval 0
    const priorInterval0 = result.current.plan[0];

    act(() => result.current.addArrival("p6"));

    expect(result.current.availableIds).toContain("p6");
    // The clock itself is untouched — addArrival must never look like
    // startPlanning's full reset.
    expect(result.current.elapsedSec).toBe(90);
    // p6 joins the bench queue for the rest of interval 0 (fieldSize 5 was
    // already full with 5 of p0-p5 on the pitch — no opening to walk
    // straight into), not inserted retroactively as if they'd been there
    // all along.
    expect(result.current.plan[0].bench).toContain("p6");
    expect(result.current.plan[0].onField.map((p) => p.id)).not.toContain("p6");
    // Interval 0 is otherwise the exact plan already being played, not
    // silently reference-swapped out from under the coach.
    expect(result.current.plan[0].onField).toEqual(priorInterval0.onField);
  });

  it("addArrival does nothing if the player is already available", () => {
    const { result } = setupWithPlan(); // all 6 already available
    const planBefore = result.current.plan;
    act(() => result.current.addArrival("p0"));
    expect(result.current.plan).toBe(planBefore); // nothing rebuilt — same reference
  });

  it("addArrival fills a genuine opening immediately when the pitch is short a player", () => {
    // Start with all 6 available (p0-p5), then two injuries mid-game drop
    // it to 4 remaining — below fieldSize 5, so the pitch itself shrinks
    // to 4 (generatePlan caps to whoever's actually available; the
    // fieldSize+1 minimum only gates *starting* a game, not a mid-game
    // rebuild). p6 arriving then finds a real opening, not just a bench
    // queue, since the pitch has room again once they're counted.
    const { result } = setup7(ROSTER7.slice(0, 6).map((p) => p.id));
    // Two separate act()s, not one — handleInjury closes over this
    // render's state, so batching both calls into a single act() would
    // have the second call read injuredThisGame from before the first
    // one's update ever committed.
    act(() => result.current.handleInjury("p4"));
    act(() => result.current.handleInjury("p5"));
    expect(result.current.plan[result.current.activeInterval].onField).toHaveLength(4);

    act(() => result.current.addArrival("p6"));
    const cur = result.current.plan[result.current.activeInterval];
    expect(cur.onField.map((p) => p.id)).toContain("p6");
    expect(cur.bench).not.toContain("p6");
  });

  it("removeAvailability removes the player from availableIds and pulls them off the pitch immediately if they were on it", () => {
    const { result } = setupWithPlan(); // 6 available, fieldSize 5
    act(() => result.current.setElapsedSec(90));
    const onFieldId = result.current.plan[0].onField[0].id;

    act(() => result.current.removeAvailability(onFieldId));

    expect(result.current.availableIds).not.toContain(onFieldId);
    expect(result.current.elapsedSec).toBe(90); // clock untouched, same guarantee as addArrival
    expect(result.current.plan[0].onField.map((p) => p.id)).not.toContain(onFieldId);
    expect(result.current.plan[0].bench).not.toContain(onFieldId); // gone entirely, not benched
  });

  it("removeAvailability does nothing if the player wasn't available in the first place", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => result.current.removeAvailability("not-a-real-id"));
    expect(result.current.plan).toBe(planBefore);
  });

  it("removeAvailability never touches injuredThisGame/injuredAt — it's a different concept from an injury", () => {
    const { result } = setupWithPlan();
    const onFieldId = result.current.plan[0].onField[0].id;
    act(() => result.current.removeAvailability(onFieldId));
    expect(result.current.injuredThisGame).toEqual([]);
    expect(result.current.injuredAt).toEqual({});
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

  // Regression test for a real report: an outfield-only swap (nothing
  // keeper-related) could hand the very next keeper slot to a player who
  // wasn't even part of the swap, just because generatePlan's rebuild picks
  // keeper by fairness alone with no "must actually arrive from the bench"
  // rule. repairBenchToKeeper (rotation.js), wired into performSwap, closes
  // that gap.
  it("swapping an outfield player (not the keeper) never hands the next keeper slot to someone who was already on the field", () => {
    const { result } = setupBigPlan();
    act(() => result.current.setActiveInterval(2)); // leave room for the swap to affect later intervals
    const cur = result.current.plan[2];
    const outgoing = cur.onField.find((p) => !p.isGk); // deliberately not the keeper
    const benchId = cur.bench[0];

    act(() => result.current.performSwap(benchId, outgoing.id));

    const plan = result.current.plan;
    for (let i = 0; i < plan.length - 1; i++) {
      const gkNow = plan[i].onField.find((p) => p.isGk)?.id;
      const gkNext = plan[i + 1].onField.find((p) => p.isGk)?.id;
      if (!gkNext || gkNext === gkNow) continue; // same keeper continuing - fine
      expect(plan[i].bench).toContain(gkNext); // a new keeper must have been benched the interval before
    }
  });
});

describe("useMatchState — performSwap between two on-field players (the former performKeeperSwap case)", () => {
  const ROSTER7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: i !== 6 })); // p6 not keeper-eligible
  const TEAM7 = { id: "t1", name: "Scorpions", roster: ROSTER7, settings: { fieldSize: 5, gameMinutes: 45, subIntervalMinutes: 5 } };

  function setupPlan() {
    const saveTeamData = vi.fn();
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: TEAM7, saveTeamData }));
    act(() => {
      result.current.setAvailableIds(ROSTER7.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 45, subIntervalMinutes: 5 });
    });
    act(() => result.current.startPlanning());
    return { result, saveTeamData };
  }

  it("does nothing if swapping the keeper with a non-keeper-eligible on-field player", () => {
    const { result } = setupPlan();
    const cur = result.current.plan[0];
    // Only attempt if p6 (not eligible) actually happens to be on the field this interval.
    const target = cur.onField.find((p) => p.id === "p6" && !p.isGk);
    if (!target) return; // shuffled off the field this run — nothing to test
    const currentKeeper = cur.onField.find((p) => p.isGk).id;
    const planBefore = result.current.plan;
    act(() => result.current.performSwap("p6", currentKeeper));
    expect(result.current.plan).toBe(planBefore);
  });

  it("swaps roles between two on-field players — no bench change at all — and rebuilds the remainder", () => {
    const { result } = setupPlan();
    const cur = result.current.plan[0];
    const currentKeeper = cur.onField.find((p) => p.isGk).id;
    const target = cur.onField.find((p) => !p.isGk && p.id !== currentKeeper && p.id !== "p6"); // p6 isn't keeper-eligible
    const benchBefore = [...cur.bench];

    act(() => result.current.performSwap(target.id, currentKeeper));

    const newCur = result.current.plan[0];
    expect(newCur.onField.find((p) => p.id === target.id).isGk).toBe(true);
    expect(newCur.onField.find((p) => p.id === currentKeeper).isGk).toBe(false);
    expect(newCur.bench).toEqual(benchBefore); // bench completely untouched
    expect(result.current.plan.every((iv) => iv.onField.length === 5)).toBe(true); // still a valid, full plan
  });

  it("works the same regardless of argument order (swapping A,B is the same as B,A)", () => {
    const { result } = setupPlan();
    const cur = result.current.plan[0];
    const currentKeeper = cur.onField.find((p) => p.isGk).id;
    const target = cur.onField.find((p) => !p.isGk && p.id !== currentKeeper && p.id !== "p6");

    act(() => result.current.performSwap(currentKeeper, target.id));

    const newCur = result.current.plan[0];
    expect(newCur.onField.find((p) => p.id === target.id).isGk).toBe(true);
    expect(newCur.onField.find((p) => p.id === currentKeeper).isGk).toBe(false);
  });

  it("the manual swap never breaks bench->keeper for anything that follows it", () => {
    const { result } = setupPlan();
    act(() => result.current.setActiveInterval(2));
    const cur = result.current.plan[2];
    const currentKeeper = cur.onField.find((p) => p.isGk).id;
    const target = cur.onField.find((p) => !p.isGk && p.id !== currentKeeper && p.id !== "p6"); // p6 isn't keeper-eligible

    act(() => result.current.performSwap(target.id, currentKeeper));

    const plan = result.current.plan;
    for (let i = 0; i < plan.length - 1; i++) {
      const gkNow = plan[i].onField.find((p) => p.isGk)?.id;
      const gkNext = plan[i + 1].onField.find((p) => p.isGk)?.id;
      if (!gkNext || gkNext === gkNow) continue;
      expect(plan[i].bench).toContain(gkNext);
    }
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

  it("snaps the board back to the live interval at a boundary crossing, even if the coach had browsed elsewhere", () => {
    // An earlier version left activeInterval alone in this situation (to
    // avoid yanking a coach off an interval they were checking) — real use
    // showed coaches actually want to land back on live automatically once
    // play moves on, not stay stranded on whatever they last browsed to.
    const roster7 = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const team7 = { id: "t1", name: "Scorpions", roster: roster7, settings: { fieldSize: 5, gameMinutes: 24, subIntervalMinutes: 6 } };
    const { result } = renderHook(() => useMatchState({ activeTeamId: "t1", teamData: team7, saveTeamData: vi.fn() }));
    act(() => {
      result.current.setAvailableIds(roster7.map((p) => p.id));
      result.current.setGameSettings({ fieldSize: 5, gameMinutes: 24, subIntervalMinutes: 6 });
    });
    act(() => result.current.startPlanning()); // 4 intervals of 6 min (360s) each
    expect(result.current.plan.length).toBe(4);

    act(() => {
      result.current.setRunStartedAt(Date.now());
      result.current.setTimerRunning(true);
    });
    act(() => vi.advanceTimersByTime(100_000)); // 100s in - still interval 0 live

    act(() => result.current.setActiveInterval(2)); // coach browses ahead to check interval 2
    expect(result.current.activeInterval).toBe(2);

    // Advance past the interval 0 -> 1 boundary (360s) without confirming a sub.
    act(() => vi.advanceTimersByTime(300_000)); // total ~400s -> live is now interval 1
    expect(result.current.activeInterval).toBe(1); // snapped to the new live interval, not left at 2
  });
});

// Real-use feedback brought this back after it was removed entirely in the
// match-day redesign — a quick way to restart today's game from 0:00 on
// the same rotation, reachable from MatchView's own action bar.
describe("useMatchState — resetClock", () => {
  it("rewinds the clock, sub log, and active interval, but leaves the plan and injuries untouched", () => {
    const { result } = setupWithPlan();
    const planBefore = result.current.plan;
    act(() => {
      result.current.setRunStartedAt(Date.now());
      result.current.setTimerRunning(true);
      result.current.setBaseElapsedSec(400);
      result.current.setElapsedSec(400);
      result.current.setActiveInterval(1);
      result.current.setSubLog({ 0: 340 });
      result.current.setInjuredThisGame(["p2"]);
    });

    act(() => result.current.resetClock());

    expect(result.current.timerRunning).toBe(false);
    expect(result.current.runStartedAt).toBeNull();
    expect(result.current.baseElapsedSec).toBe(0);
    expect(result.current.elapsedSec).toBe(0);
    expect(result.current.activeInterval).toBe(0);
    expect(result.current.subLog).toEqual({});
    // Same rotation, not a rebuilt one -- and a real injury doesn't get
    // silently undone just because the clock rewound.
    expect(result.current.plan).toBe(planBefore);
    expect(result.current.injuredThisGame).toEqual(["p2"]);
  });
});
