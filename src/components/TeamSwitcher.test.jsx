// @vitest-environment jsdom
//
// Component tests for TeamSwitcher — covers the everyday team-management
// flows (switch/rename/delete/add) plus, in more detail, account deletion:
// the newest and highest-stakes thing in this file (irreversible, and
// otherwise only ever verified by hand against the Firebase emulator).
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamSwitcher from "./TeamSwitcher.jsx";

afterEach(cleanup);

const TEAMS = [
  { id: "t1", name: "Scorpions", roster: [{ id: "p1" }, { id: "p2" }] },
  { id: "t2", name: "Hornets", roster: [{ id: "p3" }] },
];

function baseProps(overrides = {}) {
  return {
    teams: TEAMS,
    activeTeamId: "t1",
    onSwitch: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    userEmail: "coach@example.com",
    onSignOut: vi.fn(),
    onDeleteAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("TeamSwitcher — team list", () => {
  it("marks the active team and shows each team's player count", () => {
    render(<TeamSwitcher {...baseProps()} />);
    expect(screen.getByText("✓ Scorpions")).toBeInTheDocument();
    expect(screen.getByText("Hornets")).toBeInTheDocument();
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.getByText("1 players")).toBeInTheDocument();
  });

  it("switching to a non-active team calls onSwitch with its id", async () => {
    const onSwitch = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onSwitch })} />);
    await user.click(screen.getByText("Hornets"));
    expect(onSwitch).toHaveBeenCalledWith("t2");
  });

  it("disables deleting the only remaining team", () => {
    render(<TeamSwitcher {...baseProps({ teams: [TEAMS[0]] })} />);
    expect(screen.getByTitle("Can't delete your only team")).toBeDisabled();
  });
});

describe("TeamSwitcher — rename", () => {
  it("renaming a team calls onRename with the new value", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onRename })} />);
    await user.click(screen.getAllByTitle("Rename team")[0]); // Scorpions' row — first in TEAMS
    const input = screen.getByDisplayValue("Scorpions");
    await user.clear(input);
    await user.type(input, "Scorpions FC");
    await user.click(screen.getByText("Save"));
    expect(onRename).toHaveBeenCalledWith("t1", "Scorpions FC");
  });
});

describe("TeamSwitcher — delete team", () => {
  it("shows a confirmation before deleting, and cancel backs out without calling onDelete", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDelete })} />);
    await user.click(screen.getAllByTitle("Delete team")[0]); // Scorpions' row — first in TEAMS
    expect(screen.getByText(/Delete "Scorpions"/)).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/Delete "Scorpions"/)).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("confirming calls onDelete with the team id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDelete })} />);
    await user.click(screen.getAllByTitle("Delete team")[0]); // Scorpions' row — first in TEAMS
    await user.click(screen.getByText("Yes, delete"));
    expect(onDelete).toHaveBeenCalledWith("t1");
  });
});

describe("TeamSwitcher — add team", () => {
  it("creating a team calls onAdd with the trimmed name", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onAdd })} />);
    await user.click(screen.getByText("Add Team"));
    await user.type(screen.getByPlaceholderText("Team name"), "  Wasps  ");
    await user.click(screen.getByText("Create"));
    expect(onAdd).toHaveBeenCalledWith("Wasps");
  });

  it("the Create button is disabled until a name is entered", async () => {
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps()} />);
    await user.click(screen.getByText("Add Team"));
    expect(screen.getByText("Create")).toBeDisabled();
  });
});

describe("TeamSwitcher — sign out", () => {
  it("shows the signed-in email and calls onSignOut", async () => {
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onSignOut })} />);
    const btn = screen.getByText(/Sign out/);
    expect(btn).toHaveTextContent("coach@example.com");
    await user.click(btn);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("TeamSwitcher — delete account", () => {
  it("shows a warning naming every team before deleting, singular wording for one team", async () => {
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ teams: [TEAMS[0]] })} />);
    await user.click(screen.getByText("Delete my account"));
    expect(screen.getByText(/This permanently removes your team, every squad/)).toBeInTheDocument();
  });

  it("uses plural wording and the team count for more than one team", async () => {
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps()} />);
    await user.click(screen.getByText("Delete my account"));
    expect(screen.getByText(/This permanently removes all 2 of your teams/)).toBeInTheDocument();
  });

  it("cancel backs out without calling onDeleteAccount", async () => {
    const onDeleteAccount = vi.fn();
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDeleteAccount })} />);
    await user.click(screen.getByText("Delete my account"));
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByText("Yes, delete everything")).not.toBeInTheDocument();
    expect(onDeleteAccount).not.toHaveBeenCalled();
  });

  it("confirming calls onDeleteAccount and shows no error on success", async () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDeleteAccount })} />);
    await user.click(screen.getByText("Delete my account"));
    await user.click(screen.getByText("Yes, delete everything"));
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
    await screen.findByText("Deleting…"); // stays in the loading state — the real app unmounts this modal on success, not this component itself
    expect(screen.queryByText(/Couldn't delete/)).not.toBeInTheDocument();
  });

  it("shows an error and re-enables the button if deletion fails", async () => {
    const onDeleteAccount = vi.fn().mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDeleteAccount })} />);
    await user.click(screen.getByText("Delete my account"));
    await user.click(screen.getByText("Yes, delete everything"));
    expect(await screen.findByText(/Couldn't delete your account/)).toBeInTheDocument();
    expect(screen.getByText("Yes, delete everything")).not.toBeDisabled();
  });

  it("shows a specific message if the reauthentication popup was cancelled", async () => {
    const err = Object.assign(new Error("popup closed"), { code: "auth/popup-closed-by-user" });
    const onDeleteAccount = vi.fn().mockRejectedValue(err);
    const user = userEvent.setup();
    render(<TeamSwitcher {...baseProps({ onDeleteAccount })} />);
    await user.click(screen.getByText("Delete my account"));
    await user.click(screen.getByText("Yes, delete everything"));
    expect(await screen.findByText(/Sign-in was cancelled/)).toBeInTheDocument();
  });
});
