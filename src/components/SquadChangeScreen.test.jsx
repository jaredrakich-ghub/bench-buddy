// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SquadChangeScreen from "./SquadChangeScreen.jsx";

afterEach(cleanup);

const ROSTER = [
  { id: "p1", name: "Alice" }, // on pitch
  { id: "p2", name: "Bob" }, // on bench
  { id: "p3", name: "Cara" }, // not here
];
const NUMBERS = { p1: 1, p2: 2, p3: 3 };
const numberOf = (id) => NUMBERS[id] ?? "?";

const PLAN = [
  { startMin: 0, endMin: 15, onField: [{ id: "p1", isGk: false }], bench: ["p2"] },
];

function renderScreen(props = {}) {
  return render(
    <SquadChangeScreen
      roster={ROSTER}
      availableIds={["p1", "p2"]}
      plan={PLAN}
      activeInterval={0}
      numberOf={numberOf}
      onAddArrival={vi.fn()}
      onRemoveAvailability={vi.fn()}
      onAddRosterPlayer={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  );
}

// A thin stateful wrapper standing in for SubRotationPlanner's real
// roster state — onAddRosterPlayer alone (a bare mock) can't make the new
// name actually show up in the grid/callout, since that depends on the
// `roster` prop growing to include it, the same way the real app's
// saveTeamData updates local state immediately (see useTeamRegistry.js).
function StatefulHarness({ onAddArrival, onClose }) {
  const [roster, setRoster] = useState(ROSTER);
  const addRosterPlayer = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newId = `new-${trimmed}`;
    setRoster((prev) => [...prev, { id: newId, name: trimmed }]);
    return newId;
  };
  return (
    <SquadChangeScreen
      roster={roster}
      availableIds={["p1", "p2"]}
      plan={PLAN}
      activeInterval={0}
      numberOf={(id) => NUMBERS[id] ?? "?"}
      onAddArrival={onAddArrival}
      onRemoveAvailability={vi.fn()}
      onAddRosterPlayer={addRosterPlayer}
      onClose={onClose}
    />
  );
}

describe("SquadChangeScreen", () => {
  it("shows the title, the in-count chip, and each card's status", () => {
    renderScreen();
    expect(screen.getByText("Who's here?")).toBeInTheDocument();
    expect(screen.getByText("2 in")).toBeInTheDocument();
    expect(screen.getByText("on pitch")).toBeInTheDocument(); // Alice
    expect(screen.getByText("bench")).toBeInTheDocument(); // Bob
    expect(screen.getByText("not here")).toBeInTheDocument(); // Cara
  });

  it("calls onClose when the back button is tapped", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen({ onClose });
    await user.click(screen.getByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selecting an unavailable player shows the arrival callout and an Add button, and commits on tap", async () => {
    const onAddArrival = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen({ onAddArrival, onClose });

    await user.click(screen.getByText("Cara"));
    expect(screen.getByText("Cara just arrived")).toBeInTheDocument();
    const addBtn = screen.getByText("Add Cara to the game");
    await user.click(addBtn);
    expect(onAddArrival).toHaveBeenCalledWith("p3");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selecting a bench player removes them immediately, with no confirmation step", async () => {
    const onRemoveAvailability = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen({ onRemoveAvailability, onClose });

    await user.click(screen.getByText("Bob"));
    expect(screen.queryByText(/just arrived/)).not.toBeInTheDocument();
    await user.click(screen.getByText("Remove Bob from the game"));
    expect(onRemoveAvailability).toHaveBeenCalledWith("p2");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("selecting a player currently on the pitch asks for confirmation before removing them", async () => {
    const onRemoveAvailability = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen({ onRemoveAvailability, onClose });

    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByText("Remove Alice from the game"));
    // Not removed yet — the heavier on-pitch removal asks first.
    expect(onRemoveAvailability).not.toHaveBeenCalled();
    expect(screen.getByText(/Alice is on the pitch right now/)).toBeInTheDocument();

    await user.click(screen.getByText("Yes, remove"));
    expect(onRemoveAvailability).toHaveBeenCalledWith("p1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel on the on-pitch confirmation backs out without removing anyone", async () => {
    const onRemoveAvailability = vi.fn();
    const user = userEvent.setup();
    renderScreen({ onRemoveAvailability });

    await user.click(screen.getByText("Alice"));
    await user.click(screen.getByText("Remove Alice from the game"));
    await user.click(screen.getByText("Cancel"));
    expect(onRemoveAvailability).not.toHaveBeenCalled();
    // Back to the normal action bar, not stuck on the confirm card.
    expect(screen.getByText("Remove Alice from the game")).toBeInTheDocument();
  });

  it("shows a + Player card; submitting a blank name is a no-op (onAddRosterPlayer returning null bails out)", async () => {
    const onAddRosterPlayer = vi.fn(); // default mock return is undefined, same as a real blank-name rejection
    const user = userEvent.setup();
    renderScreen({ onAddRosterPlayer });

    await user.click(screen.getByText("Player"));
    expect(screen.getByPlaceholderText("Player name")).toBeInTheDocument();
    await user.click(screen.getByText("Add"));
    expect(onAddRosterPlayer).toHaveBeenCalledWith("");
    expect(screen.queryByText(/just arrived/)).not.toBeInTheDocument(); // never selected — nothing to show
  });

  it("adding a brand-new player creates the roster entry and selects them as the arrival candidate", async () => {
    const onAddArrival = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<StatefulHarness onAddArrival={onAddArrival} onClose={onClose} />);

    await user.click(screen.getByText("Player"));
    await user.type(screen.getByPlaceholderText("Player name"), "Dev");
    await user.click(screen.getByText("Add"));

    // Same arrival flow an existing-but-unavailable player gets — no
    // second, separate instant-add path.
    expect(screen.getByText("Dev just arrived")).toBeInTheDocument();
    expect(screen.getByText("Add Dev to the game")).toBeInTheDocument();

    await user.click(screen.getByText("Add Dev to the game"));
    expect(onAddArrival).toHaveBeenCalledWith("new-Dev");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pressing Enter in the name field also submits", async () => {
    const onAddArrival = vi.fn();
    const user = userEvent.setup();
    render(<StatefulHarness onAddArrival={onAddArrival} onClose={vi.fn()} />);

    await user.click(screen.getByText("Player"));
    await user.type(screen.getByPlaceholderText("Player name"), "Eli{Enter}");
    expect(screen.getByText("Eli just arrived")).toBeInTheDocument();
  });

  it("tapping a selected card again deselects it and hides the action bar", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByText("Bob"));
    expect(screen.getByText("Remove Bob from the game")).toBeInTheDocument();
    await user.click(screen.getByText("Bob"));
    expect(screen.queryByText("Remove Bob from the game")).not.toBeInTheDocument();
  });
});
