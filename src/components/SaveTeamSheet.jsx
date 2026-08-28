import { useState } from "react";
import {
  linkGoogleAccount, signInWithExistingCredential, sendLoginEmailLink,
} from "../lib/auth.js";
import { KitShirt } from "./matchDayIcons.jsx";
import { GoogleIcon } from "./SignIn.jsx";
import { styles, tokens } from "./styles.js";

// The design's own 380x844 reference frame — every `left` value in block
// 16 (INSTRUCTIONS.md #16) is a px offset against this width. Converted to
// a % of the band's own actual width at render time (formation.js's own
// pitch-layout convention, reused here) so this scales to a real phone's
// actual width instead of clipping or wasting space at anything other than
// exactly 380px.
const REFERENCE_WIDTH = 380;

// The three squad-size tiers, adapted from the spec — a single centred row
// for up to 6 on the field, two rows (back/front) above that. Only 5/7/9
// are literal reference counts (the three actual mockups); buildRow
// (below) generalises to any other count within the same bracket by
// keeping that row's own spacing and placing shirts evenly around the
// band's TRUE horizontal centre, with the tops interpolated between the
// reference row's own centre/edge values.
//
// Real-device feedback caught something the spec's own numbers get wrong:
// its "centre" for each row (157 for the arch, 149/159 for the two-row-7
// back/front, 160 for two-row-9) isn't actually the frame's midpoint
// (190, half of the 380 reference width) — every one of them sits well
// left of it, and the reference screens visibly do too once you look for
// it (the leftmost shirt runs right up against the band's own left edge).
// Rather than reproduce that, every row here is centred explicitly at the
// band's own true midpoint; only each row's own inter-shirt SPACING is
// still taken from the spec, which is what actually varies meaningfully
// by shirt/column size.
const TIERS = {
  arch: {
    band: 282, shirtW: 50, shirtH: 46, pillBottom: 70,
    rows: [{ count: 5, spacing: 64, topCenter: 68, topEdge: 104 }],
  },
  twoRow7: {
    band: 320, shirtW: 50, shirtH: 46, pillBottom: 40,
    rows: [
      { count: 4, spacing: 86, topCenter: 82, topEdge: 100 }, // back
      { count: 3, spacing: 96, topCenter: 166, topEdge: 176 }, // front
    ],
  },
  twoRow9: {
    band: 308, shirtW: 44, shirtH: 40, pillBottom: 40,
    rows: [
      { count: 5, spacing: 71, topCenter: 80, topEdge: 100 }, // back
      { count: 4, spacing: 71, topCenter: 160, topEdge: 170 }, // front
    ],
  },
};

function tierFor(count) {
  if (count <= 6) return TIERS.arch;
  if (count <= 8) return TIERS.twoRow7;
  return TIERS.twoRow9;
}

// Evenly places `count` shirts around the band's own true horizontal
// centre, `row.spacing` apart, with a smooth (not linear) arc between the
// reference row's own centre and edge top values — reproduces the spec's
// own numbers (bar the left-bias fix above) when count matches the
// reference row exactly (5, 4+3, 5+4), degrades gracefully otherwise.
function buildRow(row, count) {
  const maxOffset = (row.count - 1) / 2; // the reference row's own arc depth
  const positions = [];
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2;
    const left = REFERENCE_WIDTH / 2 + offset * row.spacing;
    const t = maxOffset > 0 ? Math.min(Math.abs(offset) / maxOffset, 1) : 0;
    const top = row.topCenter + (row.topEdge - row.topCenter) * t * t;
    positions.push({ left, top });
  }
  return positions;
}

function computeLayout(onFieldPlayers) {
  const tier = tierFor(onFieldPlayers.length);
  const positions = [];
  let remaining = onFieldPlayers;
  for (const row of tier.rows) {
    // Two-row tiers split roughly evenly, back row taking the extra one on
    // an odd count — 7 -> 4+3, 9 -> 5+4, same ratio the spec's own two
    // worked examples use.
    const isLastRow = row === tier.rows[tier.rows.length - 1];
    const take = isLastRow ? remaining.length : Math.ceil((onFieldPlayers.length * row.count) / tier.rows.reduce((s, r) => s + r.count, 0));
    const slice = remaining.slice(0, take);
    remaining = remaining.slice(take);
    buildRow(row, slice.length).forEach((pos, i) => positions.push({ ...pos, player: slice[i] }));
  }
  return { tier, positions };
}

