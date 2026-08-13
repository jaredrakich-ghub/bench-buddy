// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/gameHistory.js", () => ({
  fetchGameHistory: vi.fn(),
}));
import { fetchGameHistory } from "../lib/gameHistory.js";
import SeasonSummaryModal from "./SeasonSummaryModal.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const GAMES = [
  // Newest first, matching fetchGameHistory's actual ordering — p1 played
  // both games, p2 only the older one (missed the newer one), so p2's
  // average should only reflect the one game they were actually part of.
  {
    id: "g2",
    date: 2,
    players: [
      { id: "p1", name: "Alice", outfieldMin: 30, gkMin: 10, benchMin: 0, injuredMin: 0 },
    ],
  },
  {
    id: "g1",
    date: 1,
    players: [
      { id: "p1", name: "Alice", outfieldMin: 20, gkMin: 0, benchMin: 20, injuredMin: 0 },
      { id: "p2", name: "Bob", outfieldMin: 25, gkMin: 5, benchMin: 10, injuredMin: 0 },
    ],
  },
];

describe("SeasonSummaryModal", () => {
  it("shows a loading state while the fetch is in flight", () => {
    fetchGameHistory.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    expect(screen.getByText(/Loading season history/)).toBeInTheDocument();
  });

  it("shows an empty state when no games have been archived yet", async () => {
    fetchGameHistory.mockResolvedValue([]);
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    expect(await screen.findByText(/No games recorded yet/)).toBeInTheDocument();
  });

  it("shows a friendly error if the fetch fails, rather than an unhandled rejection", async () => {
    fetchGameHistory.mockRejectedValue({ code: "unavailable" });
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows each player's games-played count and per-game averages, excluding games they weren't part of", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);

    await screen.findByText("Alice");
    // Alice: 2 games, avg outfield (30+20)/2=25, avg keeper (10+0)/2=5
    const aliceRow = screen.getByText("Alice").closest("div");
    expect(aliceRow).toHaveTextContent("Alice");
    expect(aliceRow).toHaveTextContent("2"); // games played
    expect(aliceRow).toHaveTextContent("25"); // avg outfield
    expect(aliceRow).toHaveTextContent("5"); // avg keeper

    // Bob: only 1 game (the one he was actually in) — not zero-filled for the other.
    const bobRow = screen.getByText("Bob").closest("div");
    expect(bobRow).toHaveTextContent("1");
    expect(bobRow).toHaveTextContent("25");
  });

  it("hides the injured column entirely when nobody's ever been injured", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    await screen.findByText("Alice");
    expect(screen.queryByText("Avg Injured")).not.toBeInTheDocument();
  });

  it("shows an injured column when at least one archived game recorded injured minutes", async () => {
    const withInjury = [
      { id: "g1", date: 1, players: [{ id: "p1", name: "Alice", outfieldMin: 20, gkMin: 0, benchMin: 10, injuredMin: 10 }] },
    ];
    fetchGameHistory.mockResolvedValue(withInjury);
    render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    expect(await screen.findByText("Avg Injured")).toBeInTheDocument();
  });

  it("re-fetches when the team changes, rather than showing stale data for the new team", async () => {
    fetchGameHistory.mockResolvedValueOnce(GAMES);
    const { rerender } = render(<SeasonSummaryModal teamId="t1" onClose={vi.fn()} />);
    await screen.findByText("Alice");

    fetchGameHistory.mockResolvedValueOnce([]);
    rerender(<SeasonSummaryModal teamId="t2" onClose={vi.fn()} />);
    await waitFor(() => expect(fetchGameHistory).toHaveBeenCalledWith("t2"));
    expect(await screen.findByText(/No games recorded yet/)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    fetchGameHistory.mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SeasonSummaryModal teamId="t1" onClose={onClose} />);
    await screen.findByText(/No games recorded yet/);
    await user.click(screen.getByRole("button")); // only the X close button exists in the empty state
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
