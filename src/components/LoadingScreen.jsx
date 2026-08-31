import { colors } from "./styles.js";
import headerMascot from "../assets/header-mascot.svg";

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
          <div style={styles.logoSuper}>
            <img src={headerMascot} alt="" style={styles.logoImg} />
          </div>
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
  // 152/132 (spinner/logo) instead of the old 64/44 — sized so the logo
  // itself matches the sign-in screen's own crest (mdSignInCrest,
  // styles.js: 132px, "the starter page"), keeping the same ~10px ring
  // margin around it as before.
  spinnerWrap: { position: "relative", width: 152, height: 152, display: "flex", alignItems: "center", justifyContent: "center" },
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
    width: 132, height: 132, borderRadius: "50%", overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,255,255,0.7)",
  },
  // Real-use feedback: at 132px the SVG read soft/blurry — the browser
  // rasterizes an <img src="*.svg"> at its laid-out box size and only
  // *then* applies a CSS transform, so the old plain scale(1.7) on a
  // 132px box was stretching an already-132px-ish bitmap, not
  // re-rendering the vector at the final size (a raster JPG never showed
  // this because its native resolution was already well above 132px, so
  // stretching it further was imperceptible — a vector source has no such
  // safety margin). logoSuper renders the whole crop at 3x (396px) —
  // genuinely re-rasterizing the vector there, sharp — then scales the
  // *result* back down to fit logoCrop's real 132px box. Downscaling a
  // raster always looks clean; only upscaling exposed the softness. Pure
  // supersampling: logoImg's own relative crop math (objectPosition,
  // scale(1.7)) is untouched, so the framing is pixel-for-pixel the same,
  // just computed at higher resolution first.
  logoSuper: { width: 396, height: 396, transform: "scale(0.3333333)", transformOrigin: "0 0" },
  logoImg: { width: 396, height: 396, objectFit: "cover", objectPosition: "50% 46%", transform: "scale(1.7)" },
  text: { color: colors.grass, fontWeight: 700, fontSize: 14 },
};
