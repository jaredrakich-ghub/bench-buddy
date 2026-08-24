import { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import { getFairnessState } from "../lib/fairness.js";
import FairnessMark from "./FairnessMark.jsx";
import { tokens } from "./styles.js";

const STEPS = [
  { icon: "⚽", label: "Checking playing time" },
  { icon: "⚖️", label: "Balancing rotations" },
  { icon: "✨", label: "Finding the fairest setup" },
];

// Steps advance roughly 530ms apart; the card flips to the success state
// at ~1800ms total — both purely a perceived-effort pause (the actual
// build finished the instant this mounted), not tied to real work.
const STEP_INTERVAL_MS = 530;
const SUCCESS_AT_MS = 1800;

const CONFETTI_COLORS = ["#F5B93B", "#2E7D53", "#FBE3A6", "#CBE8D6", "#123F3D"]; // no red — red is injury, everywhere else in this app

// Not shared elsewhere yet, so kept local rather than promoted to its own
// lib file — the only other place motion preference could matter (the
// step/card transitions) reads this same hook, so there's one source of
// truth for "is this device asking for less motion" inside this file.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// New self-contained overlay shown the instant "Build my rotation" is
// pressed — owns its own timers (cleaned up on unmount, so navigating
// away mid-sequence can't fire a state update on a gone component) and
// its own focus/keyboard trap. Two states in one card, never unmounted
// between them (title/border swap in place): "building" (three steps
// revealing in sequence) then "success" (the fairness result + confetti).
export default function RotationProgressOverlay({ averageMinutes, maxDifference, intervalLen, onContinue }) {
  const [phase, setPhase] = useState("building"); // "building" | "success"
  const [activeStep, setActiveStep] = useState(0); // 0,1,2 — which step is the current "in progress" one
  const [mounted, setMounted] = useState(false); // flips true one frame after mount, so the enter transition actually has a "from" state to animate away from
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const cardRef = useRef(null);
  const continueBtnRef = useRef(null);

  // Reveal the entrance transition on the next frame, not this render —
  // setting the "shown" styles in the very same commit that mounts the
  // component paints straight into the end state with nothing to
  // transition from.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // The step/success sequence. All timers fire regardless of reduced-
  // motion — only the CSS transitions are dropped for that preference,
  // never the state changes themselves (a reduced-motion coach still
  // needs the same steps and the same ~1800ms pacing, just without the
  // animated easing getting them there).
  useEffect(() => {
    const timers = [
      setTimeout(() => setActiveStep(1), STEP_INTERVAL_MS),
      setTimeout(() => setActiveStep(2), STEP_INTERVAL_MS * 2),
      setTimeout(() => setPhase("success"), SUCCESS_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Move focus into the card once it's actually mounted — calling
  // .focus() in the same commit as the state change that renders this
  // component is too early (the node isn't focusable/painted yet in that
  // same pass) and silently does nothing, same reasoning as the `mounted`
  // reveal above, so this piggybacks on the same rAF tick.
  useEffect(() => {
    const raf = requestAnimationFrame(() => cardRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Once success appears, hand focus to the one real action in the card.
  useEffect(() => {
    if (phase !== "success") return;
    const raf = requestAnimationFrame(() => continueBtnRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Keeps Tab from ever leaving the card while it's open. During
  // "building" there's nothing focusable inside at all (no buttons yet)
  // — Tab just gets bounced back to the card itself. During "success"
  // there's exactly one focusable control, so this simply keeps handing
  // focus back to it rather than letting Tab escape to whatever's
  // (aria-hidden) behind the scrim.
  const handleKeyDown = useCallback((e) => {
    if (e.key !== "Tab") return;
    const focusables = cardRef.current?.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusables || focusables.length === 0) {
      e.preventDefault();
      cardRef.current?.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // 16 pieces, randomized once per success entrance (not on every
  // re-render) — recomputes only if the motion preference itself
  // changes. Skipped entirely for reduced motion, per the spec.
  const confettiPieces = useMemo(() => {
    if (reducedMotion) return [];
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      isCircle: i % 2 === 0,
      left: Math.round(5 + Math.random() * 90),
      drift: Math.round(Math.random() * 54 - 27),
      spin: Math.round(300 + Math.random() * 360),
      duration: (1.25 + Math.random() * 0.54).toFixed(2),
      delay: (Math.random() * 0.39).toFixed(2),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
  }, [reducedMotion]);

  const transition = (css) => (reducedMotion ? "none" : css);
  const fairness = getFairnessState(maxDifference, intervalLen);

  return (
    <>
      {/* fixed, not literally "position: absolute" — and z-index 51/52,
          not 5/6 — same fix this app already made once for
          mdCautionSheet/mdCautionSheetScrim (styles.js), for the same two
          reasons: an absolutely-positioned scrim only covers its nearest
          positioned ancestor's own box, not the viewport, which breaks on
          a settings screen taller than one screenful; and this overlay is
          reached from a submit button *inside* the settings modal
          (mdFullScreenTakeoverOuter, z-index 50), so anything lower than
          that renders underneath it, not on top. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 51,
          background: tokens.color.scrim,
          opacity: mounted ? 1 : 0,
          transition: transition("opacity .3s"),
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={phase === "building"}
        ref={cardRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed", left: 22, right: 22, top: "50%", zIndex: 52,
          background: tokens.color.creamPaper, borderRadius: 32,
          borderTop: `3px solid ${phase === "success" ? tokens.color.pitchGreen : tokens.color.yellow}`,
          boxShadow: "0 22px 54px rgba(20,32,28,.42)",
          padding: "22px 20px 20px",
          display: "flex", flexDirection: "column", gap: 14,
          outline: "none", // a programmatic focus target for screen-reader announcement, not a click target — no visible ring needed
          transform: mounted ? "translateY(-50%) scale(1)" : "translateY(-46%) scale(.96)",
          opacity: mounted ? 1 : 0,
          transition: transition("transform .42s cubic-bezier(.22,.9,.3,1), opacity .42s cubic-bezier(.22,.9,.3,1)"),
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 25, color: tokens.color.deepGreen }}>
          {phase === "success" ? "✨ Rotation ready!" : "Balancing the squad…"}
        </h2>

        {phase === "building" ? (
          <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STEPS.map((step, i) => {
              const status = i < activeStep ? "finished" : i === activeStep ? "active" : "pending";
              const revealed = i <= activeStep;
              return (
                <div
                  key={step.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? "translateY(0)" : "translateY(12px)",
                    transition: transition("opacity .38s ease, transform .38s cubic-bezier(.22,.9,.3,1)"),
                  }}
                >
                  <div
                    style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                      background:
                        status === "finished" ? tokens.color.pitchGreen : status === "active" ? tokens.color.headerYellow : tokens.color.creamDeep,
                      boxShadow: status === "finished" ? "0 3px 0 #1C5B3A" : "none",
                    }}
                  >
                    {status === "finished" ? (
                      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={tokens.color.creamPaper} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    ) : (
                      step.icon
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: tokens.font.display, fontWeight: 800, fontSize: 18,
                      color: status === "finished" ? tokens.color.groupLabel : status === "active" ? tokens.color.deepGreen : tokens.color.mutedText,
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {confettiPieces.length > 0 && (
              <div
                aria-hidden="true"
                style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden", pointerEvents: "none", borderRadius: 32 }}
              >
                {confettiPieces.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      position: "absolute", left: `${p.left}%`, top: 0,
                      width: p.isCircle ? 8 : 7, height: p.isCircle ? 8 : 12,
                      borderRadius: p.isCircle ? "50%" : 2,
                      background: p.color,
                      "--bb-confetti-drift": `${p.drift}px`,
                      "--bb-confetti-spin": `${p.spin}deg`,
                      animation: `bbConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                    }}
                  />
                ))}
              </div>
            )}
            <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  background: "#fff", borderRadius: 22, padding: "14px 10px 16px",
                  boxShadow: "0 3px 0 rgba(28,58,46,.08)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}
              >
                <span style={{ fontFamily: tokens.font.body, fontWeight: 800, fontSize: 11, color: tokens.color.mutedText, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Fairness
                </span>
                <FairnessMark spreadMin={maxDifference} intervalLen={intervalLen} size={44} ringWidth={3} glyphSize={22} />
                <span style={{ fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17, color: tokens.color.deepGreen }}>{fairness.label}</span>
              </div>

              {/* "pitch time", not "minutes" — pitch, goal, and bench are
                  counted separately everywhere else in the app, so a bare
                  "N min each" here would be ambiguous about which. */}
              <p style={{ margin: 0, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 14.5, color: tokens.color.groupLabel, lineHeight: 1.45, textWrap: "pretty", textAlign: "center" }}>
                Pitch time is within {maxDifference} min for every child.
              </p>

              <div style={{ background: tokens.color.creamDeep, borderRadius: 20, padding: "12px 16px", display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: tokens.font.body, fontWeight: 800, fontSize: 12, color: tokens.color.mutedText, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Average pitch time
                </span>
                <span style={{ fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24, color: tokens.color.deepGreen, marginLeft: "auto", whiteSpace: "nowrap" }}>
                  ≈ {averageMinutes} min
                </span>
              </div>

              <button
                ref={continueBtnRef}
                onClick={onContinue}
                style={{
                  width: "100%", height: 60, borderRadius: 22, border: "none",
                  background: tokens.color.pitchGreen, boxShadow: `0 4px 0 ${tokens.color.greenShadow}`,
                  fontFamily: tokens.font.display, fontWeight: 800, fontSize: 20, color: tokens.color.creamPaper,
                  cursor: "pointer",
                }}
              >
                View my rotation
              </button>
            </div>
          </>
        )}
      </div>

      {confettiPieces.length > 0 && (
        <style>{`
          @keyframes bbConfettiFall {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translate(var(--bb-confetti-drift), 300px) rotate(var(--bb-confetti-spin)); opacity: 0; }
          }
        `}</style>
      )}
    </>
  );
}
