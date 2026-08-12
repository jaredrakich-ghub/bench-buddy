import { useEffect, useState } from "react";
import { onAuthChange } from "../lib/auth.js";
import SignIn from "./SignIn.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

// Sits in front of the whole app: shows a brief loading state while Firebase
// checks whether a session already exists, then either the sign-in screen
// or `children(user)` — a render-prop so the signed-in user (needed for
// Firestore access) reaches the app without a separate context/plumbing
// layer for what's currently a single consumer.
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out

  useEffect(() => {
    const unsubscribe = onAuthChange(setUser);
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return <LoadingScreen message="Loading…" />;
  }

  if (user === null) {
    return <SignIn />;
  }

  return children(user);
}
