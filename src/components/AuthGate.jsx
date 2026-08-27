import { useEffect, useState } from "react";
import { onAuthChange, signInAnon } from "../lib/auth.js";
import SignIn from "./SignIn.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

// Sits in front of the whole app. Progressive auth: nobody ever sees a
// sign-in screen just to use Bench Buddy — the moment Firebase reports no
// session at all, this quietly starts an anonymous one (signInAnon) rather
// than gating on <SignIn/>, so add-players/build-a-rotation/run-a-match all
// work immediately. onAuthChange then reports that anonymous user like any
// other, and `children(user)` (a render-prop so the user reaches the app
// without a separate context/plumbing layer for what's currently a single
// consumer) proceeds exactly as it always has — the rest of the app
// doesn't need to know or care that a user is anonymous, except
// TeamAccountScreen's own upgrade prompt (user.isAnonymous).
//
// anonFailed is its own piece of state, not folded into `user`, so a
// failed attempt can't be confused with "genuinely signed out" (which,
// with this gate, should now never actually happen — even Sign Out just
// leads straight back to a fresh anonymous session, not a blank slate with
// nothing signed in at all).
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = no session (about to auto-anon)
  const [anonFailed, setAnonFailed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user !== null) return;
    let cancelled = false;
    // Cleared at the start of every attempt, not just on success — a
    // previous failure (e.g. a transient network blip right as the app
    // loaded) shouldn't permanently pin this to the SignIn fallback for
    // the rest of the session once `user` cycles back to null again
    // (a sign-out, most likely).
    setAnonFailed(false);
    signInAnon().catch(() => {
      // Most likely the Anonymous provider isn't turned on yet in the
      // Firebase console (a one-time setup step, not a code bug) — either
      // way, a real Google sign-in is still a completely valid way in, so
      // fall back to the full sign-in screen rather than getting stuck on
      // a spinner that will never resolve.
      if (!cancelled) setAnonFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user === undefined) {
    return <LoadingScreen message="Loading…" />;
  }

  if (user === null) {
    if (anonFailed) {
      return <SignIn initialError="Couldn't start a guest session — sign in with Google to continue." />;
    }
    return <LoadingScreen message="Loading…" />;
  }

  return children(user);
}
