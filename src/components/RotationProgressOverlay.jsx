import { useState, useEffect, useRef, useCallback, useId, useMemo } from "react";
import { getFairnessState } from "../lib/fairness.js";
import FairnessMark from "./FairnessMark.jsx";
import { tokens, styles } from "./styles.js";

const STEPS = [
  { icon: "⚽", label: "Checking playing time" },
  { icon: "⚖️", label: "Balancing rotations" },
  // icon: null — this step renders SparkleIcon (below) instead of a plain
  // emoji glyph; see its own comment for why.
  { icon: null, label: "Finding the fairest setup" },
];

// Real-use feedback: the plain "✨" emoji's own glyph colours (a solid
// gold star on most platforms) washed out against this step's own
// headerYellow "active" disc — a yellow icon on a yellow background.
// Hand-drawn instead, like every other custom icon in this app
// (matchDayIcons.jsx, strokeIcons.jsx) — two 4-point sparkle stars in two
// different, deliberately-not-pale colours so it reads clearly against
// both this step's own possible disc backgrounds (headerYellow active,
// creamDeep pending), not just one flat glyph colour: the big star is
// pitchGreen, the same green every primary button in this app already
// uses (not deepGreen — real-use feedback that deepGreen read as
// "basically black" here, too dark to register as green at this size),
// the small accent star stays the app's own saturated yellow token.
// Real-use feedback again: bigger overall, and the big star centred in
// its own right — it used to sit off toward the viewBox's top-left
// (its own centre well short of (12,12), the viewBox's true centre);
// now genuinely centred there, with a larger radius so it still reads
// clearly at the bigger rendered size.
function SparkleIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 3L13.1 9.9 20 12 13.1 14.1 11 21 8.9 14.1 2 12 8.9 9.9Z" fill={tokens.color.pitchGreen} />
      <path d="M19 1.5L19.85 4.15 22.5 5 19.85 5.85 19 8.5 18.15 5.85 15.5 5 18.15 4.15Z" fill={tokens.color.yellow} />
    </svg>
  );
}

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
// Shared by the needs-attention menu's own "see current minutes" disclosure
// and the Improve preview below it — same row shape SummaryModal.jsx's
// Today's Minutes already renders, condensed, so either place reads as the
// same table a coach already knows rather than a new visual language.
function MinutesTable({ rows, nameOf, numberOf }) {
  return (
    <div>
      <div style={styles.mdMinutesColHeads}>
        <span style={styles.mdMinutesColHeadSpacerDisc} aria-hidden="true" />
        <span style={styles.mdMinutesColHeadSpacerName} aria-hidden="true" />
        <span style={styles.mdMinutesColHeadPitch}>PITCH</span>
        <span style={styles.mdMinutesColHeadGoal}>GOAL</span>
        <span style={styles.mdMinutesColHeadBench}>BENCH</span>
      </div>
      <div style={{ ...styles.mdMinutesList, maxHeight: 190, overflowY: "auto" }}>
        {rows.map((r) => (
          <div key={r.id} style={styles.mdMinutesRow}>
            <span style={styles.mdMinutesDisc}>{numberOf ? numberOf(r.id) : ""}</span>
            <span style={styles.mdMinutesName}>{nameOf ? nameOf(r.id) : r.id}</span>
            <span style={{ ...styles.mdMinutesValuePitch, ...(Math.round(r.outfieldMin) === 0 ? styles.mdMinutesZero : {}) }}>
              {Math.round(r.outfieldMin) === 0 ? "—" : Math.round(r.outfieldMin)}
            </span>
            <span style={{ ...styles.mdMinutesValueGoal, ...(Math.round(r.gkMin) === 0 ? styles.mdMinutesZero : {}) }}>
              {Math.round(r.gkMin) === 0 ? "—" : Math.round(r.gkMin)}
            </span>
            <span style={{ ...styles.mdMinutesValueBench, ...(Math.round(r.benchMin) === 0 ? styles.mdMinutesZero : {}) }}>
              {Math.round(r.benchMin) === 0 ? "—" : Math.round(r.benchMin)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Range (max - min), rounded — the same "spread" arithmetic
// computeFairnessSpread/calculateFairness already use elsewhere, done
// locally here since this operates on already-summarized rows rather than
// a raw plan.
function spreadOf(rows, key) {
  if (!rows || rows.length === 0) return null;
  const vals = rows.map((r) => r[key]);
  return Math.round(Math.max(...vals) - Math.min(...vals));
}

// onImprove/onUseImprovedPlan/nameOf/numberOf/currentRows are all
// optional — omitting them (every existing caller, before this feature)
// falls straight back to the original single "View my rotation" button
// for every tier, needs-attention included. Real callers wire onImprove
// to useMatchState's previewImprovedFairness (builds a candidate, doesn't
// touch match state), onUseImprovedPlan to useImprovedPlan (commits one),
// and currentRows to computeMinutesSummary(plan, availableIds) for the
// plan actually being shown — see SubRotationPlanner.jsx's call site.
export default function RotationProgressOverlay({
  averageMinutes, maxDifference, intervalLen, gameMinutes, onContinue, onImprove, onUseImprovedPlan, nameOf, numberOf, currentRows,
}) {
  const [phase, setPhase] = useState("building"); // "building" | "success"
  const [activeStep, setActiveStep] = useState(0); // 0,1,2 — which step is the current "in progress" one
  const [mounted, setMounted] = useState(false); // flips true one frame after mount, so the enter transition actually has a "from" state to animate away from
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();
  const cardRef = useRef(null);
  const continueBtnRef = useRef(null);

  // The "Needs attention -> Solve" decision tree (menu of Improve pitch/
  // Improve bench/View anyway) lives entirely in this component's own
  // local state — SubRotationPlanner only ever sees the two calls below,
  // never "which screen of the sheet is showing". solveView only matters
  // once isNeedsAttention is true; improvedCandidate holds whichever
  // candidate onImprove most recently returned (plus which metric it was
  // built for, so "Try again" can re-ask for the same one).
  const [solveView, setSolveView] = useState("menu"); // "menu" | "preview"
  const [improvedCandidate, setImprovedCandidate] = useState(null); // { intervals, stats, rows, metric } | null
  // Real-use feedback: the menu offered "Improve pitch" vs "Improve bench"
  // with nothing to inform which one actually needs it — a coach was
  // choosing blind. showCurrentMinutes reveals the CURRENT plan's own
  // per-player table (currentRows) in place, collapsed by default so the
  // menu stays compact for a coach who doesn't want the detail.
  const [showCurrentMinutes, setShowCurrentMinutes] = useState(false);

  const handleImprove = useCallback(
    (metric) => {
      const result = onImprove?.(metric);
      if (!result) return; // defensive — a plan already exists by the time this is reachable, so buildFreshPlanArgs failing here isn't expected
      setImprovedCandidate({ ...result, metric });
      setSolveView("preview");
    },
    [onImprove]
  );
  const handleTryAgain = useCallback(() => {
    if (improvedCandidate) handleImprove(improvedCandidate.metric);
  }, [improvedCandidate, handleImprove]);
  const handleBack = useCallback(() => {
    setImprovedCandidate(null);
    setSolveView("menu");
  }, []);
  const handleUseImproved = useCallback(() => {
    if (!improvedCandidate) return;
    onUseImprovedPlan?.(improvedCandidate.intervals);
    onContinue();
  }, [improvedCandidate, onUseImprovedPlan, onContinue]);

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

  // Real-device feedback: right after tapping "Build new rotation" from a
  // long, scrolled-down settings form, this overlay's own position:fixed
  // centering (top:50% below) could land wrong — the "View my rotation"
  // button wasn't tappable until the coach scrolled the background, which
  // settled it. The settings form swaps for the (shorter) match screen in
  // place, with no navigation/reload to reset scroll on its own — so the
  // browser was left holding a stale scrollTop against a now-shorter
  // document, exactly the kind of state known to break position:fixed's
  // viewport math on mobile Safari until something forces a reflow.
  // Resetting scroll the instant this overlay mounts is that reflow, done
  // on purpose instead of leaving it to chance (or to the coach noticing
  // they need to scroll).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Re-runs on [solveView, improvedCandidate] too, not just on mount — the
  // needs-attention menu/preview swap changes the result layer's own real
  // content height (a candidate's per-player list is taller than the
  // three-button menu, and different candidates can differ slightly too),
  // and the stage's own height (stageHeight, below) has to track that or
  // the swapped-in content clips against whatever was measured on first
  // mount. Same retry-until-both-truthy logic as the original mount-only
  // version — cheap to re-run, and idempotent when nothing changed.
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
  }, [solveView, improvedCandidate, showCurrentMinutes]);

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

  // Once success appears, hand focus to the one real action in the card —
  // also re-fires on [solveView], since continueBtnRef is reattached to a
  // different button (menu's first option vs. preview's "Use this
  // rotation") each time the needs-attention decision tree changes screen.
  useEffect(() => {
    if (phase !== "success") return;
    const raf = requestAnimationFrame(() => continueBtnRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase, solveView]);

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
  const fairness = getFairnessState(maxDifference, intervalLen, gameMinutes);
  // The decision tree only ever activates for the tier the just-built plan
  // actually landed on, and only when the caller actually wired both
  // callbacks — see the component's own top comment.
  const isNeedsAttention = fairness.key === "needsAttention" && Boolean(onImprove) && Boolean(onUseImprovedPlan);
  const showingCandidate = isNeedsAttention && solveView === "preview" && Boolean(improvedCandidate);
  // Whichever plan's numbers the top "Fairness" card/paragraph/average row
  // should currently reflect — the original just-built plan everywhere
  // except while actually previewing a candidate, where the whole point is
  // to show what THAT candidate achieved instead.
  const displayStats = showingCandidate ? improvedCandidate.stats : { averageMinutes, maxDifference, intervalLen, gameMinutes };
  const displayFairness = showingCandidate
    ? getFairnessState(displayStats.maxDifference, displayStats.intervalLen, displayStats.gameMinutes)
    : fairness;
  // The two numbers the menu's own "Improve pitch" vs "Improve bench"
  // choice actually depends on — the top card's own "Pitch time is within
  // N min" line is the COMBINED goal+outfield metric (computeFairnessSpread),
  // a different, coarser number than either of these, so it can't answer
  // "which one is actually worse right now" on its own.
  const currentOutfieldSpread = spreadOf(currentRows, "outfieldMin");
  const currentBenchSpread = spreadOf(currentRows, "benchMin");
  // Real-use feedback: promote whichever fix actually addresses the
  // bigger problem, via colour, rather than always favouring "Improve
  // pitch fairness" regardless of which column is actually worse — green
  // should point a coach toward the right decision, not an arbitrary
  // default. Ties (or no currentRows to compare) fall back to pitch,
  // matching this menu's own existing button order.
  const pitchNeedsMoreWork =
    currentOutfieldSpread === null || currentBenchSpread === null || currentOutfieldSpread >= currentBenchSpread;

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
              // 20px padding read as too left-aligned — a first pass at
              // +10px still wasn't enough, bumped further.
              paddingLeft: 24,
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
                    ) : i === 2 ? (
                      <SparkleIcon />
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
              {/* Real-use feedback: an earlier version had this mark travel
                  in from the last checklist tick's position (a FLIP
                  animation) — it read as the mark being "sucked" from one
                  spot to another rather than arriving, so that's gone.
                  FairnessMark just renders here, in place, and appears via
                  this same crossfade every other piece of the result
                  layer already uses — no separate motion, no travel. */}
              <FairnessMark spreadMin={displayStats.maxDifference} intervalLen={displayStats.intervalLen} gameMinutes={displayStats.gameMinutes} size={44} ringWidth={3} glyphSize={22} />
              <span style={{ fontFamily: tokens.font.display, fontWeight: 800, fontSize: 17, color: tokens.color.deepGreen }}>{displayFairness.label}</span>
            </div>

            <div style={{ background: tokens.color.creamDeep, borderRadius: 20, padding: "12px 16px", display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: tokens.font.body, fontWeight: 800, fontSize: 12, color: tokens.color.mutedText, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Average pitch time
              </span>
              <span style={{ fontFamily: tokens.font.display, fontWeight: 800, fontSize: 24, color: tokens.color.deepGreen, marginLeft: "auto", whiteSpace: "nowrap" }}>
                ≈ {displayStats.averageMinutes} min
              </span>
            </div>

            {/* Every button below shares the same "never focusable early"
                reasoning as the original single button had — aria-hidden on
                the layer above already keeps them out of the accessibility
                tree while hidden, but that alone doesn't reliably stop a
                mouse-Tab from landing on one in every browser, same
                reasoning as SquadSettingsForm's own overlayOpen guard. */}
            {!isNeedsAttention ? (
              <button
                ref={continueBtnRef}
                onClick={onContinue}
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
            ) : solveView === "menu" ? (
              // The decision tree itself — "Needs attention" no longer
              // dead-ends at the same button every other tier gets. Two
              // active fixes plus the honest opt-out (fix it by hand during
              // the match, exactly like every tier already lets a coach do).
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Real-use feedback: a coach was choosing between "Improve
                    pitch" and "Improve bench" with nothing telling them
                    which one actually needs it. These two numbers are what
                    the choice is actually about — deliberately separate
                    from the combined "Pitch time is within N min" line
                    above, which can't answer that question on its own. */}
                {(currentOutfieldSpread !== null || currentBenchSpread !== null) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 4px 2px" }}>
                    {currentOutfieldSpread !== null && (
                      <p style={{ margin: 0, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.groupLabel, lineHeight: 1.4 }}>
                        Outfield time varies by <span style={{ color: tokens.color.pitchGreen, fontWeight: 800 }}>{currentOutfieldSpread} min</span> across the squad.
                      </p>
                    )}
                    {currentBenchSpread !== null && (
                      <p style={{ margin: 0, fontFamily: tokens.font.body, fontWeight: 700, fontSize: 13.5, color: tokens.color.groupLabel, lineHeight: 1.4 }}>
                        Bench time varies by <span style={{ color: tokens.color.benchText, fontWeight: 800 }}>{currentBenchSpread} min</span> across the squad.
                      </p>
                    )}
                  </div>
                )}
                {currentRows && currentRows.length > 0 && (
                  <button
                    onClick={() => setShowCurrentMinutes((v) => !v)}
                    tabIndex={phase === "success" ? undefined : -1}
                    style={{
                      alignSelf: "center", border: "none", background: "transparent", padding: "0 4px 4px",
                      fontFamily: tokens.font.body, fontWeight: 800, fontSize: 13, color: tokens.color.pitchGreen,
                      textDecoration: "underline", cursor: "pointer",
                    }}
                  >
                    {showCurrentMinutes ? "Hide current minutes" : "See current minutes"}
                  </button>
                )}
                {showCurrentMinutes && currentRows && currentRows.length > 0 && (
                  <div style={{ marginBottom: 2 }}>
                    <MinutesTable rows={currentRows} nameOf={nameOf} numberOf={numberOf} />
                  </div>
                )}
                <button
                  ref={pitchNeedsMoreWork ? continueBtnRef : undefined}
                  onClick={() => handleImprove("pitch")}
                  tabIndex={phase === "success" ? undefined : -1}
                  style={{ ...(pitchNeedsMoreWork ? styles.mdCautionSheetBtnPrimary : styles.mdCautionSheetBtnSecondary), width: "100%", flex: "none" }}
                >
                  Improve pitch fairness
                </button>
                <button
                  ref={pitchNeedsMoreWork ? undefined : continueBtnRef}
                  onClick={() => handleImprove("bench")}
                  tabIndex={phase === "success" ? undefined : -1}
                  style={{ ...(pitchNeedsMoreWork ? styles.mdCautionSheetBtnSecondary : styles.mdCautionSheetBtnPrimary), width: "100%", flex: "none" }}
                >
                  Improve bench fairness
                </button>
                <button
                  onClick={onContinue}
                  tabIndex={phase === "success" ? undefined : -1}
                  style={{
                    width: "100%", height: 44, borderRadius: 22, border: "none", background: "transparent",
                    fontFamily: tokens.font.body, fontWeight: 800, fontSize: 15, color: tokens.color.mutedText, cursor: "pointer",
                  }}
                >
                  View rotation anyway
                </button>
              </div>
            ) : (
              // Preview — showing what "Improve pitch/bench fairness" just
              // found, per player, before anything is actually committed.
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <MinutesTable rows={improvedCandidate.rows} nameOf={nameOf} numberOf={numberOf} />
                <button
                  ref={continueBtnRef}
                  onClick={handleUseImproved}
                  tabIndex={phase === "success" ? undefined : -1}
                  style={{ ...styles.mdCautionSheetBtnPrimary, width: "100%", flex: "none" }}
                >
                  Use this rotation
                </button>
                <div style={styles.mdCautionSheetBtnRow}>
                  <button onClick={handleTryAgain} tabIndex={phase === "success" ? undefined : -1} style={styles.mdCautionSheetBtnSecondary}>
                    Try again
                  </button>
                  <button onClick={handleBack} tabIndex={phase === "success" ? undefined : -1} style={styles.mdCautionSheetBtnSecondary}>
                    Back
                  </button>
                </div>
              </div>
            )}
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
