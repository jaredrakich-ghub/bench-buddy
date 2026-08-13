// Thin wrapper around Firebase Auth (Google sign-in only, per the
// decision to keep this simple — no passwords to create, remember, or
// reset). Kept separate from the components that use it so the rest of
// the app deals with plain functions/callbacks, not Firebase's API shape
// directly.
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup } from "firebase/auth";
import { auth } from "./firebaseClient.js";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
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
