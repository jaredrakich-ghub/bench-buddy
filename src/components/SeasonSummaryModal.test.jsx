// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/gameHistory.js", () => ({
  fetchGameHistory: vi.fn(),
  deleteGame: vi.fn(),
}));
import { fetchGameHistory, deleteGame } from "../lib/gameHistory.js";
import SeasonSummaryModal from "./SeasonSummaryModal.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NUMBERS = { p1: 1, p2: 2 };
const numberOf = (id) => NUMBERS[id] ?? "?";

function renderModal(props = {}) {
  return render(<SeasonSummaryModal teamId="t1" numberOf={numberOf} onClose={vi.fn()} {...props} />);
}

const GAMES = [
  // Newest first, matching fetchGameHistory's actual ordering — p1 played
  // both games, p2 only the older one (missed the newer one), so p2's
  // average should only reflect the one game they were actually part of.
  // Averages deliberately distinct (Alice 30'/game, Bob 25'/game) so sort
  // order and the bar scale are unambiguous to assert on.
  {
    id: "g2",
    date: 2,
    players: [{ id: "p1", name: "Alice", outfieldMin: 30, gkMin: 10, benchMin: 0, injuredMin: 0 }],
  },
  {
    id: "g1",
    date: 1,
    players: [
      { id: "p1", name: "Alice", outfieldMin: 20, gkMin: 0, benchMin: 20, injuredMin: 0 },
      { id: "p2", name: "Bob", outfieldMin: 20, gkMin: 5, benchMin: 15, injuredMin: 0 },
    ],
  },
];

describe("SeasonSummaryModal", () => {
  it("shows a loading state while the fetch is in flight", () => {
    fetchGameHistory.mockReturnValue(new Promise(() => {})); // never resolves
    renderModal();
    expect(screen.getByText(/Loading season history/)).toBeInTheDocument();
  });

  it("shows an empty state when no games have been archived yet", async () => {
    fetchGameHistory.mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText(/No games recorded yet/)).toBeInTheDocument();
  });

  it("shows a friendly error if the fetch fails, rather than an unhandled rejection", async () => {
    fetchGameHistory.mockRejectedValue({ code: "unavailable" });
    renderModal();
    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows the average-per-game as the headline, games-played and total time as the subline, excluding games a player wasn't part of", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    renderModal();

    await screen.findByText("Alice");
    // Alice: 2 games, avg (outfield 30+20 / 2) + (gk 10+0 / 2) = 25 + 5 = 30'.
    // Total playing time: 40 + 20 = 60 minutes -> "1:00:00" (the h:mm:ss
    // formatter this screen needs, since a season total can pass an hour
    // even though a single match's own clock never does).
    const aliceRow = screen.getByText("Alice").closest("div").parentElement;
    expect(aliceRow).toHaveTextContent("30′");
    expect(aliceRow).toHaveTextContent("2 games");
    expect(aliceRow).toHaveTextContent("1:00:00");

    // Bob: only 1 game (the one he was actually in) — not zero-filled for
    // the game he missed. Avg 20+5=25'.
    const bobRow = screen.getByText("Bob").closest("div").parentElement;
    expect(bobRow).toHaveTextContent("25′");
    expect(bobRow).toHaveTextContent("1 game");
    expect(bobRow).not.toHaveTextContent("1 games");
  });

  it("gives every player the same plain green disc — no gold keeper-eligible variant, matching Minutes (#10a)", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    renderModal();
    await screen.findByText("Alice");
    // Real-use feedback ("can we make the circles the normal green colour
    // ... too much yellow"): this screen used to keep a gold disc for
    // keeper-eligible players (both p1/p2 here) after Minutes dropped it —
    // now it matches Minutes exactly.
    const discs = screen.getAllByText(/^[12]$/); // the number-disc spans (Alice=1, Bob=2)
    discs.forEach((disc) => {
      expect(disc).toHaveStyle({ backgroundColor: "rgb(46, 125, 83)" }); // tokens.color.pitchGreen
    });
  });

  it("orders rows by average playing time descending, and states the gap in the note card", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    renderModal();
    await screen.findByText("Alice");
    const names = screen.getAllByText(/Alice|Bob/).map((el) => el.textContent);
    expect(names).toEqual(["Alice", "Bob"]);
    // 30' (Alice) - 25' (Bob) = 5' gap.
    expect(screen.getByText(/Widest gap across the squad is 5 minutes\./)).toBeInTheDocument();
  });

  it("has no Injured column — a deliberate change from the previous version", async () => {
    const withInjury = [
      { id: "g1", date: 1, players: [{ id: "p1", name: "Alice", outfieldMin: 20, gkMin: 0, benchMin: 10, injuredMin: 10 }] },
    ];
    fetchGameHistory.mockResolvedValue(withInjury);
    renderModal();
    await screen.findByText("Alice");
    expect(screen.queryByText(/Injured/)).not.toBeInTheDocument();
  });

  it("re-fetches when the team changes, rather than showing stale data for the new team", async () => {
    fetchGameHistory.mockResolvedValueOnce(GAMES);
    const { rerender } = renderModal();
    await screen.findByText("Alice");

    fetchGameHistory.mockResolvedValueOnce([]);
    rerender(<SeasonSummaryModal teamId="t2" numberOf={numberOf} onClose={vi.fn()} />);
    await waitFor(() => expect(fetchGameHistory).toHaveBeenCalledWith("t2"));
    expect(await screen.findByText(/No games recorded yet/)).toBeInTheDocument();
  });

  it("lists each individual game, newest first, with a delete option", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    renderModal();
    await screen.findByText("Alice");
    expect(screen.getAllByTitle("Delete this game")).toHaveLength(2);
  });

  it("asks for confirmation before deleting, and cancel backs out without calling deleteGame", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alice");

    await user.click(screen.getAllByTitle("Delete this game")[0]);
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(deleteGame).not.toHaveBeenCalled();
    expect(screen.getAllByTitle("Delete this game")).toHaveLength(2); // both rows still there
  });

  it("deletes the game and removes it from the list on confirm, without needing a re-fetch", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    deleteGame.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alice");

    await user.click(screen.getAllByTitle("Delete this game")[0]); // the newer game, g2
    await user.click(screen.getByText("Yes, delete"));

    await waitFor(() => expect(deleteGame).toHaveBeenCalledWith("t1", "g2"));
    expect(fetchGameHistory).toHaveBeenCalledTimes(1); // no re-fetch triggered
    await waitFor(() => expect(screen.getAllByTitle("Delete this game")).toHaveLength(1));
  });

  it("shows a friendly error and keeps the game listed if the delete fails", async () => {
    fetchGameHistory.mockResolvedValue(GAMES);
    deleteGame.mockRejectedValue({ code: "unavailable" });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("Alice");

    await user.click(screen.getAllByTitle("Delete this game")[0]);
    await user.click(screen.getByText("Yes, delete"));

    expect(await screen.findByText(/You're offline/)).toBeInTheDocument();
    expect(screen.getAllByTitle("Delete this game")).toHaveLength(2); // still there, nothing lost
  });

  it("calls onClose when the back button is clicked", async () => {
    fetchGameHistory.mockResolvedValue([]);
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ onClose });
    await screen.findByText(/No games recorded yet/);
    await user.click(screen.getByRole("button")); // only the back button exists in the empty state
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
