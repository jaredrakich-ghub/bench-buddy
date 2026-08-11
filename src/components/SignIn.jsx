import { useState } from "react";
import { signInWithGoogle } from "../lib/auth.js";
import { colors } from "./styles.js";

// The gate shown whenever nobody's signed in. Google-only by design (see
// the Firebase/account discussion) — no password to create or reset.
export default function SignIn() {
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setError("");
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // onAuthChange (in AuthGate) picks up the resulting signed-in state;
      // nothing else to do here on success.
    } catch (err) {
      // A cancelled/closed popup isn't a real error worth showing.
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setError("Couldn't sign in — check your connection and try again.");
      }
    }
    setSigningIn(false);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logoMark}>⚽</div>
        <h1 style={styles.title}>BENCH BUDDY</h1>
        <p style={styles.tagline}>Sign in to save your squads and access them from any device.</p>
        <button style={styles.googleBtn} onClick={handleSignIn} disabled={signingIn}>
          <GoogleIcon />
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

// Standard 4-color "G" mark, drawn inline so the button doesn't depend on
// an external image/icon font.
function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 000 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: colors.chalk, padding: 20, fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    background: colors.cardBg, borderRadius: 16, padding: "32px 28px", maxWidth: 360, width: "100%",
    textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  logoMark: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 900, letterSpacing: 2, color: colors.grass, margin: "0 0 10px" },
  tagline: { fontSize: 13, color: "#5B6B64", lineHeight: 1.5, margin: "0 0 22px" },
  googleBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
    padding: "12px 16px", borderRadius: 10, border: "1px solid " + colors.border, background: "#fff",
    color: "#3C4043", fontWeight: 700, fontSize: 14, cursor: "pointer", minHeight: 44,
  },
  error: { marginTop: 14, fontSize: 12, color: colors.danger, fontWeight: 600 },
};
