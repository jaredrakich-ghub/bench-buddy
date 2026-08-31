// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  linkGoogleAccount: vi.fn(),
  sendLoginEmailLink: vi.fn(),
}));
import { linkGoogleAccount, sendLoginEmailLink } from "../lib/auth.js";
import SaveTeamSheet from "./SaveTeamSheet.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const NAMES = { p1: "Jack", p2: "Atu", p3: "Eli", p4: "Rocco", p5: "George", p6: "Hugo", p7: "Otis", p8: "John" };
const NUMBERS = { p1: 1, p2: 2, p3: 3, p4: 4, p5: 5, p6: 6, p7: 7, p8: 8 };
const nameOf = (id) => NAMES[id] || id;
const numberOf = (id) => NUMBERS[id] ?? "?";

// Mirrors the reference screenshot exactly (screens/24-login-5aside.png):
// 5 on the field (Jack the keeper), 2 on the bench.
const FIVE_ON_FIELD = [
  { id: "p1", isGk: true }, { id: "p2", isGk: false }, { id: "p3", isGk: false },
  { id: "p4", isGk: false }, { id: "p5", isGk: false },
];
const TWO_ON_BENCH = ["p6", "p7"];

function baseProps(overrides = {}) {
  return { onFieldPlayers: FIVE_ON_FIELD, benchIds: TWO_ON_BENCH, nameOf, numberOf, onClose: vi.fn(), ...overrides };
}

describe("SaveTeamSheet", () => {
  it("shows every on-field player's shirt and name, and the bench pill for the rest", () => {
    render(<SaveTeamSheet {...baseProps()} />);
    ["Jack", "Atu", "Eli", "Rocco", "George"].forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
    expect(screen.getByText("Hugo and Otis on the bench")).toBeInTheDocument();
  });

  it("names a single bench player without 'and'", () => {
    render(<SaveTeamSheet {...baseProps({ benchIds: ["p6"] })} />);
    expect(screen.getByText("Hugo on the bench")).toBeInTheDocument();
  });

  it("names the first two and counts the rest once there are more than two on the bench", () => {
    render(<SaveTeamSheet {...baseProps({ benchIds: ["p6", "p7", "p8"] })} />);
    expect(screen.getByText("Hugo, Otis and 1 others on the bench")).toBeInTheDocument();
  });

  it("shows no bench pill at all when nobody's on the bench", () => {
    render(<SaveTeamSheet {...baseProps({ benchIds: [] })} />);
    expect(screen.queryByText(/on the bench/)).not.toBeInTheDocument();
  });

  it("shows the exact spec copy and both providers, closing on ✕ without linking anything", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SaveTeamSheet {...baseProps({ onClose })} />);
    expect(screen.getByText("Save your team")).toBeInTheDocument();
    expect(screen.getByText(/Everything you've already entered will be kept/)).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText("Continue with Email")).toBeInTheDocument();
    expect(screen.getByText(/linked to your account automatically/)).toBeInTheDocument();
    expect(screen.queryByText("Continue with Apple")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(linkGoogleAccount).not.toHaveBeenCalled();
  });

  // linkGoogleAccount is a real top-level redirect now (auth.js's own
  // comment on why) — this component never sees a success or conflict
  // outcome itself any more (the whole app reloads before that exists),
  // so there's no "closes on success" test here any more: that entire
  // resolution — success, conflict, or a real failure — is AuthGate's own
  // job now (AuthGate.test.jsx), on the load that comes back from Google.
  // What's left to cover here is only the synchronous kickoff itself.
  describe("Google", () => {
    it("kicks off the redirect without closing the sheet itself", async () => {
      linkGoogleAccount.mockResolvedValue(undefined);
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<SaveTeamSheet {...baseProps({ onClose })} />);
      await user.click(screen.getByText("Continue with Google"));
      expect(linkGoogleAccount).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("shows a friendly error on a real failure", async () => {
      linkGoogleAccount.mockRejectedValue({ code: "auth/network-request-failed" });
      const user = userEvent.setup();
      render(<SaveTeamSheet {...baseProps()} />);
      await user.click(screen.getByText("Continue with Google"));
      expect(await screen.findByText(/Couldn't sign in/)).toBeInTheDocument();
    });
  });

  describe("Email", () => {
    it("Continue with Email swaps in block 6's own field/button/reassurance copy, in the same shell", async () => {
      const user = userEvent.setup();
      render(<SaveTeamSheet {...baseProps()} />);
      await user.click(screen.getByText("Continue with Email"));
      expect(screen.getByPlaceholderText("you@email.com")).toBeInTheDocument();
      expect(screen.getByText("Send me a link")).toBeInTheDocument();
      expect(screen.getByText(/No password\. We email you a link/)).toBeInTheDocument();
      // Still the same shell — the shirts don't disappear underneath it.
      expect(screen.getByText("Jack")).toBeInTheDocument();
    });

    it("sends the link and shows a confirmation naming the address", async () => {
      sendLoginEmailLink.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<SaveTeamSheet {...baseProps()} />);
      await user.click(screen.getByText("Continue with Email"));
      await user.type(screen.getByPlaceholderText("you@email.com"), "coach@example.com");
      await user.click(screen.getByText("Send me a link"));

      expect(sendLoginEmailLink).toHaveBeenCalledWith("coach@example.com");
      expect(await screen.findByText("Check your email")).toBeInTheDocument();
      expect(screen.getByText(/coach@example.com/)).toBeInTheDocument();
    });

    it("shows a friendly error if sending fails, without losing what was typed", async () => {
      sendLoginEmailLink.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      render(<SaveTeamSheet {...baseProps()} />);
      await user.click(screen.getByText("Continue with Email"));
      await user.type(screen.getByPlaceholderText("you@email.com"), "coach@example.com");
      await user.click(screen.getByText("Send me a link"));

      expect(await screen.findByText(/Couldn't send that link/)).toBeInTheDocument();
      expect(screen.getByDisplayValue("coach@example.com")).toBeInTheDocument();
    });
  });

  // The 7- and 9-a-side worked examples (screens/25, screens/26) — proves
  // the tiering picks the right bucket and every player still renders,
  // without pinning down exact pixel positions (that's what the reference
  // screenshots are for, not an automated test).
  describe("squad-size tiers", () => {
    it("splits a 7-player field into two rows and still shows everyone", () => {
      const seven = ["p1", "p2", "p3", "p4", "p5", "p6", "p8"].map((id) => ({ id, isGk: id === "p1" }));
      render(<SaveTeamSheet {...baseProps({ onFieldPlayers: seven, benchIds: ["p7"] })} />);
      seven.forEach(({ id }) => expect(screen.getByText(nameOf(id))).toBeInTheDocument());
      expect(screen.getByText("Otis on the bench")).toBeInTheDocument();
    });

    it("handles a 9-player field (the largest named tier) without erroring", () => {
      const nine = Array.from({ length: 9 }, (_, i) => ({ id: `p${i + 1}`, isGk: i === 0 }));
      render(<SaveTeamSheet {...baseProps({ onFieldPlayers: nine, benchIds: [] })} />);
      expect(screen.getByText(nameOf("p1"))).toBeInTheDocument();
      expect(screen.getByText("p9")).toBeInTheDocument(); // nameOf's own fallback for an id with no roster entry
    });
  });
});
