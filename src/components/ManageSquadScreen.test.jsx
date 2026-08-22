// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManageSquadScreen from "./ManageSquadScreen.jsx";

afterEach(cleanup);

const ROSTER = [
  { id: "p1", name: "Alice", keeperEligible: true, number: 7 },
  { id: "p2", name: "Bob", keeperEligible: false },
];
const numberOf = (id) => ({ p1: 7, p2: 2 }[id] ?? "?");

function baseProps(overrides = {}) {
  return {
    roster: ROSTER,
    numberOf,
    setPlayerNumber: vi.fn(),
    renamePlayer: vi.fn(),
    removePlayer: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("ManageSquadScreen", () => {
  it("shows the title and a back button that calls onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ onClose })} />);
    expect(screen.getByText("Manage squad")).toBeInTheDocument();
    await user.click(screen.getByTitle("Back"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("lists every player's number and name, with no keeper-eligible toggle at all", () => {
    render(<ManageSquadScreen {...baseProps()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByTitle("Set squad number")).toHaveLength(2);
    // Option 1: eligibility stays out of here entirely — it only ever
    // lives in the Keepers section now.
    expect(screen.queryByTitle("Toggle keeper-eligible")).not.toBeInTheDocument();
  });

  it("shows an empty state when the roster has no players", () => {
    render(<ManageSquadScreen {...baseProps({ roster: [] })} />);
    expect(screen.getByText("No players yet.")).toBeInTheDocument();
  });

  it("tapping a player's number turns it into an input; typing and blurring calls setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", 9);
  });

  it("committing an empty number clears it back to unset (null)", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = screen.getByDisplayValue("7");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(setPlayerNumber).toHaveBeenCalledWith("p1", null);
  });

  it("pressing Escape while editing the number discards the edit without calling setPlayerNumber", async () => {
    const setPlayerNumber = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ setPlayerNumber })} />);
    await user.click(screen.getAllByTitle("Set squad number")[0]);
    const input = document.activeElement;
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(setPlayerNumber).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("9")).not.toBeInTheDocument();
  });

  it("tapping the pencil turns a player's name into an input; blurring calls renamePlayer", async () => {
    const renamePlayer = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ renamePlayer })} />);
    await user.click(screen.getAllByTitle("Rename player")[0]);
    const input = screen.getByDisplayValue("Alice");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.blur(input);
    expect(renamePlayer).toHaveBeenCalledWith("p1", "Alicia");
  });

  it("pressing Enter while renaming also commits", async () => {
    const renamePlayer = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ renamePlayer })} />);
    await user.click(screen.getAllByTitle("Rename player")[0]);
    const input = screen.getByDisplayValue("Alice");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(renamePlayer).toHaveBeenCalledWith("p1", "Alicia");
    // Field closes back up — the plain name text is showing again.
    expect(screen.queryByDisplayValue("Alicia")).not.toBeInTheDocument();
  });

  it("pressing Escape while renaming discards the edit without calling renamePlayer", async () => {
    const renamePlayer = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ renamePlayer })} />);
    await user.click(screen.getAllByTitle("Rename player")[0]);
    const input = screen.getByDisplayValue("Alice");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(renamePlayer).not.toHaveBeenCalled();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("removing a player calls removePlayer with that player's id", async () => {
    const removePlayer = vi.fn();
    const user = userEvent.setup();
    render(<ManageSquadScreen {...baseProps({ removePlayer })} />);
    await user.click(screen.getAllByTitle("Remove from squad")[0]);
    expect(removePlayer).toHaveBeenCalledWith("p1");
  });
});
