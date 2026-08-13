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
    showRestartWarning: false,
    onSubmit: vi.fn(),
    submitLabel: "Generate Rotation",
    ...overrides,
  };
}

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
    await user.click(screen.getAllByTitle("Toggle available today")[1]);
    expect(toggleAvailable).toHaveBeenCalledWith("p2");
  });

  it("toggling keeper-eligible calls toggleKeeperEligible with that player's id", async () => {
    const toggleKeeperEligible = vi.fn();
    const user = userEvent.setup();
    render(<SquadSettingsForm {...baseProps({ toggleKeeperEligible })} />);
    await user.click(screen.getAllByTitle("Toggle keeper-eligible")[0]);
    expect(toggleKeeperEligible).toHaveBeenCalledWith("p1");
  });

  it("shows available players numbered by their position in availableIds, not roster order", () => {
    render(<SquadSettingsForm {...baseProps({ availableIds: ["p2", "p1"] })} />);
    // Roster order is [Alice, Bob], but availableIds puts Bob first -> Bob is "1", Alice is "2".
    const badges = screen.getAllByTitle("Toggle available today");
    expect(badges[0]).toHaveTextContent("2"); // Alice's badge — she's availableIds[1]
    expect(badges[1]).toHaveTextContent("1"); // Bob's badge — he's availableIds[0]
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