function benchPillText(benchIds, nameOf) {
  if (benchIds.length === 0) return null;
  if (benchIds.length === 1) return `${nameOf(benchIds[0])} on the bench`;
  if (benchIds.length === 2) return `${nameOf(benchIds[0])} and ${nameOf(benchIds[1])} on the bench`;
  return `${nameOf(benchIds[0])}, ${nameOf(benchIds[1])} and ${benchIds.length - 2} others on the bench`;
}

// Block 16 — Save your team. Not the first screen a user sees (that's
// progressive auth's own anonymous bootstrap, AuthGate.jsx) — reached only
// by tapping Save your team in Team & account, and only ever about
// attaching a real identity to the session that's already working, never a
// gate. Full-screen, dismissible (the ✕), never blocking the rest of the
// app.
//
// Three phases beyond the resting "pick a provider" one:
//  - email: block 6/A9-Signin's own field+button, reused verbatim, as an
//    in-place state swap within this same shell rather than a separate
//    gate screen — block 16 doesn't say what "Continue with Email" opens
//    into, and this app's older magic-link screen already has the exact
//    values for exactly that content.
//  - conflict: this identity already belongs to a *different* existing
//    Bench Buddy account (auth/credential-already-in-use) — not in the
//    spec at all (a real edge case discovered building this), same
//    explicit-choice recovery Google and Email both share.
//  - error: any other failure.
export default function SaveTeamSheet({ onFieldPlayers, benchIds, nameOf, numberOf, onClose }) {
  const [phase, setPhase] = useState("idle"); // idle | linking | conflict | switching | error | email | sendingEmail | emailSent | emailError
  const [conflictCredential, setConflictCredential] = useState(null);
  const [email, setEmail] = useState("");

  const handleGoogle = async () => {
    setPhase("linking");
    try {
      const result = await linkGoogleAccount();
      if (result.ok) {
        onClose();
        return;
      }
      setConflictCredential(result.conflictCredential);
      setPhase("conflict");
    } catch (err) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setPhase("idle");
      } else {
        setPhase("error");
      }
    }
  };

  const handleSwitchToExisting = async () => {
    setPhase("switching");
    try {
      await signInWithExistingCredential(conflictCredential);
      onClose();
    } catch {
      setPhase("error");
    }
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

  const { tier, positions } = computeLayout(onFieldPlayers);
  const pillText = benchPillText(benchIds, nameOf);

  return (
    <div style={styles.mdSaveTeamScreen} data-testid="save-team-screen">
      <div style={{ ...styles.mdSaveTeamBand, height: tier.band }}>
        <div style={styles.mdSaveTeamStripes} />
        <div style={styles.mdSaveTeamCircle} />
        <button style={styles.mdSaveTeamClose} onClick={onClose} aria-label="Close">
          ✕
        </button>
        {positions.map(({ left, top, player }) => (
          <div
            key={player.id}
            style={{
              ...styles.mdSaveTeamMark,
              left: `${(left / REFERENCE_WIDTH) * 100}%`,
              top, width: tier.shirtW, transform: "translateX(-50%)",
            }}
          >
            <div style={{ position: "relative", width: tier.shirtW, height: tier.shirtH }}>
              <KitShirt width={tier.shirtW} height={tier.shirtH} isGk={player.isGk} />
              <span
                style={{
                  ...styles.mdShirtNumber,
                  top: Math.round(tier.shirtH * (24 / 58)),
                  fontSize: Math.round(tier.shirtW * (24 / 62)),
                }}
              >
                {numberOf(player.id)}
              </span>
            </div>
            <span style={styles.mdSaveTeamMarkName}>{nameOf(player.id)}</span>
          </div>
        ))}
        {pillText && (
          <div style={{ ...styles.mdSaveTeamBenchPill, bottom: tier.pillBottom }}>
            <span style={styles.mdSaveTeamBenchDisc}>+</span>
            {pillText}
          </div>
        )}
      </div>

      <div style={styles.mdSaveTeamSheet}>
        {phase === "conflict" || phase === "switching" ? (
          <>
            <div style={styles.mdSaveTeamHeading}>Already saved elsewhere</div>
            <div style={styles.mdSaveTeamBody}>
              This account already has a Bench Buddy team saved. Sign in to that account? What you've done on this
              device that hasn't been saved yet will be left behind.
            </div>
            <div style={styles.mdSaveTeamButtonList}>
              <button style={styles.mdCautionSheetBtnPrimary} onClick={handleSwitchToExisting} disabled={phase === "switching"}>
                Sign in to that account
              </button>
              <button style={styles.mdCautionSheetBtnSecondary} onClick={() => setPhase("idle")} disabled={phase === "switching"}>
                Cancel
              </button>
            </div>
          </>
        ) : phase === "email" || phase === "sendingEmail" || phase === "emailError" ? (
          <>
            <div style={styles.mdSaveTeamHeading}>Save your team</div>
            <div style={styles.mdSaveTeamBody}>
              Create a free account to save your players, rotations and match history. Everything you've already
              entered will be kept.
            </div>
            <form onSubmit={handleSendEmailLink} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
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
            </form>
            <div style={styles.mdSaveTeamReassurance}>No password. We email you a link that signs you in and keeps you in.</div>
            {phase === "emailError" && (
              <div style={{ ...styles.mdSignInError, marginTop: 12 }}>Couldn't send that link — check your connection and try again.</div>
            )}
          </>
        ) : phase === "emailSent" ? (
          <>
            <div style={styles.mdSaveTeamHeading}>Check your email</div>
            <div style={styles.mdSaveTeamBody}>
              We sent a link to {email}. Open it on this device to finish saving your team.
            </div>
          </>
        ) : (
          <>
            <div style={styles.mdSaveTeamHeading}>Save your team</div>
            <div style={styles.mdSaveTeamBody}>
              Create a free account to save your players, rotations and match history. Everything you've already
              entered will be kept.
            </div>
            <div style={styles.mdSaveTeamButtonList}>
              <button
                style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamGoogleBtn }}
                onClick={handleGoogle}
                disabled={phase === "linking"}
              >
                <span style={styles.mdSaveTeamProviderChip}>
                  <GoogleIcon />
                </span>
                <span style={styles.mdSaveTeamProviderLabel}>{phase === "linking" ? "Signing in…" : "Continue with Google"}</span>
              </button>
              <button style={{ ...styles.mdSaveTeamProviderBtn, ...styles.mdSaveTeamEmailBtn }} onClick={() => setPhase("email")}>
                <span style={styles.mdSaveTeamProviderChip}>
                  <EnvelopeIcon />
                </span>
                <span style={styles.mdSaveTeamProviderLabel}>Continue with Email</span>
              </button>
            </div>
            {phase === "error" && (
              <div style={{ ...styles.mdSignInError, marginTop: 12 }}>Couldn't sign in — check your connection and try again.</div>
            )}
            {/* Real-use feedback: tried without the card background (this
                screen's tightest spot for room) — reads less compressed
                as a plain row, so it stays this way rather than the
                original spec's own filled panel. */}
            <div style={styles.mdSaveTeamTickRow}>
              <span style={styles.mdSaveTeamTickDisc}>✓</span>
              <span style={styles.mdSaveTeamTickText}>Your current team will be linked to your account automatically.</span>
            </div>
          </>
        )}

        {/* "Bench Buddy Sports" dropped — real-use feedback: this screen
            doesn't have the room to spare on a footer wordmark the way a
            taller reference frame did. The home-indicator bar stays; it's
            a thin decorative accent, not a space cost. */}
        <div style={styles.mdSaveTeamFooter}>
          <span style={styles.mdSaveTeamHomeIndicator} />
        </div>
      </div>
    </div>
  );
}

// The envelope mark for "Continue with Email" — ours to draw (unlike
// Google/Apple's own published marks): 18px, stroke #3E5148 at 2.1px,
// round caps and joins, per the spec.
function EnvelopeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={tokens.color.groupLabel} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.5 6.5 12 13 20.5 6.5" />
    </svg>
  );
}
