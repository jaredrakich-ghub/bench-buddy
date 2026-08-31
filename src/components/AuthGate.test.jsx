// @vitest-environment jsdom
//
// Progressive auth's entry point. The behaviour under test is entirely
// about *when* signInAnon gets called and what shows meanwhile/on
// failure — not Firebase itself, which is mocked throughout.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/auth.js", () => ({
  onAuthChange: vi.fn(),
  signInAnon: vi.fn(),
  completeEmailLinkSignInIfPresent: vi.fn(),
  completeEmailLinkSignInWithEmail: vi.fn(),
  signInWithExistingCredential: vi.fn(),
  consumeJustSignedOutFlag: vi.fn(),
}));
import {
  onAuthChange, signInAnon, completeEmailLinkSignInIfPresent, completeEmailLinkSignInWithEmail, signInWithExistingCredential,
  consumeJustSignedOutFlag,
} from "../lib/auth.js";
import AuthGate from "./AuthGate.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  // The overwhelmingly common case for every test below: this page load
  // isn't a return visit via an emailed magic link at all. Tests covering
  // that flow specifically override this per-test.
  completeEmailLinkSignInIfPresent.mockResolvedValue(null);
  // Ditto — most nulls in these tests are a brand-new visitor, not someone
  // who just tapped Sign out. The one test that's specifically about that
  // path overrides this itself.
  consumeJustSignedOutFlag.mockReturnValue(false);
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

  it("renders children(user) once a real session is reported — never calls signInAnon", async () => {
    mockAuthChange({ uid: "u1", isAnonymous: false, email: "coach@example.com" });
    render(<AuthGate>{(user) => <div>Signed in as {user.email}</div>}</AuthGate>);
    // The email-link check (completeEmailLinkSignInIfPresent) resolves on
    // its own microtask even for an ordinary load with no link at all — a
    // real, if tiny, extra tick every load goes through, so this waits for
    // it rather than asserting synchronously.
    expect(await screen.findByText("Signed in as coach@example.com")).toBeInTheDocument();
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

  // Real-use feedback: signing out used to always land back in a fresh
  // anonymous session, so the only way back to an existing Google-linked
  // account was through Save your team's own "your changes will be lost"
  // conflict sheet — alarming, even when there was nothing real to lose.
  // consumeJustSignedOutFlag is how AuthGate tells this null apart from a
  // brand-new visitor's — signOutUser (auth.js) sets it right before
  // signing out.
  it("goes straight to sign-in, skipping the anonymous bootstrap, right after an explicit sign-out", async () => {
    consumeJustSignedOutFlag.mockReturnValue(true);
    mockAuthChange(null);
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

    expect(await screen.findByText("Sign in with Google")).toBeInTheDocument();
    expect(signInAnon).not.toHaveBeenCalled();
    // Not a failure — no error banner, unlike the anon-bootstrap-failed case.
    expect(screen.queryByText(/Couldn't start a guest session/)).not.toBeInTheDocument();
    // Real-use feedback: a real backup option belongs here too, not just
    // "sign back in for real" — see SignIn.jsx's own showGuestOption.
    expect(screen.getByText("Continue as Guest")).toBeInTheDocument();
  });

  it("does NOT offer Continue as Guest on the anon-bootstrap-failed path — that's what just failed", async () => {
    signInAnon.mockRejectedValue({ code: "auth/operation-not-allowed" });
    mockAuthChange(null);
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>);
    await screen.findByText(/Couldn't start a guest session/);
    expect(screen.queryByText("Continue as Guest")).not.toBeInTheDocument();
  });

  // Real-use feedback, reproduced twice in a row: signing back in with
  // Google after a sign-out briefly flashed back to the sign-in screen
  // before finishing on its own, with no further tap needed. Traced to
  // onAuthStateChanged bouncing through more than one null while
  // signInWithPopup resolves (a known Firebase quirk) — the *second* null
  // found consumeJustSignedOutFlag already consumed and, before this fix,
  // fell through to signInAnon() regardless.
  it("a second null right behind the first (mid-Google-sign-in) doesn't re-trigger signInAnon", async () => {
    consumeJustSignedOutFlag.mockReturnValue(true); // only ever true on the *first* read
    const auth = mockAuthChange(null);
    render(<AuthGate>{(user) => <div>App content for {user.uid}</div>}</AuthGate>);
    expect(await screen.findByText("Sign in with Google")).toBeInTheDocument();

    // The spurious second null — consumeJustSignedOutFlag would report
    // false here in the real one-shot implementation, same as it does for
    // this mock now that mockReturnValue's default applies again... but
    // mockReturnValue keeps returning true for every call by default, so
    // pin it to false explicitly for this one, matching a real second read.
    consumeJustSignedOutFlag.mockReturnValue(false);
    auth.emit(null);
    expect(signInAnon).not.toHaveBeenCalled();
    expect(screen.getByText("Sign in with Google")).toBeInTheDocument();

    // ...then the real sign-in actually lands, same as it did without any
    // of this happening.
    auth.emit({ uid: "coach-1", isAnonymous: false });
    expect(await screen.findByText("App content for coach-1")).toBeInTheDocument();
  });

  it("falls back to the real sign-in screen, with an explanatory error, if the guest session can't be started", async () => {
    signInAnon.mockRejectedValue({ code: "auth/operation-not-allowed" });
    mockAuthChange(null);
    render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

    expect(await screen.findByText("Sign in with Google")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't start a guest session/)).toBeInTheDocument();
  });

  // The other progressive-auth entry point: a coach returning via the
  // magic link SaveTeamSheet's "Continue with Email" sent them, rather
  // than the anonymous-bootstrap path every test above covers.
  describe("returning via an emailed sign-in link", () => {
    it("does nothing extra on an ordinary load that isn't a link at all", async () => {
      completeEmailLinkSignInIfPresent.mockResolvedValue(null);
      mockAuthChange({ uid: "u1", isAnonymous: false });
      render(<AuthGate>{() => <div>App content</div>}</AuthGate>);
      expect(await screen.findByText("App content")).toBeInTheDocument();
    });

    it("prompts for the email again when opened on a different device/browser than the one that sent it", async () => {
      completeEmailLinkSignInIfPresent.mockResolvedValue({ needsEmail: true });
      completeEmailLinkSignInWithEmail.mockResolvedValue({ ok: true });
      mockAuthChange({ uid: "guest-1", isAnonymous: true });
      const user = userEvent.setup();
      render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

      expect(await screen.findByText("Confirm your email")).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText("you@email.com"), "coach@example.com");
      await user.click(screen.getByText("Continue"));

      expect(completeEmailLinkSignInWithEmail).toHaveBeenCalledWith("coach@example.com");
      expect(await screen.findByText("App content")).toBeInTheDocument();
    });

    it("offers the explicit choice when the link's email already belongs to a different account", async () => {
      completeEmailLinkSignInIfPresent.mockResolvedValue({ ok: false, conflictCredential: { fake: true } });
      mockAuthChange({ uid: "guest-1", isAnonymous: true });
      render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

      expect(await screen.findByText("Already saved elsewhere")).toBeInTheDocument();
      expect(screen.getByText(/left behind/)).toBeInTheDocument();
    });

    it("'Sign in to that account' completes the switch with the link's own credential", async () => {
      completeEmailLinkSignInIfPresent.mockResolvedValue({ ok: false, conflictCredential: { fake: true } });
      signInWithExistingCredential.mockResolvedValue(undefined);
      mockAuthChange({ uid: "guest-1", isAnonymous: true });
      const user = userEvent.setup();
      render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

      await screen.findByText("Already saved elsewhere");
      await user.click(screen.getByText("Sign in to that account"));

      expect(signInWithExistingCredential).toHaveBeenCalledWith({ fake: true });
      expect(await screen.findByText("App content")).toBeInTheDocument();
    });

    it("a real failure (expired/used link) explains itself and lets the coach continue with whatever session they've already got", async () => {
      completeEmailLinkSignInIfPresent.mockRejectedValue({ code: "auth/invalid-action-code" });
      mockAuthChange({ uid: "guest-1", isAnonymous: true });
      const user = userEvent.setup();
      render(<AuthGate>{() => <div>App content</div>}</AuthGate>);

      expect(await screen.findByText("That link didn't work")).toBeInTheDocument();
      await user.click(screen.getByText("Continue"));
      expect(await screen.findByText("App content")).toBeInTheDocument();
    });
  });
});
