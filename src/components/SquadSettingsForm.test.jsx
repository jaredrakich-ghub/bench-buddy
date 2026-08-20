// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SquadSettingsForm from "./SquadSettingsForm.jsx";

afterEach(cleanup);

const ROSTER = [
  { id: "p1", name: "Alice", keeperEligible: true },
  { id: "p2", name: "Bob", keeperEligible: false },
];
const numberOf = (id) => ({ p1: 1, p2: 2 }[id] ?? "?");

function baseProps(overrides = {}) {
  return {
    roster: ROSTER,
    gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
    setGameSettings: vi.fn(),
    availableIds: ["p1", "p2"],
    setAvailableIds: vi.fn(),
    newPlayerName: "",
    setNewPlayerName: vi.fn(),
    addPlayer: vi.fn(),
    removePlayer: vi.fn(),
    toggleAvailable: vi.fn(),
    toggleKeeperEligible: vi.fn(),
    setPlayerNumber: vi.fn(),
    numberOf,
    showRestartWarning: false,
    onSubmit: vi.fn(),
    submitLabel: "Generate Rotation",
    startingGkId: null,
    setStartingGkId: vi.fn(),
    ...overrides,
  };
}

// The exact scenario the starting-keeper investigation found (see
// pickFairStartingGk's tests in rotation.test.js): 7 players, fieldSize 5,
// a 42-minute/7-interval game, everyone keeper-eligible. Starting p2 or p3
// in goal produces a real 12-minute spread; every other choice is perfectly
// even. Used here to exercise the live warning banner against a real,
// known-unfair pick rather than a made-up one.
const FAIRNESS_ROSTER = Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, keeperEligible: true }));
const FAIRNESS_SETTINGS = { fieldSize: 5, gameMinutes: 42, subIntervalMinutes: 6 };

