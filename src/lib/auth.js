// Thin wrapper around Firebase Auth (Google sign-in, plus an anonymous
// guest session — see signInAnon/linkGoogleAccount below — no passwords to
// create, remember, or reset). Kept separate from the components that use
// it so the rest of the app deals with plain functions/callbacks, not
// Firebase's API shape directly.
import {
  GoogleAuthProvider, EmailAuthProvider, signInWithPopup, signInAnonymously, linkWithPopup, linkWithCredential,
  signInWithCredential, sendSignInLinkToEmail, isSignInWithEmailLink,
  signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup,
} from "firebase/auth";
import { auth } from "./firebaseClient.js";

const googleProvider = new GoogleAuthProvider();

// Where sendLoginEmailLink stashes the address it just sent a link to, so
// completeEmailLinkSignInIfPresent can find it again when the coach taps
// that link and comes back — Firebase's own documented pattern for this
// flow (it deliberately doesn't put the email in the link itself). Only
// ever missing if the link is opened in a different browser/device than
// the one that requested it; see that function's own comment for what
// happens then.
const EMAIL_LINK_STORAGE_KEY = "bb-email-link-address";

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

// Email's own version of linkGoogleAccount — no popup, no password:
// Firebase emails a one-time link, and completeEmailLinkSignInIfPresent
// (below) finishes the job when the coach taps it and the app reloads.
// Requires "Email link (passwordless sign-in)" turned on in the Firebase
// console under the Email/Password provider — a separate toggle from
// plain Email/Password itself, which this app never enables (no
// passwords, by design).
export async function sendLoginEmailLink(email) {
  await sendSignInLinkToEmail(auth, email, { url: window.location.origin, handleCodeInApp: true });
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

// Called once on every app load (AuthGate) to check whether this load *is*
// the coach returning via that emailed link, and finish signing them in if
// so. Returns null on every ordinary load (by far the common case) so the
// caller can just move on without any special handling.
//
// Three real outcomes when it *is* a link:
//  - { needsEmail: true } — opened in a different browser/device than the
//    one that requested it, so the address isn't in localStorage to
//    confirm against (Firebase's own documented case, not a bug — a magic
//    link can't know who opened it without asking again). The caller
//    re-prompts for the email once; there's no way to do better than that
//    without more infrastructure than this app has.
//  - { ok: false, conflictCredential } — same "this identity already
//    belongs to a different Bench Buddy account" case linkGoogleAccount
//    handles, same recovery path (signInWithExistingCredential). Unlike
//    Google, the credential doesn't need extracting from the error — it's
//    the exact one built two lines below, before the attempt.
//  - { ok: true } — linked (or signed in, if this load somehow has no
//    current session at all) successfully.
export async function completeEmailLinkSignInIfPresent() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;

  const email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  if (!email) return { needsEmail: true };
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  return finishEmailLinkSignIn(email);
}

// The needsEmail recovery step above: the coach re-enters their address,
// and this finishes exactly the same way completeEmailLinkSignInIfPresent
// would have if it had found one in localStorage.
export async function completeEmailLinkSignInWithEmail(email) {
  return finishEmailLinkSignIn(email);
}

async function finishEmailLinkSignIn(email) {
  const credential = EmailAuthProvider.credentialWithLink(email, window.location.href);
  // Strips the sign-in params back out of the URL either way, so a reload
  // right after doesn't try to complete the same link a second time.
  window.history.replaceState({}, "", window.location.pathname);
  try {
    if (auth.currentUser) {
      await linkWithCredential(auth.currentUser, credential);
    } else {
      await signInWithCredential(auth, credential);
    }
    return { ok: true };
  } catch (err) {
    if (err.code === "auth/credential-already-in-use" || err.code === "auth/email-already-in-use") {
      return { ok: false, conflictCredential: credential };
    }
    throw err;
  }
}

// Set the instant signOutUser() runs, consumed (read + reset) once by
// AuthGate the next time it sees user===null — that's how it tells "the
// coach just explicitly signed out" apart from "genuinely no session at
// all yet" (a brand-new first-ever visit), since Firebase's onAuthChange
// reports both as the exact same null. See AuthGate.jsx's own comment for
// what each case does differently.
let justSignedOut = false;

export function consumeJustSignedOutFlag() {
  const value = justSignedOut;
  justSignedOut = false;
  return value;
}

export async function signOutUser() {
  justSignedOut = true;
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
