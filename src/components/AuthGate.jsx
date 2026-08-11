import { useEffect, useState } from "react";
import { onAuthChange, signOutUser } from "../lib/auth.js";
import { colors } from "./styles.js";
import SignIn from "./SignIn.jsx";

// Sits in front of the whole app: shows a brief loading state while Firebase
// checks whether a session already exists, then either the sign-in screen
// or `children` (the actual app). Stage 1 only — SubRotationPlanner itself
// doesn't use Firestore yet, so signing in doesn't change where data lives
// yet; this is purely the gate, verified on its own before Stage 2 touches
// any real data.
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <>
      {children}
      {/* Temporary Stage 1 sign-out control, minimal styling — Stage 2 will
          fold this into the header properly alongside the team switcher. */}
      <button
        style={styles.signOutBtn}
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true);
          await signOutUser();
        }}
      >
        {signingOut ? "Signing out…" : `Sign out (${user.email})`}
      </button>
    </>
  );
}

const styles = {
  loadingWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: colors.chalk,
  },
  loadingText: { color: colors.grass, fontWeight: 700, fontFamily: "system-ui, -apple-system, sans-serif" },
  signOutBtn: {
    display: "block", margin: "12px auto 24px", background: "transparent", border: "none", color: "#7C8983",
    fontSize: 12, textDecoration: "underline", cursor: "pointer", fontFamily: "system-ui, -apple-system, sans-serif",
  },
};
