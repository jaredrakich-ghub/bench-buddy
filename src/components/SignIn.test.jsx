// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  signInWithGoogle: vi.fn(),
  sendLoginEmailLink: vi.fn(),
  signInAnon: vi.fn(),
}));
import { signInWithGoogle, sendLoginEmailLink, signInAnon } from "../lib/auth.js";
import SignIn from "./SignIn.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignIn", () => {
  it("shows the wordmark, tagline, and both sign-in options", () => {
    render(<SignIn />);
    expect(screen.getByText("Bench Buddy")).toBeInTheDocument();
    expect(screen.getByText("Fair minutes, easy subs.")).toBeInTheDocument();
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    // Real-use feedback: this used to be Google-only (a rare anon-
    // bootstrap-failure fallback) — now that Sign out routes here
    // directly, it needed to be a genuinely complete sign-in page.
    expect(screen.getByText("Sign in with Email")).toBeInTheDocument();
    expect(screen.queryByText("Sign in with Apple")).not.toBeInTheDocument();
    // Guest is opt-in (showGuestOption) — not shown by default, i.e. not
    // on the anon-bootstrap-failed path (AuthGate never passes it there).
    expect(screen.queryByText("Continue as Guest")).not.toBeInTheDocument();
    // No close control unless a caller (SquadSettingsForm's "Already have
    // a team?" link) explicitly opens this as a dismissible overlay —
    // AuthGate itself renders this as the entire app, nothing to go back to.
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  });

  it("shows a close button when onClose is given, and calls it when tapped", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<SignIn onClose={onClose} />);
    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Real-device feedback: opened deep inside a scrolled page
  // (SquadSettingsForm's own "Already have a team?" link, near the
  // bottom), this rendered wherever that DOM position happened to fall —
  // entirely below the visible viewport on a scrolled page, easy to
  // mistake for the link doing nothing. mdSignInWrap (styles.js) is
  // position:fixed for exactly this reason; caught live, not by a test,
  // that an inline position:"relative" override (added earlier, for the
  // close button's own positioning context — no longer needed now that
  // mdSignInWrap itself provides one) was silently winning over it. This
  // guards the actual computed outcome directly, not just the style
  // object's own shape.
  it("is position:fixed to the viewport, not wherever it happens to land in normal document flow", () => {
    const { container } = render(<SignIn onClose={() => {}} />);
    expect(container.firstChild.style.position).toBe("fixed");
  });

  describe("Google", () => {
    it("calls signInWithGoogle when tapped, showing a signing-in state meanwhile", async () => {
      let resolveSignIn;
      signInWithGoogle.mockReturnValue(new Promise((res) => { resolveSignIn = res; }));
      const user = userEvent.setup();
      render(<SignIn />);

      await user.click(screen.getByText("Sign in with Google"));
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Signing in…")).toBeInTheDocument();

      resolveSignIn();
      await screen.findByText("Sign in with Google"); // back to the resting label once it resolves
    });

    it("shows a friendly error on a real failure", async () => {
      signInWithGoogle.mockRejectedValue({ code: "auth/network-request-failed" });
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Google"));
      expect(await screen.findByText(/Couldn't sign in/)).toBeInTheDocument();
    });

    it("stays quiet if the popup was just closed/cancelled by the user", async () => {
      signInWithGoogle.mockRejectedValue({ code: "auth/popup-closed-by-user" });
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Google"));
      await screen.findByText("Sign in with Google"); // back to resting, signingIn cleared
      expect(screen.queryByText(/Couldn't sign in/)).not.toBeInTheDocument();
    });
  });

  // Same mechanism SaveTeamSheet.jsx's own "Continue with Email" uses
  // (sendLoginEmailLink) — pure sign-in copy here instead of that
  // screen's "linking" framing, since there's no existing session to link
  // from at this point (AuthGate only ever renders this when there
  // genuinely isn't one).
  describe("Email", () => {
    it("swaps in the field/button/reassurance copy in place", async () => {
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Email"));
      expect(screen.getByPlaceholderText("you@email.com")).toBeInTheDocument();
      expect(screen.getByText("Send me a link")).toBeInTheDocument();
      expect(screen.getByText(/No password\. We email you a link/)).toBeInTheDocument();
    });

    it("sends the link and shows a confirmation naming the address", async () => {
      sendLoginEmailLink.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Email"));
      await user.type(screen.getByPlaceholderText("you@email.com"), "coach@example.com");
      await user.click(screen.getByText("Send me a link"));

      expect(sendLoginEmailLink).toHaveBeenCalledWith("coach@example.com");
      expect(await screen.findByText(/We sent a link to coach@example\.com/)).toBeInTheDocument();
    });

    it("shows a friendly error if sending fails, without losing what was typed", async () => {
      sendLoginEmailLink.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Email"));
      await user.type(screen.getByPlaceholderText("you@email.com"), "coach@example.com");
      await user.click(screen.getByText("Send me a link"));

      expect(await screen.findByText(/Couldn't send that link/)).toBeInTheDocument();
      expect(screen.getByDisplayValue("coach@example.com")).toBeInTheDocument();
    });

    it("Back returns to the provider picker, Google included", async () => {
      const user = userEvent.setup();
      render(<SignIn />);
      await user.click(screen.getByText("Sign in with Email"));
      await user.click(screen.getByText("‹ Back"));
      expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("you@email.com")).not.toBeInTheDocument();
    });
  });

  // Real-use feedback: sign out should offer a real backup option too, not
  // just "sign back in for real" — a deliberate re-trigger of the exact
  // same signInAnon mechanism the first-ever-visit path already uses
  // silently. Only ever shown when AuthGate passes showGuestOption (the
  // sign-out path specifically — see its own comment on why not the
  // anon-bootstrap-failed path).
  describe("Guest (showGuestOption)", () => {
    it("is hidden unless explicitly enabled", () => {
      render(<SignIn />);
      expect(screen.queryByText("Continue as Guest")).not.toBeInTheDocument();
    });

    it("calls signInAnon when tapped, showing a busy state meanwhile", async () => {
      let resolveAnon;
      signInAnon.mockReturnValue(new Promise((res) => { resolveAnon = res; }));
      const user = userEvent.setup();
      render(<SignIn showGuestOption />);

      await user.click(screen.getByText("Continue as Guest"));
      expect(signInAnon).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Continuing…")).toBeInTheDocument();
      // Every provider button disables while any one of them is busy.
      expect(screen.getByText("Sign in with Google").closest("button")).toBeDisabled();

      resolveAnon();
      await screen.findByText("Continue as Guest"); // back to resting once it resolves
    });

    it("shows a friendly error on failure", async () => {
      signInAnon.mockRejectedValue(new Error("network"));
      const user = userEvent.setup();
      render(<SignIn showGuestOption />);
      await user.click(screen.getByText("Continue as Guest"));
      expect(await screen.findByText(/Couldn't continue as a guest/)).toBeInTheDocument();
    });
  });

  // Progressive auth: AuthGate's own anon-bootstrap-failed fallback path —
  // see AuthGate.jsx/AuthGate.test.jsx. Not shown for the (now more
  // common) straight-after-Sign-out path — that one isn't a failure.
  it("shows a pre-filled error when AuthGate's anon-bootstrap-failed path passes one", () => {
    render(<SignIn initialError="Couldn't start a guest session — sign in with Google to continue." />);
    expect(screen.getByText(/Couldn't start a guest session/)).toBeInTheDocument();
  });
});
