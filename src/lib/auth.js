// Thin wrapper around Firebase Auth (Google sign-in only, per the
// decision to keep this simple — no passwords to create, remember, or
// reset). Kept separate from the components that use it so the rest of
// the app deals with plain functions/callbacks, not Firebase's API shape
// directly.
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseClient.js";

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  await signOut(auth);
}

// Calls `callback(user)` immediately with the current auth state, and again
// every time it changes (sign-in, sign-out, session restored on reload).
// `user` is null when signed out. Returns the unsubscribe function.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
