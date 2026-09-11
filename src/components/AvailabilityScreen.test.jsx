// @vitest-environment jsdom
//
// Tests AvailabilityScreen against a mocked availabilityIo.js, same
// convention useMatchState.test.js/SquadSettingsForm.test.jsx already use.
// Covers what real-use feedback actually found wrong with this screen this
// session: a cancelled request reverting to a stale summary instead of the
// create form, the squad list's auto-expand-once behavior, and that the
// fixture/closing edits and Cancel actually call the right I/O with the
// right arguments — not the pure copy/formatting (already covered in
// availability.test.js) or Share/Copy (simple, already hand-verified).
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvailabilityScreen from "./AvailabilityScreen.jsx";

vi.mock("../lib/availabilityIo.js", () => ({
  fetchAvailabilityRequest: vi.fn(),
  createOrRegenerateAvailabilityRequest: vi.fn().mockResolvedValue(undefined),
  updateClosingTime: vi.fn().mockResolvedValue(undefined),
  updateFixtureDetails: vi.fn().mockResolvedValue(undefined),
  revokeAvailabilityRequest: vi.fn().mockResolvedValue(undefined),
  subscribeAvailabilityRequest: vi.fn(() => vi.fn()),
}));
import {
  fetchAvailabilityRequest, createOrRegenerateAvailabilityRequest, updateClosingTime, updateFixtureDetails,
  revokeAvailabilityRequest, subscribeAvailabilityRequest,
} from "../lib/availabilityIo.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ROSTER = [
  { id: "p1", name: "Alex", number: 1 },
  { id: "p2", name: "Ben", number: 2 },
  { id: "p3", name: "Charlie", number: 3 },
];

const NOW = Date.now();
const FUTURE_MATCH = NOW + 3 * 24 * 60 * 60 * 1000;

function liveRequest(overrides = {}) {
  return {
    token: "tok-1", teamName: "Tigers FC", opponent: "Rovers", location: "Hillcrest Park",
    matchAt: FUTURE_MATCH, closingAt: FUTURE_MATCH + 24 * 60 * 60 * 1000, revokedAt: null, reopenedAt: null,
    squad: ROSTER, answers: {}, createdBy: "coach-1", createdAt: NOW,
    ...overrides,
  };
}

function renderScreen({ request = null, onClose = vi.fn() } = {}) {
  fetchAvailabilityRequest.mockResolvedValue(request);
  render(<AvailabilityScreen teamId="team-1" coachUid="coach-1" teamName="Tigers FC" roster={ROSTER} onClose={onClose} />);
  return { onClose };
}

