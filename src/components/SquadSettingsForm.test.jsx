// @vitest-environment jsdom
//
// Component tests for SquadSettingsForm — a fully controlled form (every
// value comes from props, every change goes out through a callback prop),
// so these tests check that the right callback fires with the right value
// rather than checking the DOM updates itself — the component owns no
// state of its own to update.
//
// fireEvent.change (not userEvent.type) is used on the controlled inputs
// deliberately: typing character-by-character into an input whose value
// prop never actually changes (setGameSettings/setNewPlayerName are mocks
// here, not real state updates) doesn't accumulate the way it would against
// real app state — each simulated keystroke would just refire against the
// same starting value. Firing one "changed to this full value" event is
// what actually exercises the onChange handler correctly here.
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

describe("SquadSettingsForm — rendering", () => {
  it("shows the roster, the available count, and the interval preview", () => {
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("2 available")).toBeInTheDocument();
    expect(screen.getByText(/sub windows this game/)).toBeInTheDocument();
  });

  it("shows an empty-state message when the roster has no players yet", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.getByText("No players yet. Add your squad above.")).toBeInTheDocument();
  });

  it("mentions the keeper shift interval in the preview once one is set", () => {
    render(
      <SquadSettingsForm
        {...baseProps({ gameSettings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6, keeperShiftMinutes: 12 } })}
      />
    );
    expect(screen.getByText(/keeper changes every 2 sub windows/)).toBeInTheDocument();
  });
});

describe("SquadSettingsForm — game settings inputs", () => {
  it("changing players-on-field calls setGameSettings with the new number", () => {
    const setGameSettings = vi.fn();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    fireEvent.change(screen.getByDisplayValue("5"), { target: { value: "6" } });
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 6, gameMinutes: 40, subIntervalMinutes: 6 });
  });

  it("clearing a field to blank stores an empty string, not a stray value", () => {
    const setGameSettings = vi.fn();
    render(<SquadSettingsForm {...baseProps({ setGameSettings })} />);
    fireEvent.change(screen.getByDisplayValue("40"), { target: { value: "" } });
    expect(setGameSettings).toHaveBeenCalledWith({ fieldSize: 5, gameMinutes: "", subIntervalMinutes: 6 });
  });
});

describe("SquadSettingsForm — squad list", () => {
  it("adding a player types into the name field and calls addPlayer", async () => {
    const setNewPlayerName = vi.fn();
    const addPlayer = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setNewPlayerName, addPlayer })} />);
    fireEvent.change(screen.getByPlaceholderText("Add player name"), { target: { value: "Cara" } });
    expect(setNewPlayerName).toHaveBeenCalledWith("Cara");
    await user.click(screen.getByText("Add"));
    expect(addPlayer).toHaveBeenCalledTimes(1);
  });

  it("pressing Enter in the name field also calls addPlayer", () => {
    const addPlayer = vi.fn();
    render(<SquadSettingsForm {...baseProps({ addPlayer })} />);
    fireEvent.keyDown(screen.getByPlaceholderText("Add player name"), { key: "Enter" });
    expect(addPlayer).toHaveBeenCalledTimes(1);
  });

  it("removing a player calls removePlayer with that player's id", async () => {
    const removePlayer = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ removePlayer })} />);
    await user.click(screen.getAllByTitle("Remove from squad")[0]);
    expect(removePlayer).toHaveBeenCalledWith("p1");
  });

  it("toggling availability calls toggleAvailable with that player's id", async () => {
    const toggleAvailable = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleAvailable })} />);
    // Both p1/p2 are available by default (baseProps), so both toggles carry
    // the "mark unavailable" title — index into them the same way the old
    // test did (roster order).
    await user.click(screen.getAllByTitle("Available today — tap to mark unavailable")[1]);
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  it("toggling keeper-eligible calls toggleKeeperEligible with that player's id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleKeeperEligible })} />);
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("marks each player's toggle by their own availability, independent of roster/availableIds order", () => {
    // Deliberate redesign (match-day redesign step 7): the availability
    // toggle used to double as a live "your position among today's
    // available players" counter — a workaround from before real squad
    // numbers existed (see squadNumber.js). Now that a real number exists,
    // this is just a plain available/not-available toggle.
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p2"] })} />); // only Bob available
    const toggles = screen.getAllByTitle(/available today/i);
    expect(toggles[0]).toHaveAttribute("title", expect.stringContaining("Not available")); // Alice, p1
    expect(toggles[1]).toHaveAttribute("title", expect.stringContaining("tap to mark unavailable")); // Bob, p2
  });
});

describe("SquadSettingsForm — squad number", () => {
  it("shows a dash for a player with no number set yet, and the real number once one is", () => {
    render(
      <SquadSettingsForm
        {...baseProps({ roster: [{ id: "p1", name: "Alice", keeperEligible: true, number: 7 }, ROSTER[1]] })}
      />
    );
    const badges = screen.getAllByTitle("Set squad number");
    expect(badges[0]).toHaveTextContent("7"); // Alice
    expect(badges[1]).toHaveTextContent("–"); // Bob, unset
  });

  it("tapping a player's number turns it into an input; typing and blurring calls setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]); // Alice
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", 9);
  });

  it("committing an empty value clears the number back to unset (null), not 0 or NaN", async () => {
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
    expect(screen.queryByDisplayValue("9")).not.toBeInTheDocument(); // back to the plain badge
  });
});

