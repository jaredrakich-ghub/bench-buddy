// @vitest-environment jsdom
//
// Progressive auth's entry point. The behaviour under test is entirely
// about *when* signInAnon gets called and what shows meanwhile/on
// failure — not Firebase itself, which is mocked throughout.
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("../lib/auth.js", () => ({
  onAuthChange: vi.fn(),
  signInAnon: vi.fn(),
}));
import { onAuthChange, signInAnon } from "../lib/auth.js";
import AuthGate from "./AuthGate.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// onAuthChange's real shape: calls back immediately with the current state,
// then returns an unsubscribe function — reproduced here rather than
// hand-waved so AuthGate's own useEffect wiring is genuinely exercised.
function mockAuthChange(initialUser) {
  let callback;
  onAuthChange.mockImplementation((cb) => {
    callback = cb;
    cb(initialUser);
    return () => {};
  });
  return {
    emit: (user) => callback(user),
  };
}

describe("AuthGate", () => {
  it("shows a loading state before Firebase has reported any session", () => {
    onAuthChange.mockImplementation(() => () => {}); // never calls back
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders children(user) once a real session is reported — never calls signInAnon", () => {
    mockAuthChange({ uid: "u1", isAnonymous: false, email: "coach@example.com" });
    render(<AuthGate>{(user) => <div>Signed in as {user.email}</div>}</AuthGate>);
    expect(screen.getByText("Signed in as coach@example.com")).toBeInTheDocument();
    expect(signInAnon).not.toHaveBeenCalled();
  });

  // The whole point of progressive auth: no sign-in screen, ever, for a
  // brand-new visitor — a null user quietly starts a guest session instead.
  it("starts an anonymous session automatically when there's no user, with no sign-in screen at any point", async () => {
    signInAnon.mockResolvedValue(undefined);
    const auth = mockAuthChange(null);
    render(<AuthGate>{(user) => <div>App content for {user.uid}</div>}</AuthGate>);

    await waitFor(() => expect(signInAnon).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Sign in with Google")).not.toBeInTheDocument();

    // signInAnon succeeding doesn't render children itself — it's the
    // resulting onAuthStateChanged callback (mocked here directly) that
    // actually does, same as it would for a real Firebase round-trip.
    auth.emit({ uid: "guest-1", isAnonymous: true });
    expect(await screen.findByText("App content for guest-1")).toBeInTheDocument();
  });

  it("falls back to the real sign-in screen, with an explanatory error, if the guest session can't be started", async () => {
    signInAnon.mockRejectedValue({ code: "auth/operation-not-allowed" });
    mockAuthChange(null);
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

    expect(await screen.findByText("Sign in with Google")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't start a guest session/)).toBeInTheDocument();
  });
});
