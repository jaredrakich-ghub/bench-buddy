import { useState } from "react";
import { signInWithGoogle, sendLoginEmailLink } from "../lib/auth.js";
import { fontStyle, styles, tokens } from "./styles.js";
import { GoogleIcon, EnvelopeIcon } from "./authIcons.jsx";
import headerMascot from "../assets/header-mascot.jpg";

// AuthGate's fallback — rendered whenever there's no session to hand the
// rest of the app: either an anonymous session couldn't even be started,
// or (more commonly now) the coach just tapped Sign out and this is the
// deliberate straight-to-sign-in screen for getting back in (see
// AuthGate.jsx's own comment on skippedAnonAfterSignOut). Progressive auth
// still means nobody sees this on a first-ever visit — signInAnon handles
// that silently instead.
//
// Real-use feedback: now that Sign out routes here directly rather than
// this only ever being a rare anon-bootstrap-failure fallback, it needed
// to be a genuinely complete sign-in page, not Google-only — Email
// (passwordless magic-link, same mechanism SaveTeamSheet.jsx's own
// "Continue with Email" already uses) is the second option, reusing that
// exact field/button/copy rather than a second implementation of the same
// flow. No Apple, matching the earlier decision on SaveTeamSheet's own
// provider set.
//
// initialError: set only by AuthGate's own anon-bootstrap-failed path —
// every other case (the sign-out path, or this screen's very first render
// before progressive auth existed at all) leaves it omitted.
export default function SignIn({ initialError = "" }) {
  // idle (provider picker, whether or not `error` also has something to
  // show alongside it) | signingIn | email | sendingEmail | emailSent |
  // emailError — no separate "error" phase: the provider-picker view
  // covers idle and signingIn either way, and the error banner is driven
  // by the `error` string alone.
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(initialError);
  const [email, setEmail] = useState("");

  const handleGoogle = async () => {
    setError("");
    setPhase("signingIn");
    try {
      await signInWithGoogle();
      // onAuthChange (AuthGate) swaps this whole screen out on success —
      // this only matters if that takes a moment, so the button doesn't
      // sit stuck on "Signing in…" in the meantime.
    } catch (err) {
      // A cancelled/closed popup isn't a real error worth showing.
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setError("Couldn't sign in — check your connection and try again.");
      }
    }
    setPhase("idle");
  };

  const handleSendEmailLink = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setPhase("sendingEmail");
    try {
      await sendLoginEmailLink(email.trim());
      setPhase("emailSent");
    } catch {
      setPhase("emailError");
    }
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
        {phase === "email" || phase === "sendingEmail" || phase === "emailError" ? (
          <form onSubmit={handleSendEmailLink} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Not part of any design spec — this whole email step didn't
                have a way back to reconsider Google (SaveTeamSheet.jsx's
                own identical email step has the same gap; not fixed there
                too, since only this screen was in scope here). Plain text
                button, deliberately minimal rather than a styled control
                nobody specified. */}
            <button
              type="button"
              onClick={() => setPhase("idle")}
              style={{
                alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer",
                fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14, color: tokens.color.mutedText,
              }}
            >
              ‹ Back
            </button>
            <input
              style={styles.mdSaveTeamEmailField}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button style={styles.mdSaveTeamSendLinkBtn} type="submit" disabled={!email.trim() || phase === "sendingEmail"}>
              {phase === "sendingEmail" ? "Sending…" : "Send me a link"}
            </button>
            <div style={styles.mdSaveTeamReassurance}>No password. We email you a link that signs you in and keeps you in.</div>
            {phase === "emailError" && <div style={styles.mdSignInError}>Couldn't send that link — check your connection and try again.</div>}
          </form>
        ) : phase === "emailSent" ? (
          <div style={styles.mdSaveTeamReassurance}>We sent a link to {email}. Open it on this device to finish signing in.</div>
        ) : (
          <>
            <button
              style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamGoogleBtn }}
              onClick={handleGoogle}
              disabled={phase === "signingIn"}
            >
              <span style={styles.mdSaveTeamProviderChip}>
                <GoogleIcon />
              </span>
              <span style={styles.mdSaveTeamProviderLabel}>{phase === "signingIn" ? "Signing in…" : "Sign in with Google"}</span>
            </button>
            <button style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamEmailBtn }} onClick={() => setPhase("email")}>
              <span style={styles.mdSaveTeamProviderChip}>
                <EnvelopeIcon />
              </span>
              <span style={styles.mdSaveTeamProviderLabel}>Sign in with Email</span>
            </button>
            {error && <div style={styles.mdSignInError}>{error}</div>}
          </>
        )}
      </div>

      <div style={styles.mdSignInVersion}>v0.1.0</div>
    </div>
  );
}
