// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  signInWithGoogle: vi.fn(),
  sendLoginEmailLink: vi.fn(),
}));
import { signInWithGoogle, sendLoginEmailLink } from "../lib/auth.js";
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

  // Progressive auth: AuthGate's own anon-bootstrap-failed fallback path —
  // see AuthGate.jsx/AuthGate.test.jsx. Not shown for the (now more
  // common) straight-after-Sign-out path — that one isn't a failure.
  it("shows a pre-filled error when AuthGate's anon-bootstrap-failed path passes one", () => {
    render(<SignIn initialError="Couldn't start a guest session — sign in with Google to continue." />);
    expect(screen.getByText(/Couldn't start a guest session/)).toBeInTheDocument();
  });
});
