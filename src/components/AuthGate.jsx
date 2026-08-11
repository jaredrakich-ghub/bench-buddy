import { useEffect, useState } from "react";
import { onAuthChange } from "../lib/auth.js";
import { colors } from "./styles.js";
import SignIn from "./SignIn.jsx";

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
    return (
      <div style={styles.loadingWrap}>
        <div style={styles.loadingText}>Loading…</div>
      </div>
    );
  }

  if (user === null) {
    return <SignIn />;
  }

  return children(user);
}

const styles = {
  loadingWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.chalk,
  },
  loadingText: { color: colors.grass, fontWeight: 700, fontFamily: "system-ui, -apple-system, sans-serif" },
};
