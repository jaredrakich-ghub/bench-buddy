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
    runAction(() =>
      createHandover(teamId, coachUid, { level: "subs", stopsAtFullTime: true, requireEmailClaim: true, kickoffAt: Date.now() })
    );
  const turnOff = () => runAction(() => revokeHandover(teamId));
  const setLevel = (level) => runAction(() => updateHandoverSettings(teamId, { level }));
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
    const text = encodeURIComponent(`Here's the link to run ${handover.level === "full" ? "today's game" : "the subs"}: ${fullClaimUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
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
          {/* README/INSTRUCTIONS.md: the level control goes directly above
              the link card. */}
          <div style={styles.mdMatchLinkLevelRow}>
            <button
              style={{ ...styles.mdMatchLinkLevelBtn, ...(handover.level === "subs" ? styles.mdMatchLinkLevelBtnActive : {}) }}
              onClick={() => setLevel("subs")}
            >
              Subs
            </button>
            <button
              style={{ ...styles.mdMatchLinkLevelBtn, ...(handover.level === "full" ? styles.mdMatchLinkLevelBtnActive : {}) }}
              onClick={() => setLevel("full")}
            >
              Full game
            </button>
          </div>

          <div style={styles.mdMatchLinkExplainerCard}>
            <div style={styles.mdMatchLinkExplainerTitle}>
              {handover.level === "full" ? "Hand over the whole game" : "Hand the subs to someone"}
            </div>
            <div style={styles.mdMatchLinkExplainerBody}>
              {handover.level === "full"
                ? "Send this to the parent running today's game. They get your screen and your plan, and they control the clock and the subs while you coach. Only the person you send it to can open it."
                : "Send this to the parent taking the subs today. They get your screen and your plan, and they make the changes while you coach. Only the person you send it to can open it."}
            </div>
          </div>

          <div style={styles.mdMatchLinkCard}>
            <span style={styles.mdMatchLinkCardLabel}>Link for today</span>
            <div style={styles.mdMatchLinkUrlWell}>{claimUrl}</div>

            <div style={styles.mdMatchLinkToggleRow}>
              <span style={styles.mdMatchLinkToggleLabel}>Stops working at full time</span>
              <button
                style={{ ...styles.mdMatchLinkToggleTrack, ...(handover.stopsAtFullTime ? styles.mdMatchLinkToggleTrackOn : {}) }}
                onClick={toggleStopsAtFullTime}
                role="switch"
                aria-checked={handover.stopsAtFullTime}
                title="Stops working at full time"
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

          <div style={styles.mdMatchLinkCard}>
            <span style={styles.mdMatchLinkCardLabel}>Who has the game{holderActive ? " · 1" : ""}</span>
            {holderActive ? (
              <div style={styles.mdMatchLinkHolderRow}>
                <div style={styles.mdMatchLinkHolderInfo}>
                  <span style={styles.mdMatchLinkHolderEmail}>{handover.claim.email || "No email given"}</span>
                  <span style={styles.mdMatchLinkHolderStatus}>
                    on {handover.level === "full" ? "the whole game" : "subs"} today
                  </span>
                </div>
                <button style={styles.mdTeamAcctIconBtn} onClick={revoke} title="Remove their access">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div style={styles.mdMatchLinkEmptyHolder}>Nobody's picked up the link yet.</div>
            )}
          </div>

          <button style={styles.mdMatchLinkShareBtn} onClick={shareToWhatsApp}>
            <Share2 size={18} /> Share to WhatsApp
          </button>
          <button style={styles.mdMatchLinkCopyBtn} onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>

          <button style={styles.mdMatchLinkOffBtn} onClick={turnOff}>
            Turn off Match Link
          </button>
        </>
      )}
    </section>
  );
}
