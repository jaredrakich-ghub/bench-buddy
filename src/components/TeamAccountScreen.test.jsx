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
    expect(screen.queryByText("Save your team")).not.toBeInTheDocument();
  });

  it("shows a single 'Save your team' row for an anonymous account instead", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.getByText("Save your team")).toBeInTheDocument();
    expect(screen.queryByText("Signed in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("tapping 'Save your team' opens the linking sheet", async () => {
    const user = userEvent.setup();
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.queryByTestId("save-team-screen")).not.toBeInTheDocument();
    await user.click(screen.getByText("Save your team"));
    expect(screen.getByTestId("save-team-screen")).toBeInTheDocument();
  });

  it("'Delete my account' still works the same regardless of isAnonymous", () => {
    render(<TeamAccountScreen {...baseProps({ isAnonymous: true })} />);
    expect(screen.getByText("Delete my account")).toBeInTheDocument();
  });
});
