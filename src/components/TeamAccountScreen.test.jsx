// @vitest-environment jsdom
//
// No test file existed for this screen before progressive auth — scoped
// here to just the isAnonymous-aware Account group this change adds, not a
// full rewrite of the screen's pre-existing (untested, unchanged) behaviour.
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  linkGoogleAccount: vi.fn(),
  signInWithExistingCredential: vi.fn(),
  sendLoginEmailLink: vi.fn(),
}));
import TeamAccountScreen from "./TeamAccountScreen.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const TEAM = { id: "t1", name: "Scorpions", roster: [] };

function baseProps(overrides = {}) {
  return {
    teams: [TEAM],
    activeTeamId: "t1",
    onSwitch: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    userEmail: "coach@example.com",
    isAnonymous: false,
    onSignOut: vi.fn(),
    onDeleteAccount: vi.fn(),
    onShowManageSquad: vi.fn(),
    crestSrc: undefined,
    // SaveTeamSheet's own "team photo" data — a minimal one-player squad
    // is enough here, since this file only checks that the sheet opens at
    // all; SaveTeamSheet.test.jsx covers what it renders in real detail.
    onFieldPlayers: [{ id: "p1", isGk: true }],
    benchIds: [],
    nameOf: (id) => (id === "p1" ? "Jack" : id),
    numberOf: () => 1,
    ...overrides,
  };
}

describe("TeamAccountScreen — Account group (progressive auth)", () => {
  it("shows Signed in / Sign out for a non-anonymous account, same as before", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: false })} />);
    expect(screen.getByText("Signed in")).toBeInTheDocument();
    expect(screen.getByText("coach@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.queryByText("Save Season Data")).not.toBeInTheDocument();
  });

  // Real-use feedback: relocated from the Account group to sit directly
  // under "+ Add a team" in Your teams, and renamed "Save your team" ->
  // "Save Season Data" — see TeamAccountScreen.jsx's own comment on why.
  it("shows 'Save Season Data' in the same group as + Add a team, for an anonymous account", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.getByText("Save Season Data")).toBeInTheDocument();
    expect(screen.queryByText("Save your team")).not.toBeInTheDocument();
    expect(screen.queryByText("Signed in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
    // Your teams group, not Account — shares a group container with
    // "+ Add a team" (DOM order/exact adjacency isn't asserted here).
    const yourTeamsGroup = screen.getByText("Add a team").closest("div");
    expect(yourTeamsGroup).toContainElement(screen.getByText("Save Season Data"));
  });

  // The Account group isn't just empty for an anonymous account now that
  // the actual action moved out of it — a plain informational row takes
  // its place instead (see TeamAccountScreen.jsx's own comment).
  it("shows a plain 'Playing as a guest' row in the Account group for an anonymous account", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.getByText("Playing as a guest")).toBeInTheDocument();
  });

  it("tapping 'Save Season Data' opens the linking sheet", async () => {
    const user = userEvent.setup();
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.queryByTestId("save-team-screen")).not.toBeInTheDocument();
    await user.click(screen.getByText("Save Season Data"));
    expect(screen.getByTestId("save-team-screen")).toBeInTheDocument();
  });

  // Real-use feedback: moved here from two ambient badges on MatchView.jsx
  // (the cog button, and the Team & account menu row) that read as "too
  // much before we've shown value" — this row's own icon tile is now the
  // only place any such indicator shows.
  it("shows a small dot on Save Season Data's own icon tile", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    const row = screen.getByText("Save Season Data").closest("button");
    expect(row.querySelector('[style*="border-radius: 50%"]')).toBeTruthy();
  });

  it("'Delete my account' still works the same regardless of isAnonymous", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.getByText("Delete my account")).toBeInTheDocument();
  });
});