describe("AvailabilityScreen — loading and back", () => {
  it("shows a loading screen before the initial fetch resolves", () => {
    fetchAvailabilityRequest.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AvailabilityScreen teamId="team-1" coachUid="coach-1" teamName="Tigers FC" roster={ROSTER} onClose={vi.fn()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("calls onClose when the back chevron is tapped", async () => {
    const user = userEvent.setup();
    const { onClose } = renderScreen({ request: null });
    await user.click(await screen.findByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("AvailabilityScreen — showCreateForm (real-use regression: 'Start new game' / cancel)", () => {
  it("shows the create form when there's no request yet", async () => {
    renderScreen({ request: null });
    expect(await screen.findByText("Ask the group")).toBeInTheDocument();
  });

  it("shows the create form for a cancelled (revoked) request, not a stale summary", async () => {
    renderScreen({ request: liveRequest({ revokedAt: NOW - 1000 }) });
    expect(await screen.findByText("Ask the group")).toBeInTheDocument();
  });

  it("shows the manage view for a live, unrevoked request, even with a matchAt far in the future", async () => {
    renderScreen({ request: liveRequest() });
    expect(await screen.findByText("Tigers FC v Rovers")).toBeInTheDocument();
  });
});

describe("AvailabilityScreen — squad list expand/collapse", () => {
  it("is collapsed by default when nobody's answered yet", async () => {
    renderScreen({ request: liveRequest() });
    await screen.findByText("SQUAD · 3");
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
  });

  it("expands on tap", async () => {
    const user = userEvent.setup();
    renderScreen({ request: liveRequest() });
    await user.click(await screen.findByText("SQUAD · 3"));
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("auto-expands once the first real answer arrives via the live subscription, without needing a tap", async () => {
    renderScreen({ request: liveRequest() });
    await screen.findByText("SQUAD · 3");
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();

    const cb = subscribeAvailabilityRequest.mock.calls[0][1];
    act(() => cb(liveRequest({ answers: { p1: { status: "in" } } })));

    expect(await screen.findByText("Alex")).toBeInTheDocument();
  });

  it("shows · out / · waiting / nothing-for-in (auto-expanded, since this request already has answers)", async () => {
    renderScreen({ request: liveRequest({ answers: { p1: { status: "in" }, p2: { status: "out" } } }) });
    expect(await screen.findByText("· out")).toBeInTheDocument();
    expect(screen.getByText("· waiting")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });
});

describe("AvailabilityScreen — create form", () => {
  it("shows an error and doesn't submit when date/time are missing", async () => {
    const user = userEvent.setup();
    renderScreen({ request: null });
    await user.click(await screen.findByText("Create the link"));
    expect(await screen.findByText("Set the match date and kick-off time first.")).toBeInTheDocument();
    expect(createOrRegenerateAvailabilityRequest).not.toHaveBeenCalled();
  });

  it("creates a request with closingAt defaulted to a day after kickoff — no closing-time field on this form", async () => {
    const user = userEvent.setup();
    renderScreen({ request: null });
    await screen.findByText("MATCH DATE"); // wait for the create form itself, not just the loading screen
    expect(screen.queryByText(/Closes /)).not.toBeInTheDocument();

    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-09-19" } });
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "09:00" } });
    await user.click(screen.getByText("Create the link"));

    await waitFor(() => expect(createOrRegenerateAvailabilityRequest).toHaveBeenCalledTimes(1));
    const [teamIdArg, coachUidArg, payload] = createOrRegenerateAvailabilityRequest.mock.calls[0];
    const expectedMatchAt = new Date(2026, 8, 19, 9, 0).getTime();
    expect(teamIdArg).toBe("team-1");
    expect(coachUidArg).toBe("coach-1");
    expect(payload.matchAt).toBe(expectedMatchAt);
    expect(payload.closingAt).toBe(expectedMatchAt + 24 * 60 * 60 * 1000);
  });
});

describe("AvailabilityScreen — closing-time edit", () => {
  it("opens pre-filled from the request; Save calls updateClosingTime with the new time, leaving matchAt/token alone", async () => {
    const user = userEvent.setup();
    const req = liveRequest();
    renderScreen({ request: req });
    await user.click(await screen.findByText(/Closes /));

    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-09-21" } });
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "10:00" } });
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(updateClosingTime).toHaveBeenCalledTimes(1));
    const [teamIdArg, reqArg, newClosingAtMs] = updateClosingTime.mock.calls[0];
    expect(teamIdArg).toBe("team-1");
    expect(reqArg).toBe(req);
    expect(newClosingAtMs).toBe(new Date(2026, 8, 21, 10, 0).getTime());
  });
});

describe("AvailabilityScreen — fixture detail edit", () => {
  it("opens pre-filled from the request; Save calls updateFixtureDetails, leaving the token/squad/answers untouched", async () => {
    const user = userEvent.setup();
    renderScreen({ request: liveRequest() });
    await user.click(await screen.findByText("Tigers FC v Rovers"));

    expect(screen.getByDisplayValue("Rovers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hillcrest Park")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Rovers"), { target: { value: "Panthers" } });
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(updateFixtureDetails).toHaveBeenCalledTimes(1));
    const [teamIdArg, payload] = updateFixtureDetails.mock.calls[0];
    expect(teamIdArg).toBe("team-1");
    expect(payload.opponent).toBe("Panthers");
    expect(payload.location).toBe("Hillcrest Park");
  });
});

describe("AvailabilityScreen — Cancel this link", () => {
  it("confirms, calls revokeAvailabilityRequest, and reverts to the create form once the subscription reflects the cancellation", async () => {
    const user = userEvent.setup();
    renderScreen({ request: liveRequest() });

    await user.click(await screen.findByText("Cancel this link"));
    expect(screen.getByText("Cancel this link?")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel the link"));

    await waitFor(() => expect(revokeAvailabilityRequest).toHaveBeenCalledWith("team-1"));

    const cb = subscribeAvailabilityRequest.mock.calls[0][1];
    act(() => cb(liveRequest({ revokedAt: Date.now() })));

    expect(await screen.findByText("Ask the group")).toBeInTheDocument();
  });

  it("Keep it dismisses the dialog without calling revokeAvailabilityRequest", async () => {
    const user = userEvent.setup();
    renderScreen({ request: liveRequest() });
    await user.click(await screen.findByText("Cancel this link"));
    await user.click(screen.getByText("Keep it"));
    expect(screen.queryByText("Cancel this link?")).not.toBeInTheDocument();
    expect(revokeAvailabilityRequest).not.toHaveBeenCalled();
  });
});
