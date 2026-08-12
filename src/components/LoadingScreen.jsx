import { colors } from "./styles.js";
import headerMascot from "../assets/header-mascot.jpg";

// Shared "something's loading" screen — used both by AuthGate (checking
// whether a session already exists) and SubRotationPlanner (loading the
// signed-in account's teams). Was previously just static "Loading…" text on
// a flat background in both places; a spinning ring around the mascot logo
// gives an actual sense of motion/progress instead of a screen that could
// just as easily be frozen.
//
// The spin keyframes are injected here (rather than relying on the
// app-wide <style>{fontStyle}</style> tag in SubRotationPlanner) because
// this renders BEFORE that tag ever mounts — both the auth-check screen and
// the sign-in screen exist entirely outside SubRotationPlanner's tree.
export default function LoadingScreen({ message = "Loading…" }) {
  return (
    <div style={styles.wrap}>
      <style>{spinKeyframes}</style>
      <div style={styles.spinnerWrap}>
        <div style={styles.ring} />
        <div style={styles.logoCrop}>
          <img src={headerMascot} alt="" style={styles.logoImg} />
        </div>
      </div>
      <div style={styles.text}>{message}</div>
    </div>
  );
}

const spinKeyframes = `
  @keyframes bb-spin { to { transform: rotate(360deg); } }
`;

const styles = {
  wrap: {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 16, background: colors.chalk, fontFamily: "system-ui, -apple-system, sans-serif",
  },
  spinnerWrap: { position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" },
  // Track drawn in a light neutral with just the top edge colored, so
  // rotating it reads as a single arc sweeping around rather than a whole
  // colored ring just spinning in place (which doesn't look like "loading"
  // so much as "rotating decoration").
  ring: {
    position: "absolute", inset: 0, borderRadius: "50%",
    border: "4px solid " + colors.border, borderTopColor: colors.grass,
    animation: "bb-spin 0.9s linear infinite",
  },
  logoCrop: {
    width: 44, height: 44, borderRadius: "50%", overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,255,255,0.7)",
  },
  logoImg: { width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  text: { color: colors.grass, fontWeight: 700, fontSize: 14 },
};
