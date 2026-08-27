// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  linkGoogleAccount: vi.fn(),
  signInWithExistingCredential: vi.fn(),
}));
import { linkGoogleAccount, signInWithExistingCredential } from "../lib/auth.js";
import SaveTeamSheet from "./SaveTeamSheet.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SaveTeamSheet", () => {
  it("shows the explainer and a Google button, closing on success — the real linking already happened, nothing more to do here", async () => {
    linkGoogleAccount.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={onClose} />);

    expect(screen.getByText("Save your team")).toBeInTheDocument();
    await user.click(screen.getByText("Sign in with Google"));
    expect(linkGoogleAccount).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tapping the scrim or dragging away calls onClose without linking anything", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={onClose} />);
    await user.click(screen.getByTestId("save-team-sheet").previousSibling); // the scrim
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(linkGoogleAccount).not.toHaveBeenCalled();
  });

  it("stays quiet (goes back to resting, no error) if the popup was just closed/cancelled", async () => {
    linkGoogleAccount.mockRejectedValue({ code: "auth/popup-closed-by-user" });
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={vi.fn()} />);
    await user.click(screen.getByText("Sign in with Google"));
    await screen.findByText("Sign in with Google"); // back to resting
    expect(screen.queryByText(/Couldn't sign in/)).not.toBeInTheDocument();
  });

  it("shows a friendly error on a real failure, and the button works again after", async () => {
    linkGoogleAccount.mockRejectedValue({ code: "auth/network-request-failed" });
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={vi.fn()} />);
    await user.click(screen.getByText("Sign in with Google"));
    expect(await screen.findByText(/Couldn't sign in/)).toBeInTheDocument();
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
  });

  // The core "don't lose data" scenario: this Google account already has a
  // different Bench Buddy account. Explains the trade-off plainly and asks,
  // rather than silently doing either thing.
  it("offers the explicit choice when the Google account already belongs to a different account", async () => {
    const conflictCredential = { providerId: "google.com", token: "fake" };
    linkGoogleAccount.mockResolvedValue({ ok: false, conflictCredential });
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={vi.fn()} />);

    await user.click(screen.getByText("Sign in with Google"));
    expect(await screen.findByText("Already saved elsewhere")).toBeInTheDocument();
    expect(screen.getByText(/already has a Bench Buddy team saved/)).toBeInTheDocument();
    expect(screen.getByText(/left behind/)).toBeInTheDocument();
  });

  it("'Sign in to that account' completes the switch with the exact credential from the conflict, without a second popup", async () => {
    const conflictCredential = { providerId: "google.com", token: "fake" };
    linkGoogleAccount.mockResolvedValue({ ok: false, conflictCredential });
    signInWithExistingCredential.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={onClose} />);

    await user.click(screen.getByText("Sign in with Google"));
    await screen.findByText("Already saved elsewhere");
    await user.click(screen.getByText("Sign in to that account"));

    expect(signInWithExistingCredential).toHaveBeenCalledWith(conflictCredential);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel on the conflict screen backs out without switching accounts", async () => {
    linkGoogleAccount.mockResolvedValue({ ok: false, conflictCredential: {} });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SaveTeamSheet onClose={onClose} />);

    await user.click(screen.getByText("Sign in with Google"));
    await screen.findByText("Already saved elsewhere");
    await user.click(screen.getByText("Cancel"));

    expect(signInWithExistingCredential).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
