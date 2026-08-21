// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  signInWithGoogle: vi.fn(),
}));
import { signInWithGoogle } from "../lib/auth.js";
import SignIn from "./SignIn.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignIn", () => {
  it("shows the wordmark, tagline, and a Google sign-in button — no email field", () => {
    render(<SignIn />);
    expect(screen.getByText("Bench Buddy")).toBeInTheDocument();
    expect(screen.getByText("Fair minutes, easy subs.")).toBeInTheDocument();
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();
    // README > A9-Signin describes an email field for a magic-link flow —
    // this app only has Google sign-in, so there should be no email input.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    // Real-use feedback: dropped this reassurance line entirely — a coach
    // signing in with Google already knows how that works.
    expect(screen.queryByText(/no password to create or remember/)).not.toBeInTheDocument();
  });

  it("calls signInWithGoogle when the button is tapped, showing a signing-in state meanwhile", async () => {
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
