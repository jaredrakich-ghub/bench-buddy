// @vitest-environment jsdom
//
// Tests useTeamRegistry against a mocked firestoreTeams.js — this hook
// never talks to Firebase directly for its own reads (that's the loading
// effect that lives in SubRotationPlanner.jsx instead), only for the two
// writes it owns: saveTeamData and renameTeamById.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useTeamRegistry } from "./useTeamRegistry.js";

vi.mock("../lib/firestoreTeams.js", () => ({
  updateTeamDoc: vi.fn(),
  describeSaveError: (err) => (err?.code === "unavailable" ? "You're offline — changes will sync once you're back online." : "Couldn't save."),
}));
import { updateTeamDoc } from "../lib/firestoreTeams.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TEAM = { id: "t1", name: "Scorpions", roster: [{ id: "p1", name: "Alice", keeperEligible: true }], settings: {} };

describe("useTeamRegistry — initial state", () => {
  it("starts empty, loading, and with no active team", () => {
    const { result } = renderHook(() => useTeamRegistry());
    expect(result.current.teams).toEqual([]);
    expect(result.current.activeTeamId).toBeNull();
    expect(result.current.teamData).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.saveError).toBeNull();
  });
});

describe("useTeamRegistry — saveTeamData", () => {
  it("updates the team locally right away and writes to Firestore in the background", async () => {
    updateTeamDoc.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTeamRegistry());
    act(() => {
      result.current.setTeams([TEAM]);
      result.current.setActiveTeamId("t1");
    });

    await act(async () => {
      result.current.saveTeamData({ ...TEAM, name: "Scorpions FC" });
      await Promise.resolve(); // flush the update's .then/.catch
    });

    expect(result.current.teamData.name).toBe("Scorpions FC"); // local state updated optimistically
    expect(updateTeamDoc).toHaveBeenCalledWith("t1", { ...TEAM, name: "Scorpions FC" });
    expect(result.current.saveError).toBeNull();
  });

  // Real bug (found via a real-device screenshot showing an unresolvable
  // "?" bench player): a caller that reads teamData from its own render
  // closure and calls saveTeamData({ ...teamData, roster: [...] }) loses
  // an earlier addition if a second such call fires before React
  // re-renders — the second call's stale roster snapshot overwrites the
  // first. Passing an updater function instead (reading the hook's own
  // always-current ref, not the caller's stale closure) is the fix; this
  // locks in that two rapid calls both survive, not just the last one.
  it("does not lose an earlier update when two saveTeamData calls (function form) fire before a re-render", async () => {
    updateTeamDoc.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTeamRegistry());
    act(() => {
      result.current.setTeams([TEAM]);
      result.current.setActiveTeamId("t1");
    });

    await act(async () => {
      result.current.saveTeamData((prev) => ({ ...prev, roster: [...prev.roster, { id: "p2", name: "Bob", keeperEligible: true }] }));
      result.current.saveTeamData((prev) => ({ ...prev, roster: [...prev.roster, { id: "p3", name: "Cara", keeperEligible: true }] }));
      await Promise.resolve();
    });

    expect(result.current.teamData.roster.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("surfaces a friendly message and does not lose the optimistic local update if the write fails", async () => {
    updateTeamDoc.mockRejectedValue({ code: "unavailable" });
    const { result } = renderHook(() => useTeamRegistry());
    act(() => {
      result.current.setTeams([TEAM]);
      result.current.setActiveTeamId("t1");
    });

    await act(async () => {
      result.current.saveTeamData({ ...TEAM, name: "Scorpions FC" });
      await Promise.resolve();
      await Promise.resolve(); // rejection needs an extra microtask turn to settle
    });

    expect(result.current.teamData.name).toBe("Scorpions FC");
    expect(result.current.saveError).toMatch(/offline/);
  });
});

describe("useTeamRegistry — renameTeamById", () => {
  it("trims whitespace and saves the new name", async () => {
    updateTeamDoc.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTeamRegistry());
    act(() => {
      result.current.setTeams([TEAM]);
      result.current.setActiveTeamId("t1");
    });

    act(() => result.current.renameTeamById("t1", "  Scorpions FC  "));

    expect(result.current.teamData.name).toBe("Scorpions FC");
    expect(updateTeamDoc).toHaveBeenCalledWith("t1", { name: "Scorpions FC" });
  });

  it("falls back to the existing name if given a blank one", () => {
    const { result } = renderHook(() => useTeamRegistry());
    act(() => {
      result.current.setTeams([TEAM]);
      result.current.setActiveTeamId("t1");
    });

    act(() => result.current.renameTeamById("t1", "   "));

    expect(result.current.teamData.name).toBe("Scorpions");
  });
});
