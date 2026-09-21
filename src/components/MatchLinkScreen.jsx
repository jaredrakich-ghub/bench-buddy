import { useState, useEffect } from "react";
import { Share2, Trash2 } from "lucide-react";
import { styles } from "./styles.js";
import { isHandoverActive } from "../lib/matchHandover.js";
import {
  createHandover, updateHandoverSettings, revokeHandover, revokeHolder, subscribeHandover,
} from "../lib/matchHandoverIo.js";

// README > 2a-Match-link (coach). Full-screen takeover, same
// mdFullScreenTakeoverOuter/Inner wrapper as every other non-match screen,
// reached from MatchView's cog menu "Match Link" row. Not a Pro feature
// (superseded mid-build — see the plan discussion) and this file covers
// ONLY the four in-scope README frames' coach half (2a) — no claim UI (2b,
// Step 4), no parent match session (2c/2d, Steps 5-6), no live sync beyond
// the "Who has the game" row below (Step 7).
//
// Real-use feedback, a round of simplification after the original build:
// - Dropped the Subs/Full game level picker — matchHandover.js's own
//   comment already said level was DISPLAY ONLY (never changed what a
//   holder could actually do), so it was a choice that wasn't really a
//   choice. Every handover is level: "full" now; that field stays in the
//   schema (firestore.rules' isValidHandover still requires it) purely so
//   an old handover created before this change keeps reading correctly.
// - Dropped the raw link display — Share/Copy already cover getting the
//   link out; showing the literal URL on screen was pure clutter (and put
//   the secret token on screen for no reason).
// - The toggles that were always-visible now live inside a
//   collapsed-by-default "Link settings" section — this isn't something
//   most coaches need to open every time.
//
// "Ask for an email first" was briefly dropped entirely (its "Take the
// subs" email form, MatchClaimPage.jsx, had no actual email-sending
// behind it — Pile 2, deferred at the time) — now restored, backed by a
// real Cloud Function (functions/index.js, sendMatchLinkClaimEmail,
// triggered off the same pendingClaim write submitClaimEmail already
// made) that actually delivers it via Resend.
//
// Step 4 — a query string on the app's own root, not a path
// (app.benchbuddysports.com/m/...). GitHub Pages serves index.html for the
// root regardless of query string, so this needs no server-side routing;
// a path would need a public/404.html SPA-redirect shim to avoid a real
// 404 in production. See App.jsx for the matching read side.
//
// teamId rides alongside the token because there's no backend yet (Pile 2)
// to resolve "token -> which team" server-side — Firestore needs the full
// teams/{teamId}/matchHandover/current path to read or write at all.
// teamId isn't the secret here (claimToken is); it's just routing.
const CLAIM_URL_BASE = "app.benchbuddysports.com/?";

