import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import { styles, tokens } from "./styles.js";
import { classifyClaimLink } from "../lib/matchHandover.js";
import { fetchHandoverForClaim, submitClaimEmail, confirmClaim } from "../lib/matchHandoverIo.js";
import LoadingScreen from "./LoadingScreen.jsx";
import ParentMatchSession from "./ParentMatchSession.jsx";
import headerMascot from "../assets/header-mascot.svg";

// README > 2b — Claim the link (parent). Reached via App.jsx's own
// ?team=&t= query-string routing (see its comment) — no app chrome at all,
// standalone page, same paper-texture ground as every other full-screen
// surface in the app. Copy is deliberately generic ("today's game" /
// "your coach"), not personalized with the team/coach name the mockup
// shows — that would need a further read-permission change on top of the
// one Step 4 already makes (see firestore.rules' own comment on this),
// for a cosmetic difference not worth a second trade-off.
//
// This page's own job ends the moment a claim succeeds — from there it
// hands off to ParentMatchSession.jsx, the SAME <MatchView> the coach's
// own screen renders (README rule 2). Level ("subs" vs "full") only ever
// changes that screen's own sub-line copy, never what the claim page here
// decides — see matchHandover.js's canControlClock for why.
export default function MatchClaimPage({ teamId, token, user }) {
  const [handover, setHandover] = useState(undefined); // undefined = still loading
  const [loadError, setLoadError] = useState(false);
  const [claimFailed, setClaimFailed] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchHandoverForClaim(teamId)
      .then((h) => !cancelled && setHandover(h))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const status = handover !== undefined ? classifyClaimLink(handover, token, user.uid) : null;

  // "ready-to-claim" (requireEmailClaim off) and "ready-to-confirm" (the
  // emailed deviceToken) both need no form at all — attempt the write the
  // moment classifyClaimLink says which one this is. Same blind-write
  // pattern as the email form's own Stage A below; firestore.rules is what
  // actually enforces the token, not this component.
  useEffect(() => {
    if (status !== "ready-to-claim" && status !== "ready-to-confirm") return undefined;
    let cancelled = false;
    const claim =
      status === "ready-to-claim"
        ? { email: null, viaToken: handover.claimToken, claimedAt: Date.now(), claimedByUid: user.uid, deviceBoundAt: Date.now(), revokedAt: null }
        : {
            email: handover.pendingClaim.email,
            viaToken: handover.pendingClaim.deviceToken,
            claimedAt: Date.now(),
            claimedByUid: user.uid,
            deviceBoundAt: Date.now(),
            revokedAt: null,
          };
    confirmClaim(teamId, claim)
      .then(() => !cancelled && setJustClaimed(true))
      .catch(() => !cancelled && setClaimFailed(true));
    return () => {
      cancelled = true;
    };
  }, [status, handover, teamId, user]);

  const submitEmail = async (e) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setSubmitError("");
    try {
      await submitClaimEmail(teamId, { email: email.trim(), viaToken: token });
      setSent(true);
    } catch {
      setSubmitError("Couldn't send that — check your connection and try again.");
    }
    setBusy(false);
  };

  if (handover === undefined) {
    return <LoadingScreen message="Loading…" />;
  }
  if (loadError) {
    return (
      <ClaimMessage title="Something went wrong" body="Couldn't load this link right now — check your connection and try again." />
    );
  }
  if (claimFailed) {
    return (
      <ClaimMessage
        title="That link didn't work"
        body="It may already have been used, or the coach turned Match Link off. Ask them for a fresh one."
      />
    );
  }
  // Step 5 — a genuinely active claim (just completed, or reopened on the
  // same device) hands off straight into the real match session. No
  // "already-yours" vs "just claimed" distinction needed here — both mean
  // the same thing: this viewer holds it right now.
  if (justClaimed || status === "already-yours") {
    return <ParentMatchSession teamId={teamId} level={handover.level} />;
  }
  if (status === "taken-back") {
    return (
      <ClaimMessage
        title="You've been taken off this one"
        body="The coach has taken the game back. If they want your help again, they'll send a new link."
      />
    );
  }
  if (status === "already-claimed") {
    return <ClaimMessage title="Someone's already on this" body="This link has already been claimed by someone else." />;
  }
  if (status === "dead" || status === "not-found") {
    return (
      <ClaimMessage
        title="This link isn't active"
        body="It may have expired, been turned off, or already been used. Ask the coach for a fresh one."
      />
    );
  }
  if (status === "ready-to-claim" || status === "ready-to-confirm") {
    return <LoadingScreen message="Getting you in…" />;
  }

  // status === "needs-email" — the real 2b form, plus the "sent" sheet.
  return (
    <div style={styles.mdClaimPage}>
      <div style={styles.mdClaimInner}>
        <div style={styles.mdClaimCrest}>
          <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
        </div>
        <div style={styles.mdClaimTitle}>Take the subs for today's game</div>
        <div style={styles.mdClaimBody}>
          Your coach has asked you to help out today. Enter your email and we'll send you the link — no password and
          no app to install.
        </div>
        <form style={styles.mdClaimForm} onSubmit={submitEmail}>
          <input
            type="email"
            autoFocus
            required
            style={styles.mdSaveTeamEmailField}
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button style={styles.mdClaimSubmitBtn} type="submit" disabled={!email.trim() || busy}>
            {busy ? "Sending…" : "Email me the link"}
          </button>
        </form>
        {submitError && <div style={styles.mdClaimFootnote}>{submitError}</div>}
        <div style={styles.mdClaimFootnote}>Used once, to send this link. Nothing else.</div>
      </div>

      {sent && (
        <>
          <div style={styles.mdCautionSheetScrim} />
          <div style={styles.mdClaimSentSheet}>
            <div style={styles.mdClaimSentGrabber} />
            <div style={styles.mdClaimSentHeaderRow}>
              <span style={styles.mdClaimSentIconDisc}>
                <Mail size={22} color={tokens.color.deepGreen} />
              </span>
              <div style={styles.mdClaimSentTitle}>Check your email</div>
            </div>
            <div style={styles.mdClaimSentBody}>
              We sent a link to <strong>{email.trim()}</strong>. It opens the game and stays good until full time.
            </div>
            <button style={styles.mdClaimSentSecondaryBtn} onClick={submitEmail} disabled={busy}>
              Send it again
            </button>
            <div style={styles.mdClaimSentTertiary}>
              Wrong address?{" "}
              <button style={styles.mdClaimSentTertiaryLink} onClick={() => setSent(false)}>
                Start over
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Shared shell for every terminal (non-form) state above — loading errors,
// dead/claimed links, and the post-claim placeholder all just need a crest,
// a title, and a body line.
function ClaimMessage({ title, body }) {
  return (
    <div style={styles.mdClaimPage}>
      <div style={styles.mdClaimInner}>
        <div style={styles.mdClaimCrest}>
          <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
        </div>
        <div style={styles.mdClaimTitle}>{title}</div>
        <div style={styles.mdClaimBody}>{body}</div>
      </div>
    </div>
  );
}
