// @vitest-environment jsdom
//
// Tests useCurrentAvailability against a mocked availabilityIo.js — the
// pure isRequestStale/canAnswer logic already has its own thorough tests
// in availability.test.js; these are about what only this hook does: when
// a fetched request counts as "current" for the game being set up, and the
// three independent ways it can stop (stale, revoked, dismissed).
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { useCurrentAvailability } from "./useCurrentAvailability.js";

vi.mock("../lib/availabilityIo.js", () => ({
  fetchAvailabilityRequest: vi.fn(),
}));
import { fetchAvailabilityRequest } from "../lib/availabilityIo.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NOW = Date.now();
const FUTURE_MATCH = NOW + 60 * 60 * 1000; // an hour from now — not stale
const PAST_MATCH = NOW - 60 * 60 * 1000; // an hour ago — stale

function liveRequest(overrides = {}) {
  return { token: "tok-1", matchAt: FUTURE_MATCH, revokedAt: null, squad: [], answers: {}, ...overrides };
}

async function renderWith(activeTeamId, isMatchComplete = false) {
  const hook = renderHook(({ teamId, complete }) => useCurrentAvailability(teamId, complete), {
    initialProps: { teamId: activeTeamId, complete: isMatchComplete },
  });
  // The fetch effect's own .then() resolves on a microtask — every test
  // below needs that settled before asserting, same as waiting for any
  // other async effect.
  await waitFor(() => expect(fetchAvailabilityRequest).toHaveBeenCalled());
  return hook;
}

describe("useCurrentAvailability — no request at all", () => {
  it("is null with no activeTeamId — never even fetches", () => {
    const { result } = renderHook(() => useCurrentAvailability(null, false));
    expect(fetchAvailabilityRequest).not.toHaveBeenCalled();
    expect(result.current.currentAvailabilityRequest).toBeNull();
  });

  it("is null when the fetch resolves to no request", async () => {
    fetchAvailabilityRequest.mockResolvedValue(null);
    const { result } = await renderWith("team-1");
    await waitFor(() => expect(result.current.currentAvailabilityRequest).toBeNull());
  });
});

describe("useCurrentAvailability — a live request", () => {
  it("is returned as-is: unrevoked, matchAt still in the future", async () => {
    const req = liveRequest();
    fetchAvailabilityRequest.mockResolvedValue(req);
    const { result } = await renderWith("team-1");
    await waitFor(() => expect(result.current.currentAvailabilityRequest).toEqual(req));
  });
});

describe("useCurrentAvailability — stale (matchAt already passed)", () => {
  it("is treated as no request at all, even though it's not revoked", async () => {
    fetchAvailabilityRequest.mockResolvedValue(liveRequest({ matchAt: PAST_MATCH }));
    const { result } = await renderWith("team-1");
    await waitFor(() => expect(fetchAvailabilityRequest).toHaveBeenCalled());
    expect(result.current.currentAvailabilityRequest).toBeNull();
  });
});

describe("useCurrentAvailability — cancelled (revoked)", () => {
  it("is treated as no request at all, even though matchAt hasn't passed", async () => {
    fetchAvailabilityRequest.mockResolvedValue(liveRequest({ revokedAt: NOW - 1000 }));
    const { result } = await renderWith("team-1");
    expect(result.current.currentAvailabilityRequest).toBeNull();
  });
});