export default function MatchLinkScreen({ teamId, coachUid, onClose }) {
  // undefined = the first snapshot hasn't arrived yet; null = no handover
  // has ever been created for this match; a real handover object otherwise.
  const [handover, setHandover] = useState(undefined);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Collapsed by default — see this file's own top comment.
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  // Launch-audit finding: turning Match Link off (and later back on) mints
  // a fresh token — createHandover always does — silently killing whatever
  // link was already sent, with nothing telling the coach it happened. We
  // can't actually know whether THIS link was shared (that's an external
  // WhatsApp/copy action, not tracked across sessions), so the safe default
  // is to always warn before turning it off rather than guess.
  const [confirmingOff, setConfirmingOff] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeHandover(teamId, setHandover);
    return unsubscribe;
  }, [teamId]);

  const isOn = handover != null && !handover.revokedAt;
  // isHandoverActive (matchHandover.js) is the single source of truth for
  // "does someone currently, genuinely have the game" — reused directly
  // rather than re-deriving its four checks here.
  const holderActive = isHandoverActive(handover);

  const runAction = async (fn) => {
    setError("");
    try {
      await fn();
    } catch {
      setError("Changes aren't saving right now — check your connection and try again.");
    }
  };

  const turnOn = () =>
    runAction(() => createHandover(teamId, coachUid, { level: "full", stopsAtFullTime: true, requireEmailClaim: false, kickoffAt: Date.now() }));
  const turnOff = () => {
    setConfirmingOff(false);
    runAction(() => revokeHandover(teamId));
  };
  const toggleStopsAtFullTime = () =>
    runAction(() => updateHandoverSettings(teamId, { stopsAtFullTime: !handover.stopsAtFullTime }));
  const toggleRequireEmailClaim = () =>
    runAction(() => updateHandoverSettings(teamId, { requireEmailClaim: !handover.requireEmailClaim }));
  const revoke = () => runAction(() => revokeHolder(teamId, handover.claim));

  const claimUrl = handover
    ? `${CLAIM_URL_BASE}team=${encodeURIComponent(teamId)}&t=${encodeURIComponent(handover.claimToken)}`
    : "";
  const fullClaimUrl = `https://${claimUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullClaimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link — copy it from the box above instead.");
    }
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`Here's the link to run today's game: ${fullClaimUrl}`);
    // Real-use feedback: window.open(..., "_blank") — opening a NEW window
    // to hand off to WhatsApp — left a stray blank tab (just a close "×")
    // behind in the installed PWA once WhatsApp itself opened; coming back
    // to Bench Buddy landed on that blank tab, not the app, reading as "I
    // got kicked out." Navigating the CURRENT window instead means iOS's
    // own link handoff to the WhatsApp app happens in place — there's no
    // second window left behind to come back to. Same fix applied to
    // AvailabilityScreen.jsx's own identical call, so both share-to-
    // WhatsApp buttons behave the same way.
    window.location.href = `https://wa.me/?text=${text}`;
  };

  return (
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Match Link</div>
      </div>

      {error && <div style={styles.modalWarning}>{error}</div>}

      {handover === undefined ? null : !isOn ? (
        <div style={styles.mdMatchLinkExplainerCard}>
          <div style={styles.mdMatchLinkExplainerTitle}>Hand the game to someone else</div>
          <div style={styles.mdMatchLinkExplainerBody}>
            Send a link to the parent taking the subs (or the whole game) today. They get your plan and make the
            changes while you coach — no account needed, and only the person you send it to can open it.
          </div>
          <button style={{ ...styles.mdMatchLinkShareBtn, marginTop: 12 }} onClick={turnOn}>
            Turn on Match Link
          </button>
        </div>
      ) : (
        <>
          <div style={styles.mdMatchLinkExplainerCard}>
            <div style={styles.mdMatchLinkExplainerTitle}>Hand over the game</div>
            <div style={styles.mdMatchLinkExplainerBody}>
              Send this to the parent running today's game. They get your screen and your plan, and they control the
              clock and the subs while you coach. Only the person you send it to can open it.
            </div>
          </div>

          <div style={styles.mdMatchLinkCard}>
            <button style={styles.mdMatchLinkSettingsToggle} onClick={() => setSettingsExpanded((v) => !v)}>
              <span style={{ ...styles.mdMatchLinkCardLabel, marginBottom: 0 }}>Link settings</span>
              <span
                style={{ ...styles.mdMatchLinkSettingsChevron, transform: settingsExpanded ? "rotate(90deg)" : "none" }}
              >
                ›
              </span>
            </button>
            {settingsExpanded && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={styles.mdMatchLinkToggleRow}>
                  <span style={styles.mdMatchLinkToggleLabel}>Stop working 24 hrs after full time</span>
                  <button
                    style={{ ...styles.mdMatchLinkToggleTrack, ...(handover.stopsAtFullTime ? styles.mdMatchLinkToggleTrackOn : {}) }}
                    onClick={toggleStopsAtFullTime}
                    role="switch"
                    aria-checked={handover.stopsAtFullTime}
                    title="Stop working 24 hrs after full time"
                  >
                    <span style={styles.mdMatchLinkToggleKnob} />
                  </button>
                </div>
                <div style={styles.mdMatchLinkToggleRow}>
                  <span style={styles.mdMatchLinkToggleLabel}>Ask for an email first</span>
                  <button
                    style={{ ...styles.mdMatchLinkToggleTrack, ...(handover.requireEmailClaim ? styles.mdMatchLinkToggleTrackOn : {}) }}
                    onClick={toggleRequireEmailClaim}
                    role="switch"
                    aria-checked={handover.requireEmailClaim}
                    title="Ask for an email first"
                  >
                    <span style={styles.mdMatchLinkToggleKnob} />
                  </button>
                </div>
                {handover.requireEmailClaim && (
                  <div style={styles.mdMatchLinkFootnote}>
                    They enter their email and get their own link, so you know exactly who has the game. A forwarded
                    link is useless.
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={styles.mdMatchLinkCard}>
            <span style={styles.mdMatchLinkCardLabel}>Who has the game{holderActive ? " · 1" : ""}</span>
            {holderActive ? (
              <div style={styles.mdMatchLinkHolderRow}>
                <div style={styles.mdMatchLinkHolderInfo}>
                  <span style={styles.mdMatchLinkHolderEmail}>{handover.claim.email || "A parent"}</span>
                  <span style={styles.mdMatchLinkHolderStatus}>on the game today</span>
                </div>
                <button style={styles.mdTeamAcctIconBtn} onClick={revoke} title="Remove their access">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div style={styles.mdMatchLinkEmptyHolder}>Nobody's picked up the link yet.</div>
            )}
          </div>

          <button style={styles.mdAvailPrimaryBtn} onClick={shareToWhatsApp}>
            <Share2 size={18} /> Share to WhatsApp
          </button>
          <button style={styles.mdAvailSecondaryBtn} onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>

          {confirmingOff ? (
            <div style={styles.mdTeamAcctConfirmCard}>
              <span style={styles.mdTeamAcctConfirmText}>
                Turn off Match Link? If you've already sent this link to someone, it'll stop working — you'll need
                to send a new one if you turn it back on.
              </span>
              <div style={styles.mdTeamAcctConfirmBtnRow}>
                <button style={styles.mdTeamAcctBtnCancel} onClick={() => setConfirmingOff(false)}>
                  Cancel
                </button>
                <button style={styles.mdTeamAcctBtnDanger} onClick={turnOff}>
                  Turn off
                </button>
              </div>
            </div>
          ) : (
            <button style={styles.mdMatchLinkOffBtn} onClick={() => setConfirmingOff(true)}>
              Turn off Match Link
            </button>
          )}
        </>
      )}
    </section>
  );
}