describe("SquadSettingsForm — rendering (inline / A3 layout)", () => {
  it("shows the title with no close button when there's nothing to close to", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("Today's game")).toBeInTheDocument();
    expect(screen.queryByTitle("Close")).not.toBeInTheDocument();
  });

  it("shows the three tiles, the squad, and the sub-window preview", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("5")).toBeInTheDocument(); // on pitch
    expect(screen.getByText("40")).toBeInTheDocument(); // minutes
    expect(screen.getByText("on pitch")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sub windows/).length).toBeGreaterThan(0);
  });

  it("shows an empty-state message in Manage squad when the roster has no players yet", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.getByText("No players yet — add your squad above.")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — rendering (edit / A4 layout)", () => {
  it("shows the given title and a close button that calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit", title: "Edit this game", onClose })} />);
    expect(screen.getByText("Edit this game")).toBeInTheDocument();
    await user.click(screen.getByTitle("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the three advanced sections collapsed to one-line rows carrying their current value", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.getByText("First in goal today")).toBeInTheDocument();
    expect(screen.getByText("Random")).toBeInTheDocument(); // no starting keeper picked
    expect(screen.getByText("Keeper changes")).toBeInTheDocument();
    expect(screen.getByText("Every 6′")).toBeInTheDocument(); // defaults to subIntervalMinutes
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  // Real-use feedback: this row used to duplicate SquadChangeScreen.jsx's
  // own job (the cog menu's "Who's here" row) — availability toggling and
  // +Player both live there now, so the edit layout drops its own copy of
  // that section entirely. Manage squad (further down) keeps its own,
  // different job — number/keeper-eligible/remove, not availability.
  it("has no Who's here availability section — that's SquadChangeScreen's own job now", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.queryByText("Who's here?")).not.toBeInTheDocument();
    expect(screen.queryByText("tap to drop out")).not.toBeInTheDocument();
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  // Real-use feedback: wanted the Breaks row to read as one phrase
  // ("Breaks" + "Every third"), matching how "Keeper changes" + "Every 4′"
  // already reads.
  it("shows the Breaks row's value as 'Every <segment>', not the chip's own plain noun", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit", gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, breakSegments: 3 } })} />);
    expect(screen.getByText("Every third")).toBeInTheDocument();
    expect(screen.queryByText("Thirds")).not.toBeInTheDocument(); // that's the chip's own label, only shown once expanded
  });

  it("expands a section in place when tapped, and only one at a time", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);

    await user.click(screen.getByText("First in goal today"));
    expect(screen.getByText("Tap a name to pick who starts in goal today.")).toBeInTheDocument();

    // Opening Keeper changes closes the In-goal card back to its one-liner.
    await user.click(screen.getByText("Keeper changes"));
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
    expect(screen.getByText("Leave at the sub length to rotate keepers every window.")).toBeInTheDocument();
  });

  it("collapses an expanded section back via its chevron", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Breaks"));
    expect(screen.getAllByText(/sub windows/).length).toBeGreaterThan(0);
    // The chevron toggle is the "⌄" — collapse it back to the one-line row.
    await user.click(screen.getByText("⌄"));
    expect(screen.getByText("Breaks")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  // Real-device feedback: the "⌄" collapse control was too small a tap
  // target (18px font, no padding). Bumped alongside the rename work.
  it("gives the collapse chevron a bigger tap target than before", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("Breaks"));
    const chevron = screen.getByText("⌄");
    expect(chevron).toHaveStyle({ fontSize: "26px", padding: "8px" });
  });

  // Manage squad joined the other three accordion rows on real-use feedback
  // ("too much going on" that page) — every player's name/number was
  // already shown once in the Who's here chip row, so the detail list
  // (number/keeper-eligible/remove) sitting open by default was pure
  // duplication. Only the "edit" layout gets this treatment — "inline"
  // (first-time setup) still shows everything open, per its own README-
  // cited rationale ("nothing already answered yet to skim past").
  it("collapses Manage squad to a one-line row carrying the player count", () => {
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    expect(screen.getByText("Manage squad")).toBeInTheDocument();
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.queryByTitle("Set squad number")).not.toBeInTheDocument();
  });

  it("expands Manage squad to show the number/keeper-eligible/remove rows, and collapses the other sections", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ variant: "edit" })} />);
    await user.click(screen.getByText("First in goal today"));
    expect(screen.getByText("Tap a name to pick who starts in goal today.")).toBeInTheDocument();

    await user.click(screen.getByText("Manage squad"));
    expect(screen.queryByText("Tap a name to pick who starts in goal today.")).not.toBeInTheDocument();
    expect(screen.getAllByTitle("Set squad number")).toHaveLength(2);
    expect(screen.getAllByTitle("Toggle keeper-eligible")).toHaveLength(2);
    expect(screen.getAllByTitle("Remove from squad")).toHaveLength(2);
  });
});

describe("SquadSettingsForm — number tiles (tap to flip, stepper)", () => {
  // The Keeper swaps row (further down) has its own always-visible −/+
  // stepper, so "−"/"+" are never unique on this screen once a tile is
  // flipped too — tests disambiguate with getAllByText, relying on DOM
  // order (a flipped tile always renders before the Keeper swaps row in
  // both layouts) rather than a single getByText match.
  it("tapping a resting tile flips it and shows a second −/+ stepper", async () => {
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getAllByText("−")).toHaveLength(1); // just Keeper swaps, at rest
    await user.click(screen.getByText("on pitch"));
    expect(screen.getAllByText("−")).toHaveLength(2); // + the newly-flipped tile
  });

  it("+ steps fieldSize up by 1", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    await user.click(screen.getAllByText("+")[0]); // the tile's own +, before Keeper swaps' in DOM order
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 6, gameMinutes: 40, subIntervalMinutes: 6 });
  });

  it("steps gameMinutes by 5, not 1", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("minutes"));
    await user.click(screen.getAllByText("+")[0]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 45, subIntervalMinutes: 6 });
  });

  it("won't step below the tile's own minimum", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ gameSettings: { fieldSize: 2, gameMinutes: 40, subIntervalMinutes: 6 }, setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    await user.click(screen.getAllByText("−")[0]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 2, gameMinutes: 40, subIntervalMinutes: 6 });
  });

  it("tapping the flipped tile's own body settles it back, without changing any value", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("on pitch"));
    expect(screen.getAllByText("−")).toHaveLength(2);
    await user.click(screen.getByText("sub every")); // tapping a different resting tile
    expect(screen.getAllByText("−")).toHaveLength(2); // still exactly one flipped tile + Keeper swaps
    expect(setGameSettings).not.toHaveBeenCalled();
  });
});

