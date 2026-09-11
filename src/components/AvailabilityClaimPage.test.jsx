// @vitest-environment jsdom
//
// Tests AvailabilityClaimPage — the parent-facing side of the Availability
// Link feature — against a mocked availabilityIo.js, same convention as
// AvailabilityScreen.test.jsx/useMatchState.test.js. Covers the picker's
// confirmed-status suffixes (screen 5 real-use feedback), the full
// pick → answer → send → thanks flow, and the dead-link gate — not the pure
// copy/formatting (availability.test.js already covers formatFixture/
// formatMatchWhen/buildAnswer directly).
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvailabilityClaimPage from "./AvailabilityClaimPage.jsx";

vi.mock("../lib/availabilityIo.js", () => ({
  fetchAvailabilityRequest: vi.fn(),
  submitAnswer: vi.fn().mockResolvedValue(undefined),
}));
import { fetchAvailabilityRequest, submitAnswer } from "../lib/availabilityIo.js";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SQUAD = [
  { id: "p1", name: "Alex", number: 1 },
  { id: "p2", name: "Ben", number: 2 },
  { id: "p3", name: "Charlie", number: 3 },
];

const MATCH_AT = new Date(2026, 8, 19, 9, 0).getTime(); // Sat 19 Sep 2026, 9:00 am — a fixed, real local time

function liveRequest(overrides = {}) {
  return {
    token: "tok-1", teamName: "Tigers FC", opponent: "Rovers", location: "Hillcrest Park",
    matchAt: MATCH_AT, closingAt: MATCH_AT + 24 * 60 * 60 * 1000, revokedAt: null,
    squad: SQUAD, answers: {},
    ...overrides,
  };
}

function renderPage(request) {
  fetchAvailabilityRequest.mockResolvedValue(request);
  render(<AvailabilityClaimPage teamId="team-1" token="tok-1" />);
}

describe("AvailabilityClaimPage — dead link", () => {
  it("shows the dead-link message when there's no request at all", async () => {
    renderPage(null);
    expect(await screen.findByText("This link isn't active")).toBeInTheDocument();
  });

  it("shows the dead-link message for a cancelled (revoked) request", async () => {
    renderPage(liveRequest({ revokedAt: Date.now() - 1000 }));
    expect(await screen.findByText("This link isn't active")).toBeInTheDocument();
  });
});

describe("AvailabilityClaimPage — picker screen", () => {
  it("shows 'Select a player', the fixture and date/time, and one chip per squad member", async () => {
    renderPage(liveRequest());
    expect(await screen.findByText("Select a player")).toBeInTheDocument();
    expect(screen.getByText("Tigers FC v Rovers · Sat 19 Sep · 9:00 am")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows · out / · waiting / nothing-for-in, matching each child's own answer status", async () => {
    renderPage(liveRequest({ answers: { p1: { status: "in" }, p2: { status: "out" } } }));
    await screen.findByText("Select a player");
    // Alex (in) — no suffix.
    expect(screen.queryByText("· out", { selector: "span" })).toHaveTextContent("· out");
    expect(screen.getByText("· waiting")).toBeInTheDocument(); // Charlie — never answered
  });
});

describe("AvailabilityClaimPage — picking a child", () => {
  it("opens the question card with no pre-filled status for a child who hasn't answered", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Alex"));
    expect(await screen.findByText("Is Alex playing?")).toBeInTheDocument();
    expect(screen.getByText("Send to coach")).toBeDisabled();
  });

  it("pre-fills status/notes from an existing answer", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest({ answers: { p1: { status: "out", noteChips: ["late"], noteText: "Family trip" } } }));
    await user.click(await screen.findByText("Alex"));
    expect(await screen.findByText("Is Alex playing?")).toBeInTheDocument();
    expect(screen.getByText("Send to coach")).not.toBeDisabled();
    expect(screen.getByDisplayValue("Family trip")).toBeInTheDocument();
  });
});

describe("AvailabilityClaimPage — answering and sending", () => {
  it("submits the right payload (status/noteChips/noteText) and token, then shows Thanks", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Alex"));
    await user.click(await screen.findByText("Yes, playing"));
    await user.click(screen.getByText("Arriving late"));
    fireEvent.change(screen.getByPlaceholderText("Anything else? (optional)"), { target: { value: "Bit late, sorry" } });
    await user.click(screen.getByText("Send to coach"));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
    const [teamIdArg, childIdArg, answerArg, tokenArg] = submitAnswer.mock.calls[0];
    expect(teamIdArg).toBe("team-1");
    expect(childIdArg).toBe("p1");
    expect(tokenArg).toBe("tok-1");
    expect(answerArg).toMatchObject({ status: "in", noteChips: ["late"], noteText: "Bit late, sorry" });

    expect(await screen.findByText("Thanks!")).toBeInTheDocument();
    expect(screen.getByText(/Alex is marked as playing/)).toBeInTheDocument();
  });

  it("marks 'not playing' correctly for Can't make it", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Ben"));
    await user.click(await screen.findByText("Can't make it"));
    await user.click(screen.getByText("Send to coach"));

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Ben is marked as not playing/)).toBeInTheDocument();
  });

  it("Send to coach stays disabled until a status is chosen", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Charlie"));
    expect(screen.getByText("Send to coach")).toBeDisabled();
    await user.click(screen.getByText("Send to coach"));
    expect(submitAnswer).not.toHaveBeenCalled();
  });

  it("shows an inline error and does not advance to Thanks when submitAnswer rejects", async () => {
    submitAnswer.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Alex"));
    await user.click(await screen.findByText("Yes, playing"));
    await user.click(screen.getByText("Send to coach"));

    expect(await screen.findByText(/Couldn't send that/)).toBeInTheDocument();
    expect(screen.queryByText("Thanks!")).not.toBeInTheDocument();
  });
});

describe("AvailabilityClaimPage — navigating back", () => {
  it("'Not the right player? Select again' returns to the picker", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Alex"));
    await user.click(await screen.findByText("Not the right player? Select again"));
    expect(await screen.findByText("Select a player")).toBeInTheDocument();
  });

  it("'Change your answer' from the Thanks screen returns to the same child's question card, still filled in", async () => {
    const user = userEvent.setup();
    renderPage(liveRequest());
    await user.click(await screen.findByText("Alex"));
    await user.click(await screen.findByText("Yes, playing"));
    await user.click(screen.getByText("Send to coach"));
    await screen.findByText("Thanks!");

    await user.click(screen.getByText("Change your answer"));

    expect(await screen.findByText("Is Alex playing?")).toBeInTheDocument();
    expect(screen.getByText("Send to coach")).not.toBeDisabled();
  });
});
