import { useState } from "react";
import { signInWithGoogle, sendLoginEmailLink, signInAnon } from "../lib/auth.js";
import { fontStyle, styles, tokens } from "./styles.js";
import { GoogleIcon, EnvelopeIcon, GuestIcon } from "./authIcons.jsx";
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
// flow. No Apple yet (needs a paid developer account/console setup this
// session can't do — noted for later, not forgotten).
//
// A third option, Guest (showGuestOption below), only ever shows on the
// sign-out path specifically — explicitly not on a first-ever visit
// (still fully silent/automatic, per progressive auth) and not on the
// anon-bootstrap-failed path either (offering "continue as guest" right
// where that just failed would be circular, not a real backup option).
// It just re-runs signInAnon directly — same mechanism, now a deliberate
// choice instead of an automatic one.
//
// initialError: set only by AuthGate's own anon-bootstrap-failed path —
// every other case (the sign-out path, or this screen's very first render
// before progressive auth existed at all) leaves it omitted.
//
// onClose: only set when SquadSettingsForm.jsx's own "Already have a
// team? Sign in" link opens this as a dismissible overlay, mid-anonymous-
// session — every other caller (AuthGate, which renders this as the
// entire app, nothing else to go back to) leaves it omitted, and no close
// control renders at all in that case.
export default function SignIn({ initialError = "", showGuestOption = false, onClose }) {
  // idle (provider picker, whether or not `error` also has something to
  // show alongside it) | email | sendingEmail | emailSent | emailError —
  // no separate "error"/"signingIn" phases: which provider is currently
  // attempting a sign-in is tracked separately (signingInVia below), since
  // the idle view covers both resting and any of its own buttons being
  // busy, and the error banner is driven by the `error` string alone.
  const [phase, setPhase] = useState("idle");
  const [signingInVia, setSigningInVia] = useState(null); // null | "google" | "guest"
  const [error, setError] = useState(initialError);
  const [email, setEmail] = useState("");

  const handleGoogle = async () => {
    setError("");
    setSigningInVia("google");
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
    setSigningInVia(null);
  };

  const handleGuest = async () => {
    setError("");
    setSigningInVia("guest");
    try {
      await signInAnon();
      // onAuthChange (AuthGate) picks up the resulting anonymous user, same
      // as the automatic first-visit path — this is just a deliberate,
      // manual trigger of the identical mechanism.
    } catch {
      setError("Couldn't continue as a guest — check your connection and try again.");
    }
    setSigningInVia(null);
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
    <div style={{ ...styles.mdSignInWrap, position: "relative" }}>
      <style>{fontStyle}</style>
      {onClose && (
        <button style={styles.mdSignInCloseBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
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
              disabled={signingInVia !== null}
            >
              <span style={styles.mdSaveTeamProviderChip}>
                <GoogleIcon />
              </span>
              <span style={styles.mdSaveTeamProviderLabel}>{signingInVia === "google" ? "Signing in…" : "Sign in with Google"}</span>
            </button>
            <button
              style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamEmailBtn }}
              onClick={() => setPhase("email")}
              disabled={signingInVia !== null}
            >
              <span style={styles.mdSaveTeamProviderChip}>
                <EnvelopeIcon />
              </span>
              <span style={styles.mdSaveTeamProviderLabel}>Sign in with Email</span>
            </button>
            {showGuestOption && (
              <button
                style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamGuestBtn }}
                onClick={handleGuest}
                disabled={signingInVia !== null}
              >
                <span style={styles.mdSaveTeamProviderChip}>
                  <GuestIcon />
                </span>
                <span style={styles.mdSaveTeamProviderLabel}>{signingInVia === "guest" ? "Continuing…" : "Continue as Guest"}</span>
              </button>
            )}
            {error && <div style={styles.mdSignInError}>{error}</div>}
          </>
        )}
      </div>

      <div style={styles.mdSignInVersion}>v0.1.0</div>
    </div>
  );
}
