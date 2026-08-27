import { useState } from "react";
import { Save } from "lucide-react";
import { linkGoogleAccount, signInWithExistingCredential } from "../lib/auth.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { GoogleIcon } from "./SignIn.jsx";
import { styles, tokens } from "./styles.js";

// Progressive auth's upgrade step — reached from TeamAccountScreen's own
// "Save your team" row, shown only for an anonymous session. Built from the
// same shared caution-sheet shell MatchView's reset-confirm and
// SquadSettingsForm's rebuild-confirm sheets already use (styles.js has the
// full story on why it's shared) — this isn't "here's what's about to
// happen" caution in the same sense those two are, but it's the same shape
// of thing (a sheet interrupting the current screen to ask something
// before proceeding), and reusing the shell means no new visual language.
//
// Deliberately no wordmark/tagline/version footer the way the full-page
// SignIn screen has — this is a sheet over a screen the coach is already
// using, not a first impression, so it only needs the one thing they
// actually came here for: a way to attach a real account.
//
// Three states, tracked locally rather than lifted — nothing outside this
// sheet needs to know about them, and closing it (any path) always leaves
// it fully reset for next time since it unmounts rather than hiding:
//  - idle: the Google button, ready to tap.
//  - conflict: linkGoogleAccount came back with a *different* existing
//    account already on that credential — offer the explicit choice
//    rather than silently doing either thing.
//  - error: any other failure — same "check your connection" copy as
//    SignIn.jsx's own, for the same failure.
export default function SaveTeamSheet({ onClose }) {
  const [phase, setPhase] = useState("idle"); // "idle" | "linking" | "conflict" | "switching" | "error"
  const [conflictCredential, setConflictCredential] = useState(null);
  const drag = useSheetDrag(onClose);

  const handleLink = async () => {
    setPhase("linking");
    try {
      const result = await linkGoogleAccount();
      if (result.ok) {
        // onAuthChange (AuthGate) picks up the now-linked user on its own;
        // nothing else to do here on success.
        onClose();
        return;
      }
      setConflictCredential(result.conflictCredential);
      setPhase("conflict");
    } catch (err) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setPhase("idle"); // cancelled, not a real error worth showing
      } else {
        setPhase("error");
      }
    }
  };

  const handleSwitchToExisting = async () => {
    setPhase("switching");
    try {
      await signInWithExistingCredential(conflictCredential);
      // Same as the success path above — onAuthChange takes it from here.
      onClose();
    } catch {
      setPhase("error");
    }
  };

  return (
    <>
      <div style={styles.mdCautionSheetScrim} onClick={onClose} />
      <div style={{ ...styles.mdCautionSheet, ...drag.dragStyle }} data-testid="save-team-sheet">
        <div {...drag.dragHandleProps}>
          <div style={styles.mdSheetGrabHandle} />
          <div style={styles.mdCautionSheetHeaderRow}>
            <span style={styles.mdCautionSheetIconBadge}>
              <Save size={19} color={tokens.color.deepGreen} />
            </span>
            <div style={styles.mdCautionSheetTitle}>
              {phase === "conflict" ? "Already saved elsewhere" : "Save your team"}
            </div>
          </div>
        </div>

        {phase === "conflict" ? (
          <>
            <div style={styles.mdCautionSheetBody}>
              This Google account already has a Bench Buddy team saved. Sign in to that account? What you've done on
              this device that hasn't been saved yet will be left behind.
            </div>
            <div style={styles.mdCautionSheetBtnRow}>
              <button style={styles.mdCautionSheetBtnPrimary} onClick={handleSwitchToExisting} disabled={phase === "switching"}>
                Sign in to that account
              </button>
              <button style={styles.mdCautionSheetBtnSecondary} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={styles.mdCautionSheetBody}>
              Your team is already saved on this device. Sign in with Google to keep it safe and pick up where you
              left off on another device too.
            </div>
            <button style={styles.mdSaveTeamGoogleBtn} onClick={handleLink} disabled={phase === "linking"}>
              <GoogleIcon />
              {phase === "linking" ? "Signing in…" : "Sign in with Google"}
            </button>
            {phase === "error" && (
              <div style={styles.mdSignInError}>Couldn't sign in — check your connection and try again.</div>
            )}
          </>
        )}
      </div>
    </>
  );
}