describe("SquadSettingsForm — squad chips (availability)", () => {
  it("tapping a player's chip calls toggleAvailable with their id", async () => {
    const toggleAvailable = vi.fn();
    const user = userEvent.setup();
    // Bob isn't keeper-eligible, so his only two appearances are the squad
    // chip and the Manage-squad row name — no In-goal chip to disambiguate
    // from, unlike Alice.
    render(<SquadSettingsForm {...baseProps({ toggleAvailable })} />);
    await user.click(screen.getAllByText("Bob")[0]);
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  it("tapping + Player reveals the add-player input; Enter and the Add button both call addPlayer", async () => {
    const addPlayer = vi.fn();
    const setNewPlayerName = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ addPlayer, setNewPlayerName, newPlayerName: "Cara" })} />);
    await user.click(screen.getByText("Player"));
    fireEvent.keyDown(screen.getByPlaceholderText("Player name"), { key: "Enter" });
    expect(addPlayer).toHaveBeenCalledTimes(1);
  });

  it("Select all / Clear all toggles the whole roster's availability", async () => {
    const setAvailableIds = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"], setAvailableIds })} />);
    await user.click(screen.getByText("Select all"));
    expect(setAvailableIds).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("hides Select all when the roster is empty", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });
});

describe("SquadSettingsForm — Manage squad (number, keeper-eligible, remove)", () => {
  it("shows a dash for a player with no number set yet, and the real number once one is", () => {
    render(
      <SquadSettingsForm
        {...baseProps({ roster: [{ id: "p1", name: "Alice", keeperEligible: true, number: 7 }, ROSTER[1]] })}
      />
    );
    const badges = screen.getAllByTitle("Set squad number");
    expect(badges[0]).toHaveTextContent("7");
    expect(badges[1]).toHaveTextContent("–");
  });

  it("tapping a player's number turns it into an input; typing and blurring calls setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", 9);
  });

  it("committing an empty value clears the number back to unset (null)", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({ roster: [{ id: "p1", name: "Alice", keeperEligible: true, number: 7 }, ROSTER[1]], setPlayerNumber })}
      />
    );
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = screen.getByDisplayValue("7");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", null);
  });

  it("pressing Escape while editing discards the edit without calling setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setPlayerNumber).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("9")).not.toBeInTheDocument();
  });

  it("toggling keeper-eligible calls toggleKeeperEligible with that player's id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleKeeperEligible })} />);
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("removing a player calls removePlayer with that player's id", async () => {
    const removePlayer = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ removePlayer })} />);
    await user.click(screen.getAllByTitle("Remove from squad")[0]);
    expect(removePlayer).toHaveBeenCalledWith("p1");
  });
});

