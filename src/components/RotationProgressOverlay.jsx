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

// The checklist/result layers are position:absolute (so they can sit on
// top of one another for the crossfade below) and therefore only report a
// real scrollHeight once they've actually been laid out — not on the very
// first frame. Retry on rAF until both do, but give up after a generous
// cap rather than polling forever in the (never-seen-in-practice) case a
// layer somehow never reports a size — jsdom's own zero-layout environment
// is exactly that case, so this also keeps the test suite's fake-timer
// queue finite.
const MEASURE_RETRY_LIMIT = 40;

// The result layer's bottom-most element ("View my rotation") has a
// solid drop-shadow (boxShadow: "0 4px 0 …") that paints 4px below its
// own layout box. scrollHeight only measures layout, not paint effects
// like box-shadow, so without this buffer the stage's own height (and
// its overflow:hidden clip) always lands a few px short — not a timing
// issue, a measurement one. Real-use feedback: the button's shadow was
// visibly clipped on a real device even once the height/content
// transitions weren't racing each other.
const RESULT_HEIGHT_BUFFER = 6;

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

  // Real-use feedback: the checklist used to unmount the instant the
  // result was ready and the result mounted fresh in its place, so the
  // card's height snapped straight to the new value and the whole thing
  // lurched upward. Neither layer unmounts now — both live inside this
  // one stage, stacked as absolutely-positioned siblings, and only ever
  // crossfade (see the layer styles below). That means the stage itself
  // has to own the height the card animates through, since with both
  // layers absolutely positioned neither contributes to its parent's
  // natural height any more.
  const checklistLayerRef = useRef(null);
  const resultLayerRef = useRef(null);
  const [heights, setHeights] = useState({ checklist: 0, result: 0 });
  // Kept false through the very first measurement so that initial
  // 0 -> checklist-height jump snaps in (matching how the checklist used
  // to just appear at its natural size) rather than visibly growing in
  // from nothing — the .58s eased height transition below only switches on
  // one render after that first real measurement lands, well before the
  // building -> success switch (~1800ms later) it actually exists for.
  const [heightTransitionReady, setHeightTransitionReady] = useState(false);

  useEffect(() => {
    let raf;
    let attempts = 0;
    const measure = () => {
      const checklist = checklistLayerRef.current?.scrollHeight || 0;
      const result = resultLayerRef.current?.scrollHeight || 0;
      attempts += 1;
      if ((!checklist || !result) && attempts < MEASURE_RETRY_LIMIT) {
        raf = requestAnimationFrame(measure);
        return;
      }
      setHeights({ checklist, result: result ? result + RESULT_HEIGHT_BUFFER : result });
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (heights.checklist && heights.result) setHeightTransitionReady(true);
  }, [heights]);

  const stageHeight = phase === "success" ? heights.result : heights.checklist;

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
  // "building" there's nothing focusable inside at all — the result
  // layer's own button sits at tabIndex -1 until success (see its own
  // comment below), so the selector below still finds nothing and Tab
  // just gets bounced back to the card itself. During "success" there's
  // exactly one focusable control, so this simply keeps handing focus
  // back to it rather than letting Tab escape to whatever's (aria-hidden)
  // behind the scrim.
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

  // The last tick becomes the fairness mark — a FLIP handoff, not a second
  // circle fading in. step3DiscRef is the third checklist step's own tick
  // disc; fairnessWrapRef is a plain 44x44 positioning box around the
  // real, untouched <FairnessMark> below; flipDiscRef/beamGlyphRef/
  // tickGlyphRef belong to a duplicate disc stacked on top of it that this
  // effect drives by hand and hides again once it settles — FairnessMark
  // itself never changes, so the mark the coach sees for the rest of the
  // match really is "the same fairness mark", not a copy.
  const step3DiscRef = useRef(null);
  const fairnessWrapRef = useRef(null);
  const flipDiscRef = useRef(null);
  const beamGlyphRef = useRef(null);
  const tickGlyphRef = useRef(null);

  useEffect(() => {
    if (phase !== "success" || reducedMotion) return;
    const tickEl = step3DiscRef.current;
    const flipEl = flipDiscRef.current;
    const beamEl = beamGlyphRef.current;
    const tickGlyphEl = tickGlyphRef.current;
    const fairnessBox = fairnessWrapRef.current;
    if (!tickEl || !flipEl || !beamEl || !tickGlyphEl || !fairnessBox) return;

    const tickRect = tickEl.getBoundingClientRect();
    const fairnessRect = fairnessBox.getBoundingClientRect();
    // Both rects are real, laid-out boxes in a browser; jsdom's tests
    // don't lay anything out at all, so this bails out cleanly there
    // rather than animating from a nonsense 0/0 scale.
    if (!tickRect.width || !fairnessRect.width) return;

    const dx = tickRect.left + tickRect.width / 2 - (fairnessRect.left + fairnessRect.width / 2);
    const dy = tickRect.top + tickRect.height / 2 - (fairnessRect.top + fairnessRect.height / 2);
    const s = tickRect.width / fairnessRect.width;

    // Step 3 — reset to (and start from) the tick disc's own place, size,
    // and colours, transition none. Every field touched here gets reset
    // explicitly rather than assumed, so a second build (a fresh mount,
    // but belt-and-suspenders) always animates from the same clean start.
    flipEl.style.transition = "none";
    flipEl.style.display = "grid";
    flipEl.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
    flipEl.style.background = tokens.color.pitchGreen;
    flipEl.style.borderColor = "#1C5B3A";
    flipEl.style.boxShadow = "0 3px 0 #1C5B3A";
    beamEl.style.transition = "none";
    beamEl.style.opacity = "0";
    tickGlyphEl.style.transition = "none";
    tickGlyphEl.style.opacity = "1";

    // Only one disc on screen at a time — the step's own tick fades out
    // fast as the handoff starts, quicker than the checklist layer's own
    // .3s crossfade so it's gone well before the flip disc settles.
    tickEl.style.transition = "opacity .16s ease";
    tickEl.style.opacity = "0";

    // Force a reflow so the "from" styles above actually commit before
    // the "to" styles get scheduled — without this the browser can (and
    // will) coalesce both into one paint and there's nothing to animate.
    void flipEl.offsetHeight;

    const raf = requestAnimationFrame(() => {
      flipEl.style.transform = "translate(0, 0) scale(1)";
      flipEl.style.transition =
        "transform .62s cubic-bezier(.22,.9,.3,1), background-color .38s ease .2s, border-color .38s ease .2s, box-shadow .38s ease .2s";
      flipEl.style.background = tokens.color.creamPaper;
      flipEl.style.borderColor = fairness.ring;
      flipEl.style.boxShadow = "none";

      beamEl.style.transition = "opacity .3s ease .34s";
      beamEl.style.opacity = "1";

      tickGlyphEl.style.transition = "opacity .24s ease .26s";
      tickGlyphEl.style.opacity = "0";
    });

    // Once the handoff disc's own transition has fully settled it's
    // pixel-identical to the plain FairnessMark sitting underneath it —
    // hide it rather than leave a second, now-invisible disc stacked
    // there forever. .62s is the longest transition above; the extra
    // buffer covers timer drift, not any further animation.
    const settle = setTimeout(() => {
      flipEl.style.display = "none";
    }, 700);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reducedMotion]);

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
          // Centred via top:50% + translateY(-50%), both relative to the
          // card's own (currently animating) height — that's what makes
          // the recentring track the stage's height transition below
          // automatically, frame by frame, with no extra code.
          transform: mounted ? "translateY(-50%) scale(1)" : "translateY(-46%) scale(.96)",
          opacity: mounted ? 1 : 0,
          transition: transition("transform .42s cubic-bezier(.22,.9,.3,1), opacity .42s cubic-bezier(.22,.9,.3,1)"),
        }}
      >
        <h2 id={titleId} style={{ margin: 0, fontFamily: tokens.font.display, fontWeight: 800, fontSize: 25, color: tokens.color.deepGreen }}>
          {phase === "success" ? "✨ Rotation ready!" : "Balancing the squad…"}
        </h2>

        {/* The stage: one relatively-positioned box whose own height is
            the thing that transitions (so the card grows into the result
            instead of snapping to it) — overflow hidden so the result
            layer's full height is progressively revealed as the stage
            grows into it, rather than spilling out past the still-
            animating edge. Both layers below live inside it for good,
            crossfading via opacity; neither ever unmounts. */}
        <div
          style={{
            position: "relative",
            height: stageHeight || undefined,
            overflow: "hidden",
            transition: transition(heightTransitionReady ? "height .58s cubic-bezier(.22,.9,.3,1)" : "none"),
          }}
        >
          <div
            ref={checklistLayerRef}
            role="status"
            aria-live="polite"
            aria-hidden={phase !== "building"}
            style={{
              position: "absolute", left: 0, right: 0, top: 0,
              display: "flex", flexDirection: "column", gap: 12,
              // Real-use feedback: sitting flush against the card's own
              // 20px padding read as too left-aligned — the success
              // card's own white "Fairness" box gets a further 10px inset
              // of its own on top of that, this gives the checklist the
              // same breathing room for visual consistency between the
              // two states.
              paddingLeft: 10,
              opacity: phase === "building" ? 1 : 0,
              pointerEvents: phase === "building" ? "auto" : "none",
              transition: transition("opacity .3s ease"),
            }}
          >
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
                    ref={i === 2 ? step3DiscRef : undefined}
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

          <div
            ref={resultLayerRef}
            aria-hidden={phase !== "success"}
            style={{
              position: "absolute", left: 0, right: 0, top: 0, zIndex: 3, // above the confetti layer below (zIndex 2), same relationship as before
              display: "flex", flexDirection: "column", gap: 14,
              opacity: phase === "success" ? 1 : 0,
              pointerEvents: phase === "success" ? "auto" : "none",
              transition: transition("opacity .4s ease"),
            }}
          >
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
              <div ref={fairnessWrapRef} style={{ position: "relative", width: 44, height: 44 }}>
                <FairnessMark spreadMin={maxDifference} intervalLen={intervalLen} size={44} ringWidth={3} glyphSize={22} />
                {/* The FLIP handoff disc — a duplicate stacked exactly over
                    the real mark above, hidden until the effect above
                    drives it, and hidden again once it settles. Never the
                    thing the coach actually reads; that's always the real
                    FairnessMark underneath. */}
                <div
                  ref={flipDiscRef}
                  aria-hidden="true"
                  style={{
                    position: "absolute", inset: 0, display: "none", placeItems: "center",
                    borderRadius: "50%", boxSizing: "border-box", border: "3px solid #1C5B3A",
                    background: tokens.color.pitchGreen, pointerEvents: "none",
                  }}
                >
                  <svg
                    ref={beamGlyphRef}
                    width={22} height={22} viewBox="0 0 24 24" fill="none"
                    stroke={tokens.color.deepGreen} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    style={{ gridArea: "1 / 1", opacity: 0 }}
                  >
                    <g transform={`rotate(${fairness.tilt} 12 8)`}>
                      <path d="M4 8h16" />
                      <circle cx="4" cy="8" r="1.5" />
                      <circle cx="20" cy="8" r="1.5" />
                    </g>
                    <path d="M12 8v7" />
                    <path d="M8.5 19l3.5-4 3.5 4z" />
                  </svg>
                  <svg
                    ref={tickGlyphRef}
                    width={19} height={19} viewBox="0 0 24 24" fill="none"
                    stroke={tokens.color.creamPaper} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round"
                    style={{ gridArea: "1 / 1", opacity: 1 }}
                  >
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </div>
              </div>
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
              // Never focusable early — aria-hidden on the layer above
              // already keeps it out of the accessibility tree while
              // hidden, but that alone doesn't reliably stop a mouse-Tab
              // from landing on it in every browser, same reasoning as
              // SquadSettingsForm's own overlayOpen guard.
              tabIndex={phase === "success" ? undefined : -1}
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
        </div>

        {/* Confetti stays positioned relative to the card as a whole (the
            nearest positioned ancestor — this dialog div), same as before
            the stage/layer split: it was never inside the "results
            content" box, just a sibling of it, so it's a sibling of the
            stage here too, not nested inside it. */}
        {phase === "success" && confettiPieces.length > 0 && (
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
