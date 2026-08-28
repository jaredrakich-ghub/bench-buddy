import { useEffect, useState } from "react";
import {
  onAuthChange, signInAnon, completeEmailLinkSignInIfPresent, completeEmailLinkSignInWithEmail,
  signInWithExistingCredential,
} from "../lib/auth.js";
import SignIn from "./SignIn.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import { styles, tokens } from "./styles.js";

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
//
// emailLinkPhase handles the *other* progressive-auth entry point — a
// coach returning via the emailed magic link from SaveTeamSheet's own
// "Continue with Email". Checked once, on mount, independently of the
// anon-bootstrap effect below: whichever order they resolve in, both
// converge on the same correct outcome (see auth.js's own comment on
// completeEmailLinkSignInIfPresent for why), so there's no real race to
// coordinate here, just two separate things this gate can be doing before
// the app itself is ready to render.
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = no session (about to auto-anon)
  const [anonFailed, setAnonFailed] = useState(false);
  const [emailLinkPhase, setEmailLinkPhase] = useState("checking"); // checking | none | needsEmail | conflict | error
  const [emailLinkConflict, setEmailLinkConflict] = useState(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailLinkBusy, setEmailLinkBusy] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    completeEmailLinkSignInIfPresent()
      .then((result) => {
        if (cancelled) return;
        if (!result) setEmailLinkPhase("none");
        else if (result.needsEmail) setEmailLinkPhase("needsEmail");
        else if (!result.ok) {
          setEmailLinkConflict(result.conflictCredential);
          setEmailLinkPhase("conflict");
        } else setEmailLinkPhase("none");
      })
      .catch(() => {
        // A real failure (expired/already-used link, network blip) — worth
        // saying so plainly rather than silently dropping them into
        // whatever session they've already got with no explanation for
        // why the link they just tapped didn't do anything.
        if (!cancelled) setEmailLinkPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitEmailForLink = async (e) => {
    e.preventDefault();
    if (!emailInput.trim() || emailLinkBusy) return;
    setEmailLinkBusy(true);
    try {
      const result = await completeEmailLinkSignInWithEmail(emailInput.trim());
      if (result.ok) {
        setEmailLinkPhase("none");
      } else {
        setEmailLinkConflict(result.conflictCredential);
        setEmailLinkPhase("conflict");
      }
    } catch {
      setEmailLinkPhase("error");
    }
    setEmailLinkBusy(false);
  };

  const switchToConflictAccount = async () => {
    setEmailLinkBusy(true);
    try {
      await signInWithExistingCredential(emailLinkConflict);
      setEmailLinkPhase("none");
    } catch {
      setEmailLinkPhase("error");
    }
    setEmailLinkBusy(false);
  };

  if (emailLinkPhase === "checking") {
    return <LoadingScreen message="Loading…" />;
  }

  if (emailLinkPhase === "needsEmail") {
    return (
      <EmailLinkPrompt
        title="Confirm your email"
        body="Enter the email address you used to request this link — it looks like it was opened on a different device or browser than the one that sent it."
      >
        <form onSubmit={submitEmailForLink} style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <input
            style={styles.mdSaveTeamEmailField}
            type="email"
            placeholder="you@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            autoFocus
          />
          <button style={styles.mdSaveTeamSendLinkBtn} disabled={!emailInput.trim() || emailLinkBusy} type="submit">
            {emailLinkBusy ? "Signing in…" : "Continue"}
          </button>
        </form>
      </EmailLinkPrompt>
    );
  }

  if (emailLinkPhase === "conflict") {
    return (
      <EmailLinkPrompt
        title="Already saved elsewhere"
        body="This email already has a Bench Buddy team saved. Sign in to that account? What you've done on this device that hasn't been saved yet will be left behind."
      >
        <button style={styles.mdCautionSheetBtnPrimary} onClick={switchToConflictAccount} disabled={emailLinkBusy}>
          Sign in to that account
        </button>
        <button style={styles.mdCautionSheetBtnSecondary} onClick={() => setEmailLinkPhase("none")} disabled={emailLinkBusy}>
          Cancel
        </button>
      </EmailLinkPrompt>
    );
  }

  if (emailLinkPhase === "error") {
    return (
      <EmailLinkPrompt title="That link didn't work" body="It may have expired or already been used. Open Team & account and tap Save your team to request a new one.">
        <button style={styles.mdCautionSheetBtnPrimary} onClick={() => setEmailLinkPhase("none")}>
          Continue
        </button>
      </EmailLinkPrompt>
    );
  }

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

// A plain centred card for the two real-but-rare email-link states above —
// not part of any design-handoff spec (this whole flow only exists because
// a magic link can complete on page load, before the app has anywhere
// better to put it), so it deliberately borrows plain, generic styling
// rather than inventing pixel-perfect values nobody specified.
function EmailLinkPrompt({ title, body, children }) {
  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 14, padding: 28, background: tokens.color.creamPaper, fontFamily: tokens.font.body,
      }}
      data-testid="email-link-prompt"
    >
      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: tokens.font.display, fontWeight: 800, fontSize: 26, color: tokens.color.deepGreen }}>
          {title}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: tokens.color.groupLabel, lineHeight: 1.4 }}>{body}</div>
        {children}
      </div>
    </div>
  );
}