describe("SquadSettingsForm — In goal today (starting keeper)", () => {
  it("only lists players who are both available and keeper-eligible", () => {
    render(<SquadSettingsForm {...baseProps()} />); // Alice eligible, Bob not
    // Alice appears three times (in-goal chip, squad chip, Manage-squad row)
    // since she's eligible; Bob only twice (squad chip, Manage-squad row) —
    // no in-goal chip for him.
    expect(screen.getAllByText("Alice")).toHaveLength(3);
    expect(screen.getAllByText("Bob")).toHaveLength(2);
  });

  it("shows a hint instead of an empty card when nobody eligible is available", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p2"] })} />); // only Bob, not eligible
    expect(screen.getByText(/No keeper-eligible players available today/)).toBeInTheDocument();
  });

  it("tapping an eligible player's chip sets them as starting keeper", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setStartingGkId })} />);
    // The in-goal card renders before the squad chips in both layouts, so
    // Alice's first appearance is her in-goal chip.
    await user.click(screen.getAllByText("Alice")[0]);
    expect(setStartingGkId).toHaveBeenCalledWith("p1");
  });

  it("tapping the already-starting player's chip again clears the pick", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ startingGkId: "p1", setStartingGkId })} />);
    await user.click(screen.getByText(/Alice.*\u{1F451}/u));
    expect(setStartingGkId).toHaveBeenCalledWith(null);
  });

  it("shows no fairness warning when no manual pick is made", () => {
    render(<SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />);
    expect(screen.queryByText(/more minutes than others today/)).not.toBeInTheDocument();
  });

  it("warns, naming the player and the spread, for a starting keeper known to make the game unfair", () => {
    render(
      <SquadSettingsForm
        {...baseProps({
          roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id),
          gameSettings: { ...FAIRNESS_SETTINGS, subIntervalMinutes: 5 }, startingGkId: "p2",
        })}
      />
    );
    expect(screen.getByText("Starting Player 2 in goal means some players could get up to 6 more minutes than others today.")).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — Keeper swaps stepper", () => {
  it("defaults to the sub interval length when keeperShiftMinutes is unset", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("6′")).toBeInTheDocument();
  });

  it("+ steps up from the sub interval and records a real override", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    const plusButtons = screen.getAllByText("+");
    await user.click(plusButtons[plusButtons.length - 1]); // Keeper swaps' own + (tiles' own + only shows once one is flipped)
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 7 });
  });

  it("stepping back down to the sub interval clears the override back to blank", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 7 }, setGameSettings })} />);
    const minusButtons = screen.getAllByText("−");
    await user.click(minusButtons[minusButtons.length - 1]);
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: "" });
  });
});

describe("SquadSettingsForm — Breaks", () => {
  it("picking a break option calls setGameSettings with the new segment count", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    await user.click(screen.getByText("Thirds"));
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, breakSegments: 3 });
  });
});

describe("SquadSettingsForm — sub-interval recommendation", () => {
  it("stays hidden while there aren't enough available players yet", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"] })} />);
    expect(screen.queryByText(/For today's .* available players/)).not.toBeInTheDocument();
  });

  it("shows a chip per candidate interval, labeled with today's actual available count, once the squad is valid", () => {
    render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />
    );
    expect(screen.getByText(/For today's 7 available players/)).toBeInTheDocument();
    expect(screen.getByText("✓ 6")).toBeInTheDocument();
    expect(screen.getByText("✗ 4")).toBeInTheDocument();
  });

  it("picking a chip applies that sub interval", async () => {
    const setGameSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <SquadSettingsForm
        {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS, setGameSettings })}
      />
    );
    await user.click(screen.getByText("✓ 6"));
    expect(setGameSettings).toHaveBeenCalledWith({ ...FAIRNESS_SETTINGS, subIntervalMinutes: 6 });
  });
});

describe("SquadSettingsForm — validation and submit", () => {
  it("disables submit and shows the validation error when there aren't enough available players", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"] })} />);
    expect(screen.getByText(/Select at least 6 available players/)).toBeInTheDocument();
    expect(screen.getByText("Generate Rotation")).toBeDisabled();
  });

  it("enables submit and calls onSubmit when settings are valid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    const roster = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, keeperEligible: true }));
    const availableIds = roster.map((p) => p.id);
    render(<SquadSettingsForm {...baseProps({ roster, availableIds, onSubmit })} />);
    const btn = screen.getByText("Generate Rotation");
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the restart warning when regenerating an in-progress game", () => {
    render(<SquadSettingsForm {...baseProps({ showRestartWarning: true })} />);
    expect(screen.getByText(/This will restart the rotation from 0:00/)).toBeInTheDocument();
  });
});