describe("useCurrentAvailability — dismissal (Start new game / Continue Set Up)", () => {
  // dismissCurrentAvailabilityRequest mutates a ref, not state — same as
  // in real use, that alone doesn't trigger a re-render; a component
  // calling it always has other state changing in the same handler
  // (setShowSettingsModal, setHasOpenedSetupThisGame) that does. These
  // tests force that next render explicitly with rerender(), same props,
  // to observe the now-updated derivation.
  it("makes the request stop being current from the next render onward, without touching matchAt/revokedAt", async () => {
    fetchAvailabilityRequest.mockResolvedValue(liveRequest());
    const { result, rerender } = await renderWith("team-1", true);
    expect(result.current.currentAvailabilityRequest).not.toBeNull();

    act(() => result.current.dismissCurrentAvailabilityRequest());
    rerender({ teamId: "team-1", complete: true });

    expect(result.current.currentAvailabilityRequest).toBeNull();
  });

  it("does nothing when there's no current request to dismiss", async () => {
    fetchAvailabilityRequest.mockResolvedValue(null);
    const { result } = await renderWith("team-1");
    expect(() => act(() => result.current.dismissCurrentAvailabilityRequest())).not.toThrow();
    expect(result.current.currentAvailabilityRequest).toBeNull();
  });

  it("never affects a genuinely new request (a different token)", async () => {
    fetchAvailabilityRequest.mockResolvedValueOnce(liveRequest({ token: "old-tok" }));
    const { result, rerender } = await renderWith("team-1", true);
    act(() => result.current.dismissCurrentAvailabilityRequest());
    rerender({ teamId: "team-1", complete: true });
    expect(result.current.currentAvailabilityRequest).toBeNull();

    // A regenerated link mints a new token — same team, same
    // isMatchComplete, but a fresh fetch (e.g. via
    // refreshCurrentAvailabilityRequest) returning a different request.
    fetchAvailabilityRequest.mockResolvedValueOnce(liveRequest({ token: "new-tok" }));
    await act(async () => result.current.refreshCurrentAvailabilityRequest());

    expect(result.current.currentAvailabilityRequest?.token).toBe("new-tok");
  });

  it("clears once isMatchComplete goes back to false — a fresh rotation being built", async () => {
    fetchAvailabilityRequest.mockResolvedValue(liveRequest());
    const { result, rerender } = await renderWith("team-1", true);
    act(() => result.current.dismissCurrentAvailabilityRequest());
    rerender({ teamId: "team-1", complete: true });
    expect(result.current.currentAvailabilityRequest).toBeNull();

    // The ref-clearing effect below runs AFTER the render that flips
    // isMatchComplete to false, so that first render still derives from
    // the not-yet-cleared ref — same one-render-behind shape the dismissal
    // ref always has (see dismissCurrentAvailabilityRequest's own tests
    // above). A second render (any state change in the real component;
    // here, an identical rerender) is what actually observes it cleared.
    rerender({ teamId: "team-1", complete: false });
    rerender({ teamId: "team-1", complete: false });

    expect(result.current.currentAvailabilityRequest).not.toBeNull();
  });

  it("clears (and re-fetches) when activeTeamId changes", async () => {
    fetchAvailabilityRequest.mockResolvedValue(liveRequest({ token: "team-1-tok" }));
    const { result, rerender } = await renderWith("team-1", true);
    act(() => result.current.dismissCurrentAvailabilityRequest());
    rerender({ teamId: "team-1", complete: true });
    expect(result.current.currentAvailabilityRequest).toBeNull();

    fetchAvailabilityRequest.mockResolvedValue(liveRequest({ token: "team-1-tok" })); // same token, different team
    rerender({ teamId: "team-2", complete: true });
    await waitFor(() => expect(fetchAvailabilityRequest).toHaveBeenLastCalledWith("team-2"));

    await waitFor(() => expect(result.current.currentAvailabilityRequest).not.toBeNull());
  });
});

describe("useCurrentAvailability — refreshCurrentAvailabilityRequest", () => {
  it("re-fetches for the active team and updates the current request", async () => {
    fetchAvailabilityRequest.mockResolvedValueOnce(null);
    const { result } = await renderWith("team-1");
    expect(result.current.currentAvailabilityRequest).toBeNull();

    fetchAvailabilityRequest.mockResolvedValueOnce(liveRequest());
    await act(async () => result.current.refreshCurrentAvailabilityRequest());

    expect(result.current.currentAvailabilityRequest).not.toBeNull();
  });

  it("does nothing with no activeTeamId", () => {
    const { result } = renderHook(() => useCurrentAvailability(null, false));
    act(() => result.current.refreshCurrentAvailabilityRequest());
    expect(fetchAvailabilityRequest).not.toHaveBeenCalled();
  });
});
