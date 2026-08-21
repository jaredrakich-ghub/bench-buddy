import { useState } from "react";
import { signInWithGoogle } from "../lib/auth.js";
import { fontStyle, styles } from "./styles.js";
import headerMascot from "../assets/header-mascot.jpg";

// The gate shown whenever nobody's signed in. Google-only by design (see
// the Firebase/account discussion) — no password to create or reset.
//
// README > A9-Signin (#10f) describes a magic-link flow (email field, "Send
// me a link", "no password... we email you a link") — this app actually
// authenticates via a Google OAuth popup, not email + a mailed link. Rather
// than build a non-functional email field to match the mockup literally,
// this restyles around the real flow: same lockup/button/footer shapes and
// sizes the README specifies, "Sign in with Google" where it says "Send me
// a link". Had a reassurance line under the button too ("One tap with your
// Google account — no password to create or remember") — real-use
// feedback: dropped it, a coach signing in with Google already knows how
// that works.
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
    <div style={styles.mdSignInWrap}>
      <style>{fontStyle}</style>
      <div style={styles.mdSignInLockup}>
        <div style={styles.mdSignInCrest}>
          <img src={headerMascot} alt="" style={styles.mdSignInCrestImg} />
        </div>
        <h1 style={styles.mdSignInWordmark}>Bench Buddy</h1>
        <p style={styles.mdSignInTagline}>Fair minutes, easy subs.</p>
      </div>

      <div style={styles.mdSignInForm}>
        <button style={styles.mdSignInBtn} onClick={handleSignIn} disabled={signingIn}>
          <GoogleIcon />
          {signingIn ? "Signing in…" : "Sign in with Google"}
        </button>
        {error && <div style={styles.mdSignInError}>{error}</div>}
      </div>

      <div style={styles.mdSignInVersion}>v0.1.0</div>
    </div>
  );
}

// Standard 4-color "G" mark, drawn inline so the button doesn't depend on
// an external image/icon font.
function GoogleIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 009 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 000 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
