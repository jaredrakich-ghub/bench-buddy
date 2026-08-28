// @vitest-environment jsdom
//
// auth.js is otherwise a thin wrapper around Firebase Auth calls, not
// independently testable (every other export just forwards to the SDK) —
// but signOutUser/consumeJustSignedOutFlag's pairing is real, deterministic
// logic of its own (AuthGate.jsx relies on the reset-on-read contract), so
// it's worth covering directly rather than only through AuthGate's own
// mocked-module tests.
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    static credentialFromError() {
      return null;
    }
  },
  EmailAuthProvider: { credentialWithLink: vi.fn() },
  signInWithPopup: vi.fn(),
  signInAnonymously: vi.fn(),
  linkWithPopup: vi.fn(),
  linkWithCredential: vi.fn(),
  signInWithCredential: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  onAuthStateChanged: vi.fn(),
  deleteUser: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
}));
vi.mock("./firebaseClient.js", () => ({ auth: {} }));

import { signOutUser, consumeJustSignedOutFlag } from "./auth.js";

describe("signOutUser / consumeJustSignedOutFlag", () => {
  it("is false before any sign-out has happened", () => {
    expect(consumeJustSignedOutFlag()).toBe(false);
  });

  it("signOutUser sets the flag, and reading it resets it back to false", async () => {
    await signOutUser();
    expect(consumeJustSignedOutFlag()).toBe(true);
    // Reset on read — a *second* read (e.g. some later null unrelated to
    // this sign-out) must not still report the same sign-out again.
    expect(consumeJustSignedOutFlag()).toBe(false);
  });
});