describe("SquadSettingsForm — select all / clear all", () => {
  it("shows 'Select all' and selects every roster id when not everyone is available", async () => {
    const setAvailableIds = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"], setAvailableIds })} />);
    await user.click(screen.getByText("Select all"));
    expect(setAvailableIds).toHaveBeenCalledWith(["p1", "p2"]);
  });

  it("shows 'Clear all' and clears availability when everyone is already available", async () => {
    const setAvailableIds = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1", "p2"], setAvailableIds })} />);
    await user.click(screen.getByText("Clear all"));
    expect(setAvailableIds).toHaveBeenCalledWith([]);
  });

  it("hides the select-all control entirely when the roster is empty", () => {
    render(<SquadSettingsForm {...baseProps({ roster: [], availableIds: [] })} />);
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear all")).not.toBeInTheDocument();
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

describe("SquadSettingsForm — manual starting keeper", () => {
  it("only offers the 'start in goal' picker for players who are both available and keeper-eligible", () => {
    // Alice: available + keeper-eligible -> gets the button. Bob: available
    // but not keeper-eligible -> no button, same as today's roster/props default.
    render(<SquadSettingsForm {...baseProps()} />);
    expect(screen.getAllByTitle("Start this player in goal")).toHaveLength(1);
  });

  it("does not offer the picker for a keeper-eligible player who isn't available today", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p2"] })} />); // only Bob (not keeper-eligible) is available
    expect(screen.queryByTitle("Start this player in goal")).not.toBeInTheDocument();
  });

  it("picking a player sets them as the starting keeper", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ setStartingGkId })} />);
    await user.click(screen.getByTitle("Start this player in goal"));
    expect(setStartingGkId).toHaveBeenCalledWith("p1");
  });

  it("clicking the already-picked player again clears the pick", async () => {
    const setStartingGkId = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ startingGkId: "p1", setStartingGkId })} />);
    await user.click(screen.getByTitle("Cancel — don't start in goal"));
    expect(setStartingGkId).toHaveBeenCalledWith(null);
  });

  it("shows no fairness warning when no manual pick is made", () => {
    render(<SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />);
    expect(screen.queryByText(/more minutes than others today/)).not.toBeInTheDocument();
  });

  it("shows no fairness warning for a starting keeper that keeps the game fair", () => {
    render(
      <SquadSettingsForm
        {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS, startingGkId: "p1" })}
      />
    );
    expect(screen.queryByText(/more minutes than others today/)).not.toBeInTheDocument();
  });

  it("warns, naming the player and the spread, for a starting keeper known to make the game unfair", () => {
    // 5 min subs (not FAIRNESS_SETTINGS' usual 6) — verified directly: every
    // starting choice at 42min/5min-subs for this 7-player roster produces a
    // real 6-minute spread, so this is a genuine, still-unsafe pick after
    // the pickGkFrom fairness fix (which resolved the 6-min-sub case
    // entirely, leaving no unsafe candidate left to test the warning against).
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

describe("SquadSettingsForm — sub-interval recommendation", () => {
  it("stays hidden while there aren't enough available players yet — never judges an in-progress headcount", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p1"] })} />); // fails the fieldSize+1 minimum
    expect(screen.queryByText(/For today's .* available players/)).not.toBeInTheDocument();
    expect(screen.queryByText("✓ 6")).not.toBeInTheDocument();
  });

  it("shows a chip per candidate interval, labeled with today's actual available count, once the squad is valid", () => {
    render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />
    );
    expect(screen.getByText(/For today's 7 available players/)).toBeInTheDocument();
    // Verified scenario: at 42 min / fieldSize 5 / 7 players, 4, 5, and 8
    // min subs are candidates where even the best starting keeper can't
    // stay within one interval; 6 and 7 are fine.
    expect(screen.getByText("✗ 4")).toBeInTheDocument();
    expect(screen.getByText("✗ 5")).toBeInTheDocument();
    expect(screen.getByText("✓ 6")).toBeInTheDocument();
    expect(screen.getByText("✓ 7")).toBeInTheDocument();
    expect(screen.getByText("✗ 8")).toBeInTheDocument();
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

  it("re-labels the available count and re-checks fairness when the headcount changes, rather than caching the first answer", () => {
    const { rerender } = render(
      <SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: FAIRNESS_ROSTER.map((p) => p.id), gameSettings: FAIRNESS_SETTINGS })} />
    );
    expect(screen.getByText(/For today's 7 available players/)).toBeInTheDocument();

    const sixAvailable = FAIRNESS_ROSTER.slice(0, 6).map((p) => p.id);
    rerender(<SquadSettingsForm {...baseProps({ roster: FAIRNESS_ROSTER, availableIds: sixAvailable, gameSettings: FAIRNESS_SETTINGS })} />);
    expect(screen.getByText(/For today's 6 available players/)).toBeInTheDocument();
  });
});
