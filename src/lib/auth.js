// Thin wrapper around Firebase Auth (Google sign-in, plus an anonymous
// guest session — see signInAnon/linkGoogleAccount below — no passwords to
// create, remember, or reset). Kept separate from the components that use
// it so the rest of the app deals with plain functions/callbacks, not
// Firebase's API shape directly.
import {
  GoogleAuthProvider, signInWithPopup, signInAnonymously, linkWithPopup, signInWithCredential,
  signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup,
} from "firebase/auth";
import { auth } from "./firebaseClient.js";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

// Progressive auth: every first-time visitor gets one of these automatically
// (see AuthGate.jsx) so the whole app — add players, build a rotation, run
// a match — works with no sign-in screen at all. It's a real Firebase Auth
// user with a real uid, so Firestore reads/writes work exactly the same as
// for a signed-in one; the only thing missing is a way to get back to this
// data from a different device/browser, which is exactly what linking
// (below) is for. Requires the Anonymous provider to be turned on in the
// Firebase console — see AuthGate.jsx's own comment for what happens if
// it isn't.
export async function signInAnon() {
  await signInAnonymously(auth);
}

// The "save your team" upgrade: attaches a real Google identity to the
// current anonymous session's *existing* uid, rather than creating a new
// account and migrating data across — every team/roster/rotation already
// saved under this uid just keeps working, untouched, the moment this
// succeeds. Deliberately linkWithPopup (not signInWithPopup) for exactly
// that reason.
//
// Returns { ok: true } on success, or { ok: false, conflictCredential }
// when this Google account already belongs to a *different* Bench Buddy
// account (auth/credential-already-in-use — a real scenario: the same
// coach already signed in normally with this account on another device).
// That's not a generic failure, so it's not thrown — the caller
// (SaveTeamSheet.jsx) needs the credential itself to offer "sign in to
// that account instead" without prompting the Google popup a second time,
// which is exactly what GoogleAuthProvider.credentialFromError hands back.
// Any other error is a real failure and does throw, same as everywhere
// else auth calls in this app.
export async function linkGoogleAccount() {
  try {
    await linkWithPopup(auth.currentUser, googleProvider);
    return { ok: true };
  } catch (err) {
    if (err.code === "auth/credential-already-in-use") {
      return { ok: false, conflictCredential: GoogleAuthProvider.credentialFromError(err) };
    }
    throw err;
  }
}

// The recovery path when linkGoogleAccount comes back with a
// conflictCredential: switches over to the *existing* account that
// credential already belongs to. This intentionally does not try to merge
// or preserve the outgoing anonymous session's data — the coach has
// already been told plainly (SaveTeamSheet.jsx's own copy) that anything
// not yet saved on this device is left behind before they confirm this.
export async function signInWithExistingCredential(credential) {
  await signInWithCredential(auth, credential);
}

export async function signOutUser() {
  await signOut(auth);
}

// Permanently deletes the signed-in user's Firebase Auth account. Doesn't
// touch any Firestore data — the caller deletes the user's teams (and
// everything under them) first, since the security rules key off
// request.auth, which stops being available the instant this succeeds.
//
// A Google sign-in session can go stale enough that Firebase requires a
// fresh sign-in before allowing account deletion (auth/requires-recent-
// login). Rather than surface that as a raw error, re-prompt through the
// same Google popup once and retry — that's exactly what the error is
// asking for, not a real failure.
export async function deleteAccount() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteUser(user);
  } catch (err) {
    if (err.code === "auth/requires-recent-login") {
      await reauthenticateWithPopup(user, googleProvider);
      await deleteUser(user);
    } else {
      throw err;
    }
  }
}

// Calls `callback(user)` immediately with the current auth state, and again
// every time it changes (sign-in, sign-out, session restored on reload).
// `user` is null when signed out. Returns the unsubscribe function.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
