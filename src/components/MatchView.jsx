import { useState, useEffect, useRef } from "react";
import { Play, Pause, BarChart2, History, ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import {
  intervalAtElapsed, computeNextChangeBadges, computeBreakBoundaries, pairChanges, computeFairnessSpread,
  intervalNeedsSubConfirm, buildFinal60Steps,
} from "../lib/rotation.js";
import { getFairnessState } from "../lib/fairness.js";
import { computeLiveElapsedSec, fmtClock } from "../lib/clock.js";
import { getFormationLayout, computeTokenSize } from "../lib/formation.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { styles, tokens } from "./styles.js";
import { GearIcon, KitShirt, MedicalCross } from "./matchDayIcons.jsx";
import { RotateIcon } from "./strokeIcons.jsx";
import FairnessMark from "./FairnessMark.jsx";

// Full-time celebration (backlog #4) — same palette RotationProgressOverlay
// already uses for its own success-state confetti, duplicated locally
// rather than imported (components in this app don't reach into each
// other's modules for shared constants; see usePrefersReducedMotion just
// below for the same call already made once in this file). No red — red
// is injury, everywhere else in this app.
const CONFETTI_COLORS = ["#F5B93B", "#2E7D53", "#FBE3A6", "#CBE8D6", "#123F3D"];

// Swap-animation gold hold marker (part C, backlog: motion for committed
// swaps) — how long the ring sits at full opacity between its fade-in and
// fade-out. Real-use feedback after shipping at 2000ms: felt a little too
// long. One constant, read by goldRingStyle/the keyframe percentages and
// the activeSwap cleanup timer below, so this is the only number to touch
// if it needs tuning again — the fade-in (220ms) and fade-out (520ms)
// durations, and the travel itself, are untouched per the original spec
// ("if timing needs tuning later, tune the hold; leave the travel alone").
const GOLD_HOLD_MS = 1000;
const GOLD_FADE_IN_MS = 220;
const GOLD_FADE_OUT_MS = 520;
const GOLD_RING_TOTAL_MS = GOLD_FADE_IN_MS + GOLD_HOLD_MS + GOLD_FADE_OUT_MS;

// Hand-drawn-style pitch markings (halfway line + centre circle) as one
// absolutely-positioned SVG overlay, replacing the old plain CSS
// border-circle/border-line. viewBox uses a fixed representative width
// (400) with preserveAspectRatio="none" so it maps close to 1:1 onto the
// real rendered box — same trade-off the old fixed-80px circle already
// made (never actually responsive to container width either), just now
// also carrying the design's "wobbly, hand-drawn" line quality via a
// couple of small bezier bumps rather than a perfectly straight line.
function PitchMarkings({ height }) {
  const cy = height * 0.4; // matches the old pitchHalfwayLine/pitchCenterCircle convention
  const r = 44;
  const k = r * 0.552; // standard 4-bezier circle approximation constant
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 400 ${height}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <path
        d={`M10,${cy - 1} C 80,${cy - 3} 140,${cy + 2} 200,${cy - 1} S 320,${cy - 3} 390,${cy + 1}`}
        stroke="rgba(255,255,255,.3)"
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M${200 + r},${cy}
            C ${200 + r},${cy + k} ${200 + k},${cy + r} 200,${cy + r}
            C ${200 - k},${cy + r} ${200 - r},${cy + k} ${200 - r},${cy}
            C ${200 - r},${cy - k} ${200 - k},${cy - r} 200,${cy - r}
            C ${200 + k},${cy - r} ${200 + r},${cy - k} ${200 + r},${cy} Z`}
        stroke="rgba(255,255,255,.3)"
        strokeWidth={2.4}
        fill="none"
      />
    </svg>
  );
}

// Where a player currently sits within one interval's data — "pitch",
// "bench", or null (injured/not part of this interval at all). Used only
// by the swap-animation trigger below to work out which direction a
// coach-committed swap is actually travelling; nothing else needs this.
function locationOf(iv, id) {
  if (iv.onField.some((p) => p.id === id)) return "pitch";
  if (iv.bench.includes(id)) return "bench";
  return null;
}

// Not shared with RotationProgressOverlay's own identical hook — this is
// scoped deliberately to this one file for this change (see the file-
// level instruction this was built against: MatchView.jsx only, nothing
// else touched, not even a same-behavior extraction into a shared hook).
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

// The mid-match fairness toast (see the timer row's own
// `key={toastTriggerCount}` call site) — a fresh instance of this mounts
// per trigger rather than one shared, reused element, so its own
// "revealed" flip always has a genuine hidden-first frame to transition
// from (same reasoning as RotationProgressOverlay's own `mounted` flag —
// flipping straight to the "shown" styles in the very same commit that
// mounts a node paints right into the end state with nothing to animate
// away from). Owns its full life on its own: reveals itself, holds ~5s,
// fades out — the parent never has to track visibility, only whether to
// render one at all.
//
// Just the fairness mark now, no pill/background/words on screen (real-
// use feedback: block 10C's dark pill retired) — the mark alone,
// centred on the timer's own line box. The wrapping div here (not
// FairnessMark itself) supplies the drop shadow this context wants,
// exactly matching FairnessMark's own size/shape so it reads as one
// piece — FairnessMark stays untouched, "same ring, same beam, same
// proportions" as the 44px success-card mark, nothing redrawn.
function FairnessToastMark({ spreadMin, intervalLen }) {
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const showRaf = requestAnimationFrame(() => setRevealed(true));
    const hideTimer = setTimeout(() => setRevealed(false), 5000);
    return () => {
      cancelAnimationFrame(showRaf);
      clearTimeout(hideTimer);
    };
  }, []);
  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute", right: 0, top: 0, height: 63, pointerEvents: "none",
        display: "flex", alignItems: "center",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateX(0)" : "translateX(16px)",
        transition: reducedMotion ? "none" : "opacity .5s ease, transform .5s cubic-bezier(.25,.8,.35,1)",
      }}
    >
      <div style={{ width: 56, height: 56, borderRadius: "50%", boxShadow: "0 5px 14px rgba(20,32,28,.16)" }}>
        <FairnessMark spreadMin={spreadMin} intervalLen={intervalLen} size={56} ringWidth={3.8} glyphSize={29} />
      </div>
      {/* Not drawn, but still in the accessibility tree — the aria-live
          region above still announces this once even though the words
          themselves are gone from the screen. */}
      <span
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        {getFairnessState(spreadMin, intervalLen).toast}
      </span>
    </div>
  );
}

// Block 11 — the shared shell both final-60 sheets sit in: the 240ms
// slide-up + fade on mount ("no animation under prefers-reduced-motion"),
// the grab handle + swipe-down-to-dismiss (useSheetDrag, same mechanism
// every other bottom sheet in this file already uses), and the in-flow-
// but-stacked-above-the-scrim trick (position:relative + a zIndex above
// mdScrim's own fixed 45 — that's what lets an ordinary flow element
// still paint over a position:fixed sibling). A fresh instance mounts
// each time the caller renders one (keyed by pendingIndex, so a genuinely
// new pending interval always gets its own reveal) — same "mount hidden,
// reveal a tick later" idiom as FairnessToastMark/the swap animation,
// needed here because the transition wouldn't otherwise have a real
// "from" frame to animate away from.
function Final60SheetShell({ onDismiss, testId, ariaLabel, children }) {
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const drag = useSheetDrag(onDismiss);
  const dragging = drag.dragStyle.transition === "none";
  return (
    <div
      style={{
        ...styles.mdFinal60Shell,
        opacity: reducedMotion ? 1 : revealed ? 1 : 0,
        transform: reducedMotion
          ? drag.dragStyle.transform
          : `${drag.dragStyle.transform} ${revealed ? "translateY(0)" : "translateY(24px)"}`,
        transition: dragging ? "none" : reducedMotion ? "none" : "opacity 240ms ease, transform 240ms ease",
      }}
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
    >
      <div {...drag.dragHandleProps}>
        <div style={styles.mdFinal60Handle} />
      </div>
      {children}
    </div>
  );
}

// SHEET 1 — PREPARE. Only players who have to physically walk onto the
// pitch before the whistle get a card: the incoming keeper (if they're a
// genuine bench arrival — one already on the pitch just changing role has
// nothing to walk anywhere for, see MatchView's own becomingKeeperFromBench
// check) and every regular bench arrival. Nobody leaving, and nobody just
// changing position while staying on, appears here at all — they have
// nothing to do yet either.
function PrepareSheet({ pendingChanges, keeperFromBench, nameOf, numberOf, toggleTimer, onReady, onMount }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onMount(), []);
  const { comingOnIds, becomingKeeperId } = pendingChanges;
  return (
    <Final60SheetShell onDismiss={onReady} testId="prepare-sheet" ariaLabel="Prepare for the next substitution">
      <div style={styles.mdFinal60TitleRow}>
        <span style={styles.mdPrepareTitle}>Next sub in 0:60</span>
        <span style={styles.mdFinal60Label}>GET READY</span>
      </div>
      {keeperFromBench && (
        <div style={styles.mdPrepareCardKeeper}>
          <span style={styles.mdPrepareDiscKeeper}>{numberOf(becomingKeeperId)}</span>
          <div style={styles.mdPrepareCardKeeperBody}>
            <div style={styles.mdPrepareCardKeeperNameRow}>
              <span style={styles.mdPrepareCardKeeperName}>{nameOf(becomingKeeperId)}</span>
              <span style={styles.mdFinal60GkPill}>GK</span>
            </div>
            <div style={styles.mdPrepareCardKeeperInstruction}>Go stand by the goal</div>
          </div>
        </div>
      )}
      {[...comingOnIds].map((id) => (
        <div key={id} style={styles.mdPrepareCardQuiet}>
          <span style={styles.mdPrepareDiscQuiet}>{numberOf(id)}</span>
          <div style={styles.mdPrepareCardQuietBody}>
            <span style={styles.mdPrepareCardQuietName}>{nameOf(id)}</span>
            <span style={styles.mdPrepareCardQuietInstruction}>Ready at halfway</span>
          </div>
        </div>
      ))}
      <div style={styles.mdFinal60ActionRow}>
        <button style={styles.mdFinal60ActionPause} onClick={toggleTimer}>
          <Pause size={20} /> Pause
        </button>
        <button style={styles.mdFinal60ActionPrimary} onClick={onReady}>
          Ready ✓
        </button>
      </div>
    </Final60SheetShell>
  );
}

// SHEET 2 — EXECUTE. steps is buildFinal60Steps' own output (rotation.js)
// — each step already carries which of the three colours (leaving/
// arriving/changing) each side is in; this component is purely about
// turning that into the numbered rows, not deciding any of it.
const FINAL60_DISC_COLOR = { leaving: tokens.color.alertRed, arriving: tokens.color.pitchGreen, changing: tokens.color.changing };
function stepTitle(step, nameOf) {
  if (step.titleKind === "gkSwap") return "Goalkeeper swap";
  const name = nameOf(step.subjectId);
  if (step.titleKind === "comesOn") return `${name} comes on`;
  if (step.titleKind === "takesField") return `${name} takes the field`;
  return `${name} comes off`;
}
function ExecuteSheet({ steps, nameOf, numberOf, toggleTimer, onSubDone, onDismiss, onMount }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onMount(), []);
  return (
    <Final60SheetShell onDismiss={onDismiss} testId="execute-sheet" ariaLabel="Make the changes">
      <div style={styles.mdFinal60TitleRow}>
        <span style={styles.mdExecuteTitle}>Make the changes</span>
        <span style={styles.mdFinal60Label}>0:30 · IN ORDER</span>
      </div>
      <div style={styles.mdExecuteStepList}>
        {steps.map((step, i) => (
          <div key={i} style={styles.mdExecuteStepRow}>
            <span style={styles.mdExecuteStepNumeral}>{i + 1}.</span>
            <div style={styles.mdExecuteStepBody}>
              <span style={styles.mdExecuteStepInstruction}>{stepTitle(step, nameOf)}</span>
              <div style={styles.mdExecuteChipRow}>
                {step.outId && (
                  <span style={styles.mdExecuteChip}>
                    <span style={{ ...styles.mdExecuteChipDisc, background: FINAL60_DISC_COLOR[step.outColor] }}>
                      {numberOf(step.outId)}
                    </span>
                    <span style={styles.mdExecuteChipName}>{nameOf(step.outId)}</span>
                  </span>
                )}
                {step.outId && step.inId && <span style={styles.mdExecuteChipArrow}>→</span>}
                {step.inId && (
                  <span style={styles.mdExecuteChip}>
                    <span style={{ ...styles.mdExecuteChipDisc, background: FINAL60_DISC_COLOR[step.inColor] }}>
                      {numberOf(step.inId)}
                    </span>
                    <span style={styles.mdExecuteChipName}>{nameOf(step.inId)}</span>
                    {step.inIsKeeper && <span style={{ ...styles.mdFinal60GkPill, marginLeft: "auto" }}>GK</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={styles.mdFinal60ActionRow}>
        <button style={styles.mdFinal60ActionPause} onClick={toggleTimer}>
          <Pause size={20} /> Pause
        </button>
        <button style={styles.mdFinal60ActionPrimary} onClick={onSubDone}>
          Sub done ✓
        </button>
      </div>
    </Final60SheetShell>
  );
}

// The 30-seconds-late auto-apply's own visible cue (block 11: "must be
// visible, not silent"). Reuses FairnessToastMark's reveal/fade mechanics
// (the rAF-then-reveal mount trick, the timed auto-hide) but is its own
// content — a text pill with an Undo action, not a ring — so it isn't
// built as a variant of that component. There's no pre-existing "Undo"
// mechanism anywhere else in this app to hook into (confirmed — this is
// the first one), so Undo here is deliberately minimal: it just clears
// the auto-applied subLog entry back out, which on its own re-locks the
// board to that interval and brings the execute sheet back for a real tap.
function AutoApplyToast({ message, onUndo }) {
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const showRaf = requestAnimationFrame(() => setRevealed(true));
    const hideTimer = setTimeout(() => setRevealed(false), 5000);
    return () => {
      cancelAnimationFrame(showRaf);
      clearTimeout(hideTimer);
    };
  }, []);
  return (
    <div
      style={{
        ...styles.mdAutoApplyToast,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(10px)",
        transition: reducedMotion ? "none" : "opacity .4s ease, transform .4s cubic-bezier(.25,.8,.35,1)",
      }}
      aria-live="polite"
    >
      <span style={styles.mdAutoApplyToastText}>{message}</span>
      <button style={styles.mdAutoApplyToastUndo} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

// The live match screen: clock, current sub-window status, interval tabs,
// pitch board (formation + bench + injured), and interval navigation.
// Everything here is about "what's happening in the game right now" —
// squad/game setup lives in SquadSettingsForm instead.
export default function MatchView({
  plan,
  activeInterval,
  setActiveInterval,
  elapsedSec,
  setElapsedSec,
  baseElapsedSec,
  setBaseElapsedSec,
  runStartedAt,
  setRunStartedAt,
  timerRunning,
  setTimerRunning,
  subLog,
  setSubLog,
  autoAppliedSub,
  swapPickId,
  setSwapPickId,
  injuredThisGame,
  injuredAt,
  keeperEligibleIds,
  availableIds,
  breakSegments,
  nameOf,
  numberOf,
  teamName,
  crestSrc,
  availableCount,
  gameSettingsSummary,
  onInjury,
  onBringBack,
  onSwap,
  onReset,
  onShowSummary,
  onShowSeason,
  onShowSettings,
  onShowSquadChange,
  onShowTeamSwitcher,
}) {
  const totalGameSec = plan[plan.length - 1].endMin * 60;
  const isMatchComplete = elapsedSec >= totalGameSec;

  // Full-time celebration (backlog #4) — a one-time confetti burst over
  // the match-complete banner. confettiFiredRef, not just isMatchComplete
  // itself, is what makes this fire once: nothing here needs to
  // distinguish "just turned true" from "already was true when this
  // screen mounted" (e.g. navigating back to an already-finished game) —
  // either way, the coach seeing this banner for the first time this
  // mount is the moment worth marking, and it should never replay on a
  // later re-render while the banner's still showing.
  const reducedMotion = usePrefersReducedMotion();
  const confettiFiredRef = useRef(false);
  const [confettiPieces, setConfettiPieces] = useState([]);
  useEffect(() => {
    if (!isMatchComplete || reducedMotion || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    const pieces = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      isCircle: i % 2 === 0,
      left: Math.round(5 + Math.random() * 90),
      drift: Math.round(Math.random() * 54 - 27),
      spin: Math.round(300 + Math.random() * 360),
      duration: (1.25 + Math.random() * 0.54).toFixed(2),
      delay: (Math.random() * 0.39).toFixed(2),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
    setConfettiPieces(pieces);
    // Longest possible piece duration (1.79s) + delay (.39s) + a small
    // buffer — matches the same "clean up after the animation finishes,
    // don't leave 16 spent nodes in the DOM forever" reasoning
    // RotationProgressOverlay's own confetti settle-timeout uses.
    const timer = setTimeout(() => setConfettiPieces([]), 2400);
    return () => clearTimeout(timer);
  }, [isMatchComplete, reducedMotion]);

  // Mid-match fairness toast — flashes the fairness mark whenever
  // something changes the remaining rotation (a swap, a late arrival, an
  // injury, a squad change), an unprompted reminder that what's left is
  // still fair. All four of those mutations funnel through this same
  // `plan` reference one level up (useMatchState/SubRotationPlanner), so
  // watching *that* change is a reliable single trigger point rather than
  // wiring a bespoke event through every individual mutation — and
  // recomputing the spread fresh each time means this always reflects
  // the game from here on, not a stale snapshot from kickoff.
  const spreadMin = computeFairnessSpread(plan, availableIds);
  // The rotation's own intervals are all the same length by construction
  // (computeIntervals splits the game evenly) — the first one is a safe,
  // cheap stand-in rather than threading gameSettings.subIntervalMinutes
  // through as a whole separate prop just for this.
  const intervalLen = plan[0].endMin - plan[0].startMin;
  const [toastTriggerCount, setToastTriggerCount] = useState(0); // 0 = never triggered yet, so nothing renders on first mount
  // Primed with the CURRENT plan, not a bare "have we run yet" boolean —
  // real-device bug caught testing this in the actual app (not visible in
  // the Vitest/jsdom suite, since RTL's render() doesn't wrap in
  // StrictMode by default the way main.jsx's real tree does): StrictMode
  // deliberately runs every effect twice on mount. A boolean flag flipped
  // false by the first of those two runs was already false by the second,
  // so that "only skip once" guard fired the toast immediately on
  // load — comparing against the actual last-seen plan instead survives
  // the duplicate run fine, since `plan` itself hasn't changed between
  // StrictMode's two synthetic invocations, only across a genuine update.
  const lastPlanRef = useRef(plan);
  useEffect(() => {
    if (plan === lastPlanRef.current) return;
    lastPlanRef.current = plan;
    setToastTriggerCount((n) => n + 1);
  }, [plan]);
  // Purely visual — which interval tabs get a grouping gap before them for
  // a half-time/third-time/quarter-time break. See computeBreakBoundaries's
  // own comment: this has no effect on the plan itself, only this row.
  const breakBoundaries = computeBreakBoundaries(plan.length, breakSegments);
  // The live, clock-derived interval — still what isPastInterval (below)
  // and the plain running bar's own countdown are about. Block 11's two
  // final-60 sheets deliberately do NOT use this (see pendingIndex etc.
  // below) — they have to keep describing a transition even once the
  // clock has run past it, which `cur` itself can't do since it flips to
  // the next interval the instant elapsedSec crosses the boundary.
  const cur = plan[intervalAtElapsed(plan, elapsedSec)];
  const secLeftInInterval = cur.endMin * 60 - elapsedSec;

  // Block 11's two sheets: which pending interval each has already been
  // dismissed for (sheet 1: early tap, drag, or its own 10s auto-dismiss;
  // sheet 2: drag only — Sub done resolves it a different way, by
  // actually advancing pendingIndex past it). Compared by index, not a
  // plain boolean, so a NEW pending interval always gets a fresh showing
  // on both — explicitly not a "prepared" flag that persists or gates
  // anything else, and dismissing sheet 2 this way still leaves the
  // 30-seconds-late auto-apply (useMatchState.js) to resolve it for real.
  const [sheet1DismissedForIndex, setSheet1DismissedForIndex] = useState(null);
  const [sheet2DismissedForIndex, setSheet2DismissedForIndex] = useState(null);

  // Four mutually-exclusive match states, driving which action-bar variant
  // (and, for final60, the full-screen sheet) renders below. Order matters
  // for how these compose: match-complete is checked first (untouched by
  // this redesign), then pre-kickoff/paused (both simply !timerRunning,
  // split by whether anything has happened yet), then final60 (only
  // possible while actually running), else the plain running bar.
  const isPreKickoff = !timerRunning && elapsedSec === 0 && !isMatchComplete;
  const isPaused = !timerRunning && elapsedSec > 0 && !isMatchComplete;

  // Block 11 (the two-sheet final-60 rebuild): which interval's own
  // incoming sub is still outstanding — decoupled from `cur` above, which
  // is purely clock-derived and flips to the NEXT interval the instant
  // elapsedSec crosses its boundary. The execute sheet has to keep
  // describing THIS transition even after the clock runs past its
  // planned end ("the whistle rarely lands on the planned second"), so it
  // can't just ride along with `cur` the way the old single sheet did.
  // Skips straight past any interval that never needed a confirmation at
  // all (intervalNeedsSubConfirm false) — nothing ever blocks on those,
  // same as useMatchState's own board-advance gate.
  let pendingIndex = 0;
  while (pendingIndex < plan.length - 1 && subLog[pendingIndex] !== undefined) pendingIndex++;
  const pendingIv = plan[pendingIndex];
  const pendingNextIv = plan[pendingIndex + 1];
  const pendingGk = pendingIv.onField.find((p) => p.isGk);
  const pendingNextGk = pendingNextIv?.onField.find((p) => p.isGk);
  const pendingGkChanging = Boolean(pendingNextGk) && (!pendingGk || pendingGk.id !== pendingNextGk.id);
  const pendingChanges = computeNextChangeBadges({
    cur: pendingIv, nextIv: pendingNextIv, curGk: pendingGk, nextGk: pendingNextGk, gkChanging: pendingGkChanging,
  });
  const pendingNeedsConfirm = intervalNeedsSubConfirm(pendingIv, pendingNextIv);
  // Positive once the clock has actually reached (and beyond that,
  // negative before it) the pending interval's own scheduled end — this
  // is what the two sheets' windows are measured against, not
  // secLeftInInterval (that one tracks `cur`, which has already moved on
  // by the time we're this far past the boundary).
  const secSincePendingEnd = elapsedSec - pendingIv.endMin * 60;

  // SHEET 1 — PREPARE, -60s to -30s. Auto-dismisses after 10s (the effect
  // below) or an early tap/drag — none of which touch pendingIndex or any
  // other real state; it's purely "have I already shown/dismissed this
  // one," reset fresh for every new pending interval by comparing against
  // pendingIndex directly rather than a persistent flag (see block 11's
  // own "do not add a prepared flag").
  // !isMatchComplete is belt-and-suspenders here (same as isPreKickoff/
  // isPaused above): the real app's own tick effect always flips
  // timerRunning false the instant the match ends, but nothing about
  // these two booleans should quietly depend on that happening first.
  const showSheet1 =
    !isMatchComplete && timerRunning && pendingNeedsConfirm && secSincePendingEnd >= -60 && secSincePendingEnd < -30 &&
    sheet1DismissedForIndex !== pendingIndex;

  // SHEET 2 — EXECUTE, -30s onward. No upper bound on how late — it stays
  // up past the boundary (secSincePendingEnd goes positive) until Sub
  // done is tapped or the 30-seconds-late auto-apply (useMatchState.js)
  // resolves it, either of which advances pendingIndex and makes this
  // false again.
  const showSheet2 =
    !isMatchComplete && timerRunning && pendingNeedsConfirm && secSincePendingEnd >= -30 &&
    sheet2DismissedForIndex !== pendingIndex;

  // Whether the incoming keeper is a genuine bench arrival, or was
  // already on the pitch (an outfielder taking over the gloves with
  // nobody arriving from anywhere) — shared by the prepare sheet (only a
  // genuine arrival gets a "go stand by the goal" card at all — see
  // block 11's own "a player changing position inside the pitch does NOT
  // appear on this sheet") and the execute sheet's own gk-swap step
  // colour (arriving green vs changing blue).
  const becomingKeeperFromBench =
    pendingChanges.becomingKeeperId != null && pendingIv.bench.includes(pendingChanges.becomingKeeperId);

  // The execute sheet's numbered steps — richer than final60Rows used to
  // be (three disc colours, not two), and always describes pendingIv
  // rather than the live `cur`. See buildFinal60Steps' own comment for
  // why the keeper swap is always step 1 and the stepping-down keeper can
  // reappear later as a "takes the field" step.
  const executeSteps = buildFinal60Steps({
    comingOffIds: pendingChanges.comingOffIds,
    comingOnIds: pendingChanges.comingOnIds,
    curGkId: pendingGk?.id,
    becomingKeeperId: pendingChanges.becomingKeeperId,
    steppingDownKeeperId: pendingChanges.steppingDownKeeperId,
    becomingKeeperFromBench,
  });

  // Sheet 1's own 10-second auto-dismiss. Only (re)starts when showSheet1
  // actually flips false->true or pendingIndex genuinely changes — not on
  // every render while it's already showing (showSheet1's own boolean
  // value stays referentially the same `true` across the in-between
  // re-renders elapsedSec ticking causes, so this effect doesn't restart
  // the timer every second).
  useEffect(() => {
    if (!showSheet1) return undefined;
    const timer = setTimeout(() => setSheet1DismissedForIndex(pendingIndex), 10000);
    return () => clearTimeout(timer);
  }, [showSheet1, pendingIndex]);

  // The auto-apply toast's own copy — recomputed fresh from plan[index],
  // not from pendingChanges (which is about whatever's pending NOW, not
  // whichever past interval just auto-applied).
  const autoApplyMessage = (index) => {
    const iv = plan[index];
    const nextIvForIndex = plan[index + 1];
    if (!iv || !nextIvForIndex) return "Sub applied automatically";
    const gk = iv.onField.find((p) => p.isGk);
    const nextGkForIndex = nextIvForIndex.onField.find((p) => p.isGk);
    const gkChangingForIndex = Boolean(nextGkForIndex) && (!gk || gk.id !== nextGkForIndex.id);
    const changes = computeNextChangeBadges({
      cur: iv, nextIv: nextIvForIndex, curGk: gk, nextGk: nextGkForIndex, gkChanging: gkChangingForIndex,
    });
    const arriving = [...changes.comingOnIds, ...(changes.becomingKeeperId ? [changes.becomingKeeperId] : [])].map(nameOf);
    return arriving.length > 0 ? `Sub applied automatically: ${arriving.join(", ")} on` : "Sub applied automatically";
  };

  // Who's changing going into the NEXT interval after whichever one is
  // currently being viewed (activeInterval) — not necessarily the live one
  // above. A coach flicking ahead to check a later interval gets the same
  // "who's coming off/on" preview as watching it happen live; the board
  // already shows plan[activeInterval] regardless, so the badges now match
  // that rather than only ever reflecting the live interval.
  //
  // Three states, kept deliberately simple after an earlier per-pair-color
  // version turned out less clear in practice:
  //   - Red ↓ = leaving the pitch (whether from a regular sub or a keeper
  //     stepping down doesn't matter — either way, off).
  //   - Green ↑ = playing outfield next interval, whether arriving from the
  //     bench OR already on the pitch and just losing keeper duty ("staying
  //     on, switching to outfield" gets the exact same badge as "coming on
  //     from the bench" — same outcome, same meaning).
  //   - Gold 🧤 = becoming keeper, wherever they currently are. The one
  //     state that's genuinely distinct from a normal sub, so it's the one
  //     that gets a different badge rather than reusing red/green.
  // See computeNextChangeBadges in rotation.js for exactly how these get
  // decided — pulled out so this (fiddly, several interacting cases) logic
  // is directly unit-testable.
  // Swap/injury/bring-back all act on plan[activeInterval] (see
  // useMatchState) with no separate "live interval" concept of their own —
  // freely browsing ahead to pre-correct an upcoming interval is the whole
  // point (see the interval tabs below). But editing an interval *before*
  // the live one would rebuild everything from there forward, silently
  // overwriting intervals that already actually happened on the sideline —
  // confusing, since the app would then show a rewritten history that
  // doesn't match what was really played. Gated off here rather than in
  // useMatchState so a coach can still freely browse back to review a past
  // interval, just not edit it.
  const isPastInterval = activeInterval < cur.index;

  const viewedIv = plan[activeInterval];
  const benchEmpty = viewedIv.bench.length === 0 && injuredThisGame.length === 0;
  const viewedNextIv = plan[activeInterval + 1];
  const viewedGk = viewedIv.onField.find((p) => p.isGk);
  const viewedNextGk = viewedNextIv?.onField.find((p) => p.isGk);
  const viewedGkChanging = viewedNextGk && (!viewedGk || viewedGk.id !== viewedNextGk.id);
  const { comingOffIds, comingOnIds, becomingKeeperId, steppingDownKeeperId } = computeNextChangeBadges({
    cur: viewedIv, nextIv: viewedNextIv, curGk: viewedGk, nextGk: viewedNextGk, gkChanging: viewedGkChanging,
  });

  // Which token's tap-to-open action sheet is currently showing — purely
  // transient UI state, doesn't need to live in useMatchState the way
  // swapPickId does (that one has to survive being read by performSwap).
  // No origin/rect tracking (block 8, part C) — the sheet is always
  // pinned to bottom:0, not anchored to wherever the tap happened.
  const [menuPlayerId, setMenuPlayerId] = useState(null);
  const menuOnFieldRecord = menuPlayerId ? viewedIv.onField.find((p) => p.id === menuPlayerId) : null;
  // Real-use feedback / confirmed bug: this used to require
  // `menuOnFieldRecord &&` up front, which silently excluded every bench
  // player from ever seeing "Make keeper" regardless of eligibility — a
  // bench player only ever saw Swap + Mark injured. performSwap
  // (useMatchState.js) already handles a bench player correctly taking
  // over the keeper role (same guard, same rebuild path a bench↔field
  // swap already used) — this was purely a menu-visibility check that was
  // stricter than the thing it was gating actually needed.
  const menuCanMakeKeeper = keeperEligibleIds.includes(menuPlayerId) && !menuOnFieldRecord?.isGk;

  // The player-tap popover's "Swap player" row previews who the schedule
  // already has lined up to come on for this specific player, the same
  // way final60Rows pairs off/on lists — reusing pairChanges here (based
  // on the *viewed* interval's badges, not live) rather than a second,
  // divergent implementation. Null when this player isn't part of a
  // scheduled change this window (an off-schedule swap the coach is
  // initiating themselves), in which case the row falls back to generic
  // copy instead of guessing.
  const viewedSwapRows = pairChanges({
    comingOffIds, comingOnIds, curGkId: viewedGk?.id, becomingKeeperId,
  });
  // Only meaningful when `id` is the one *leaving* — the popover's copy is
  // hardcoded as "{partner} comes on", so a row matched on its inId side
  // would have the direction backwards. A player who isn't part of a
  // scheduled change this window (or who's only on the "coming on" side)
  // falls back to the generic copy instead, same as before.
  const swapPartnerFor = (id) => {
    const row = viewedSwapRows.find((r) => r.outId === id);
    return row ? row.inId : null;
  };

  // "12:40 played" in the player-tap sheet's header (block 8, part C) — a
  // live, elapsed-so-far figure, deliberately computed locally here rather
  // than by reaching for rotation.js's computeMinutesSummary: that function
  // was deliberately reverted to a full-game-only total (see SummaryModal.
  // jsx's own history) after live/elapsed-capped totals turned out not to
  // be wanted for the Minutes screen. This is a different, narrower need —
  // one player's on-pitch time (either role) up to right now, for a single
  // line of context in a sheet — so it stays a small local sum instead of
  // reopening that decision.
  const playedMinFor = (id) => {
    let min = 0;
    for (const iv of plan) {
      const ivStartSec = iv.startMin * 60;
      if (ivStartSec >= elapsedSec) break;
      if (!iv.onField.some((p) => p.id === id)) continue;
      const ivEndSec = Math.min(iv.endMin * 60, elapsedSec);
      min += (ivEndSec - ivStartSec) / 60;
    }
    return min;
  };

  // A brief "✓ X swapped with Y" note shown in the action sheet right after
  // a swap/make-keeper action completes — found from real use that a swap
  // could otherwise feel like it silently happened with nothing confirming
  // it, especially once the sheet's own content (the "pick a target" hint)
  // disappears the instant the second tap lands. Set optimistically at the
  // moment of the tap rather than waiting to verify against the rebuilt
  // plan — the pitch board itself is the real source of truth and updates
  // immediately either way; this is just narrating what the coach did, not
  // a correctness signal.
  const [confirmMessage, setConfirmMessage] = useState(null);
  useEffect(() => {
    if (!confirmMessage) return undefined;
    const timer = setTimeout(() => setConfirmMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [confirmMessage]);

  // Nothing on the board should be tappable while any guard holds: a past
  // interval can't be edited (see isPastInterval's own comment above),
  // and either final-60 sheet is meant to be the sole focus of that
  // moment ("everything else dims" per the design) — their own action
  // rows are the only actions available until they resolve.
  const interactionLocked = isPastInterval || showSheet1 || showSheet2;
  // Pre-kickoff shows no next-sub preview badges at all (per the design —
  // nothing's "coming up soon" in a meaningful sense before the clock has
  // even started) even though the same badge data would otherwise compute
  // fine at elapsedSec 0 same as any other moment.
  const showNextSubBadges = !isPreKickoff;

  // --- Coach-committed swap animation (motion + gold hold marker) ---
  // Only three places ever call beginSwap: trySwapComplete just below,
  // "Make keeper" (player-tap menu), and the final60 sheet's own "Sub
  // done" button — the three moments a coach commits a change themselves.
  // The clock's own auto-follow interval advance (useMatchState.js) still
  // changes occupants in a single frame with no animation at all, exactly
  // as before — nothing here touches that mechanism.
  //
  // activeSwap, when set, is the only thing that makes a token/chip
  // render twice — once fading out of its old spot, once rising into its
  // new one — for the length of the travel plus the gold hold. Shape:
  //   participants: { [playerId]: { preLoc, postLoc } }, preLoc/postLoc
  //     each "pitch" or "bench" — read by the pitch/bench render blocks
  //     below to decide each affected id's opacity/transform this frame.
  //   pitchSlotFor: { [playerId]: {topPct,leftPct,isGk} } — captured once
  //     up front so a player who's left the real onField data still has
  //     somewhere to render their fading-out (or not-yet-real arriving)
  //     pitch token.
  //   phase: "pending" — one single frame, painted with the OLD data
  //     still real and any bench arrival's pitch ghost pre-mounted
  //     invisible (and vice versa for a pitch->bench departure's ghost),
  //     so the browser has a genuine "from" value to transition away
  //     from. "active" — the swap has actually been committed (data
  //     flipped) and the CSS transitions above are what carry the motion.
  //   commit — the actual state change (onSwap, or subLog's timestamp)
  //     to run the moment phase flips from pending to active.
  const [activeSwap, setActiveSwap] = useState(null);
  const [swapAnnouncement, setSwapAnnouncement] = useState("");

  // Block 11's own aria-live text — each sheet's onMount sets this once,
  // per the spec's exact copy ("Get ready: ...", "Make the changes, N
  // steps"). Shares the same visually-hidden region pattern as
  // swapAnnouncement below rather than a second copy of it.
  const [sheetAnnouncement, setSheetAnnouncement] = useState("");

  // The 30-seconds-late auto-apply's own visible cue (AutoApplyToast) —
  // watches autoAppliedSub (useMatchState.js) the same way the fairness
  // toast watches `plan` above: comparing against the last-seen value via
  // a ref, so a genuine new auto-apply always gets a fresh reveal even if
  // the previous toast is still fading out. Undo just clears that
  // specific interval's subLog entry back out — see AutoApplyToast's own
  // comment for why that's the whole mechanism.
  const [autoApplyToast, setAutoApplyToast] = useState(null); // { key, index, at } | null
  const lastAutoAppliedRef = useRef(autoAppliedSub);
  useEffect(() => {
    if (autoAppliedSub === lastAutoAppliedRef.current) return;
    lastAutoAppliedRef.current = autoAppliedSub;
    if (!autoAppliedSub) return;
    setAutoApplyToast({ key: `${autoAppliedSub.index}-${autoAppliedSub.at}`, index: autoAppliedSub.index });
  }, [autoAppliedSub]);

  // One rAF after a swap is queued: perform the real commit and flip to
  // "active" in the same paint, so the CSS changes (from the pre-mounted
  // ghost's rest state to its real one) land together with the data
  // change — same "mount hidden, reveal a frame later" idiom
  // FairnessToastMark already uses above, just also carrying the actual
  // state commit alongside the reveal this time.
  useEffect(() => {
    if (!activeSwap || activeSwap.phase !== "pending") return undefined;
    const raf = requestAnimationFrame(() => {
      activeSwap.commit();
      setSwapAnnouncement(activeSwap.announcement);
      setActiveSwap((s) => (s && s.key === activeSwap.key ? { ...s, phase: "active" } : s));
    });
    return () => cancelAnimationFrame(raf);
  }, [activeSwap]);

  // Clears activeSwap once travel + the gold hold + the gold fade-out are
  // all genuinely done, so the ghost nodes it was keeping mounted stop
  // rendering at all rather than lingering invisibly forever. Reduced
  // motion shortens the travel only (part E) — the gold hold itself is
  // never shortened, on either path.
  useEffect(() => {
    if (!activeSwap || activeSwap.phase !== "active") return undefined;
    const travelMs = reducedMotion ? 160 : 650;
    const totalMs = travelMs + 140 + GOLD_RING_TOTAL_MS + 120; // +120 safety margin
    const timer = setTimeout(() => {
      setActiveSwap((s) => (s && s.key === activeSwap.key ? null : s));
    }, totalMs);
    return () => clearTimeout(timer);
  }, [activeSwap, reducedMotion]);

  // Turns one or more {outId, inId} pairs into the participants/pitchSlot
  // map beginSwap (and the deferred final60 path below) both need — pure,
  // reads only the CURRENT viewedIv, no state of its own. Each pair is
  // reoriented so outId always means "was on the pitch before this"
  // regardless of which token the coach tapped first, keeping the travel
  // direction (down off the pitch, up onto it) consistent. A pair that's
  // bench-on-both-sides is a genuine no-op (nothing to sub, nothing on
  // screen would move) and is skipped.
  const computeSwapPlan = (pairs) => {
    const layout = getFormationLayout(viewedIv.onField);
    const slotOf = (id) => {
      const s = layout.find((x) => x.id === id);
      return s ? { topPct: s.topPct, leftPct: s.leftPct, isGk: s.isGk } : null;
    };
    const pitchSlotFor = {};
    const participants = {};
    const announcementParts = [];
    // Every pair where the incoming side started on the bench also has
    // the outgoing side landing there (a straight bench<->pitch swap) —
    // both chips are "the bench position being handed over," so the
    // bench render groups them into one shared slot instead of two
    // separate flex items. A pure field<->field pair (Make keeper onto
    // an already-on-pitch player) never touches the bench at all and
    // never appears here.
    const benchPairs = [];
    for (const pair of pairs) {
      let { outId, inId } = pair;
      if (!outId || !inId) continue;
      let locOut = locationOf(viewedIv, outId);
      let locIn = locationOf(viewedIv, inId);
      if (locOut === "bench" && locIn === "pitch") {
        [outId, inId] = [inId, outId];
        [locOut, locIn] = [locIn, locOut];
      }
      if (locOut === "bench" && locIn === "bench") continue;
      const outSlot = locOut === "pitch" ? slotOf(outId) : null;
      const inSlot = locIn === "pitch" ? slotOf(inId) : null;
      if (outSlot) pitchSlotFor[outId] = outSlot;
      if (inSlot) pitchSlotFor[inId] = inSlot;
      if (!inSlot && outSlot) pitchSlotFor[inId] = outSlot;
      if (!outSlot && inSlot) pitchSlotFor[outId] = inSlot;
      participants[outId] = { preLoc: locOut, postLoc: locIn };
      participants[inId] = { preLoc: locIn, postLoc: locOut };
      if (locIn === "bench") benchPairs.push({ outId, inId });
      announcementParts.push(`${nameOf(inId)} on for ${nameOf(outId)}`);
    }
    return { participants, pitchSlotFor, benchPairs, announcement: announcementParts.join(". ") };
  };

  // Used by trySwapComplete and "Make keeper" — both call the real
  // onSwap themselves, so the data flip and the animation can start
  // together, one rAF after the tap (see the "pending" effect above).
  // NOT used by "Sub done" — see pendingConfirm below for why that one's
  // different. If every pair turns out to be a no-op, `commit` still
  // runs, just with no animation ahead of it.
  const beginSwap = (pairs, commit) => {
    const plan = computeSwapPlan(pairs);
    if (Object.keys(plan.participants).length === 0) {
      commit();
      return;
    }
    setActiveSwap({ ...plan, phase: "pending", key: `${Date.now()}-${Math.random()}`, commit });
  };

  // "Sub done" is different from the other two triggers: it never calls
  // onSwap at all (see confirmSubLog below — it only ever writes a
  // timestamp to subLog). The pitch/bench occupants for a scheduled sub
  // change entirely on their own, driven purely by the live clock
  // crossing the interval boundary (useMatchState's own auto-follow
  // effect, untouched by any of this) — not by this tap. Calling
  // beginSwap directly here used to animate against data that hadn't
  // actually changed yet, so the "swap" quietly reverted a few seconds
  // later and the real change, whenever the clock got to it, landed with
  // no animation at all — the bug real-use feedback caught.
  //
  // Fix: capture the plan now (who's involved, their pre-swap slots) but
  // don't animate yet — park it here and let the effect just below fire
  // the actual animation the moment activeInterval genuinely advances
  // past this interval, whichever real mechanism gets it there. That
  // keeps the clock's own logic 100% untouched while still tying the
  // animation to the coach's own tap: an advance nobody confirmed never
  // gets a pendingConfirm to consume, so it stays exactly as instant and
  // unanimated as it is today.
  const [pendingConfirm, setPendingConfirm] = useState(null);
  // shape: { forIndex, participants, pitchSlotFor, announcement }
  useEffect(() => {
    if (!pendingConfirm || activeInterval <= pendingConfirm.forIndex) return;
    setPendingConfirm(null);
    setActiveSwap({
      participants: pendingConfirm.participants,
      pitchSlotFor: pendingConfirm.pitchSlotFor,
      announcement: pendingConfirm.announcement,
      phase: "pending",
      key: `${Date.now()}-${Math.random()}`,
      commit: () => {}, // the real change already happened — the clock did it, nothing left to do
    });
  }, [activeInterval, pendingConfirm]);

  // Shared by every token everywhere (pitch, bench, injured) — mid-swap
  // (swapPickId set), any tap completes the swap with whoever was just
  // tapped; performSwap's own guards safely no-op an invalid target (e.g.
  // accidentally tapping an injured player, who by then isn't in
  // onField/bench at all), so nothing extra needs to be checked here for
  // those. Tapping the swap source again is treated as an implicit cancel
  // rather than a (meaningless) self-swap. Returns true when the tap was
  // consumed this way, so callers know not to also open their own
  // menu/popover for the same tap.
  const trySwapComplete = (id) => {
    if (!swapPickId) return false;
    if (id === swapPickId) {
      setSwapPickId(null);
      return true;
    }
    setConfirmMessage(`${nameOf(swapPickId)} swapped with ${nameOf(id)}`);
    const source = swapPickId;
    setSwapPickId(null);
    beginSwap([{ outId: source, inId: id }], () => onSwap(source, id));
    return true;
  };

  // Pitch shirts and non-injured bench chips: opens (or closes, if already
  // open) the three-action player-tap sheet. No origin/rect tracking
  // needed any more (block 8, part C) — the sheet is always pinned to
  // bottom:0, not anchored to wherever the tapped token happened to be.
  const handleTokenTap = (id) => {
    if (interactionLocked) return;
    if (trySwapComplete(id)) return;
    setMenuPlayerId((current) => (current === id ? null : id));
  };

  // Injured chips open their own dedicated two-button sheet
  // (A2i-Back-from-injury) instead — a completely different shape/content
  // from the general player-tap menu, not a variant of it, so this is a
  // separate piece of state (injuredPopoverId) rather than menuPlayerId
  // reused with an injured-specific branch.
  const [injuredPopoverId, setInjuredPopoverId] = useState(null);
  const handleInjuredChipTap = (id) => {
    if (interactionLocked) return;
    if (trySwapComplete(id)) return;
    setInjuredPopoverId((current) => (current === id ? null : id));
  };
  // Reset — restarts today's game from 0:00 on the same rotation (see
  // resetClock, useMatchState.js). Real-use feedback: a dedicated
  // action-bar button for this "looked terrible" — this is a hidden
  // gesture instead, tapping the timer display itself, no new visible UI
  // at all. Distinct from "Build new rotation" (SquadSettingsForm's own
  // submit), which rebuilds the plan itself.
  //
  // No confirm needed with nothing to lose yet (pre-kickoff, or the
  // instant right after Start with elapsedSec still at 0). Otherwise
  // opens the same shared caution-sheet shell SquadSettingsForm's own
  // rebuild-confirm uses, reusing its own RotateIcon and swipe-to-dismiss.
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const hasProgressToReset = elapsedSec > 0 || Object.keys(subLog).length > 0;
  const handleTimerTap = () => {
    if (interactionLocked) return;
    if (hasProgressToReset) setResetConfirmOpen(true);
    else onReset();
  };

  // Block 8, part C's own "LAYOUT RULE": the action bar is hidden whenever
  // the player-tap or injury sheet is open, since the sheet covers it
  // completely anyway (unlike the old anchored popovers, which left the
  // bar visible underneath them). Reset's own confirm sheet follows the
  // same rule.
  const sheetOpen = Boolean(menuPlayerId || injuredPopoverId || resetConfirmOpen);

  // Swipe-down-to-dismiss for the bottom sheets — the grab handle
  // (mdSheetGrabHandle) is a standard drag affordance, so it needs to
  // actually drag, not just look like it does. Pointer events (not touch
  // events) so this works with mouse drags too, e.g. testing on desktop.
  // setPointerCapture keeps move/up events targeted at the handle even
  // once the pointer wanders off it mid-drag. Only the handle + header
  // are draggable, not the option rows below — those need their taps to
  // keep working normally, and drag-vs-scroll disambiguation on tappable
  // content is a lot more that isn't needed here.
  const playerSheetDrag = useSheetDrag(() => setMenuPlayerId(null));
  const injurySheetDrag = useSheetDrag(() => setInjuredPopoverId(null));
  const resetSheetDrag = useSheetDrag(() => setResetConfirmOpen(false));

  const outfielders = viewedIv.onField.filter((p) => !p.isGk);
  const tokenSize = computeTokenSize(outfielders.length);
  // 3-row formations (5+ outfielders) need more vertical room than the
  // original fixed 2-row height ever had to allow for. Bumped up from the
  // original 220/280 — real-device feedback called the pitch "way too
  // squeezed vertically". Bumped again (270/340 -> 288/358) once "of 45
  // min" moved beside the timer instead of under it (see mdTimerRow),
  // freeing ~18px of header height that's spent here instead of left empty.
  // Trimmed back down (358 -> 330 -> 300) once formation.js's own 3-row
  // GK_TOP_PCT_3ROW tuning removed the dead space that height was
  // originally padding out below the goalkeeper — real-device feedback on
  // a big-roster (10-outfielder) game, wanting everything to fit closer
  // to one screen (the 330 round still left the action bar/timer cut off
  // on the actual device). Still clears the 3-row token spacing (see
  // formation.js's own comment) at every token-size tier, though tighter
  // than before — if a future headcount/token-size change ever makes rows
  // visibly crowd, this is the first number to revisit.
  const pitchInnerHeight = outfielders.length > 4 ? 300 : 288;
  // The kit-shirt SVG's own natural aspect ratio (62x58, see
  // matchDayIcons.jsx) — scaled by the same tokenSize headcount tiering
  // formation.js already provides, rather than formation.js needing to
  // know anything about shirt shapes.
  const shirtWidth = tokenSize;
  const shirtHeight = Math.round(tokenSize * (58 / 62));

  // The cog menu — same anchored-popover mechanism as the player-tap menu
  // above (a null-or-{top} origin, captured from the cog's own rect at
  // tap time). Absorbs Season/Switch-team/Account/Sign-out from the old
  // app-level header per the "full consolidation" decision.
  const [cogOrigin, setCogOrigin] = useState(null);

  // Bench tokens look and behave identically wherever they're rendered
  // (the Outfield-waiting and Keeper-waiting rows both use this) — kept
  // as one render function rather than a separate component since it
  // just closes over this render's own state/handlers, no lifecycle of
  // its own. Injured players get their own distinct chip below
  // (renderInjuredChip) — a different shape/color, not a variant of this one.
  const renderBenchToken = (id) => {
    const participant = activeSwap?.participants[id];
    const swapStyle = participant ? swapVisualStyle(participant, "bench") : null;
    // A ghost chip — this id isn't really on the bench per today's data,
    // just still (or not yet) mounted for the travel — is never a valid
    // tap target, same reasoning as the pitch ghosts above.
    const isGhost = Boolean(participant) && !viewedIv.bench.includes(id);
    return (
      // Wrapping span (not the button itself) carries position:relative,
      // purely so the gold hold marker below has something of the
      // chip's own exact size/shape to anchor against without adding
      // position to mdBenchChip generally (today's bench-chip styling —
      // shadow, hover, everything else — stays completely untouched).
      <span key={id} style={{ position: "relative", display: "inline-flex" }}>
        <button
          style={{
            ...styles.mdBenchChip,
            ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdBenchChipSwapTarget : {}),
            ...(menuPlayerId === id ? { ...styles.mdOriginLit, ...styles.mdBenchChipLit } : {}),
            ...(swapStyle ? { opacity: swapStyle.opacity, transform: swapStyle.transform, transition: swapStyle.transition } : {}),
          }}
          onClick={() => handleTokenTap(id)}
          disabled={interactionLocked || isGhost}
          aria-hidden={isGhost || undefined}
          tabIndex={isGhost ? -1 : undefined}
        >
          {/* Gold specifically when THIS bench player is who's actually coming
              on as keeper at the next interval (becomingKeeperId) — not
              keeperEligibleIds (whether they're generally allowed to play
              goal at all, a permanent roster flag most players default to).
              Real-use feedback: with eligibility defaulted on for most of a
              squad, using it here meant almost every bench chip read gold
              regardless of what was actually about to happen, misleadingly
              suggesting an outfield sub was headed for goal. */}
          <span style={{ ...styles.mdBenchChipNumber, ...(showNextSubBadges && becomingKeeperId === id ? styles.mdBenchChipNumberGk : {}) }}>
            {numberOf(id)}
          </span>
          <span style={styles.mdBenchChipName}>{nameOf(id)}</span>
          {showNextSubBadges && comingOnIds.has(id) && (
            <span style={styles.mdBenchChipUpArrow} title="Coming on next interval">
              <ArrowUp size={14} strokeWidth={3} />
            </span>
          )}
          {showNextSubBadges && becomingKeeperId === id && (
            <span title="Becoming keeper next interval">🧤</span>
          )}
        </button>
        {/* Gold hold marker, bench end (part C) — outside the chip
            entirely, following its pill shape via mdSwapGoldRingBench's
            own inset/borderRadius; the chip itself never changes. */}
        {activeSwap?.phase === "active" && participant?.postLoc === "bench" && (
          <div key={activeSwap.key} style={{ ...styles.mdSwapGoldRingBench, ...goldRingStyle() }} aria-hidden="true" />
        )}
      </span>
    );
  };

  // The shared slot for a straight bench<->pitch swap pair (see
  // benchRenderList's own comment for why this exists at all): one flex
  // item, sized to whichever of the two names is wider, with both chips
  // absolutely stacked inside it so the departing one crossfades out
  // exactly on top of the arriving one instead of sitting beside it.
  // Reuses renderBenchToken untouched for each chip — only the
  // positioning wrapper here is new.
  const renderBenchSlotPair = ({ outId, inId }) => {
    const wide = Math.max(nameOf(outId).length, nameOf(inId).length);
    return (
      <span
        key={`${outId}-${inId}`}
        style={{ position: "relative", display: "inline-block", width: Math.max(96, 60 + wide * 7), height: 42 }}
      >
        <span style={{ position: "absolute", inset: 0 }}>{renderBenchToken(outId)}</span>
        <span style={{ position: "absolute", inset: 0 }}>{renderBenchToken(inId)}</span>
      </span>
    );
  };

  // A2h-Injured's chip: tinted pink pill, red number disc, a small
  // cross badge on the corner — "the same read as an injury flag on a
  // football-game card" per the handoff, not just a recolored bench chip.
  // Opens the dedicated back-from-injury popover rather than the general
  // player-tap one (see handleInjuredChipTap above).
  const renderInjuredChip = (id) => (
    <button
      key={id}
      style={{
        ...styles.mdInjuredChip,
        ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdBenchChipSwapTarget : {}),
        ...(injuredPopoverId === id ? { ...styles.mdOriginLit, ...styles.mdInjuredChipLit } : {}),
      }}
      onClick={() => handleInjuredChipTap(id)}
      disabled={interactionLocked}
    >
      <span style={styles.mdInjuredChipNumber}>{numberOf(id)}</span>
      <span style={styles.mdInjuredChipName}>{nameOf(id)}</span>
      <span style={styles.mdInjuredCrossBadge}>
        <MedicalCross size={11} color="#fff" />
      </span>
    </button>
  );
  // Start resumes from wherever the clock is frozen; Pause freezes it at the
  // correct live value (computed from the timestamp anchor, not just
  // whatever the display last happened to show).
  const toggleTimer = () => {
    if (timerRunning) {
      const live = computeLiveElapsedSec(baseElapsedSec, runStartedAt, totalGameSec);
      setBaseElapsedSec(live);
      setElapsedSec(live);
      setRunStartedAt(null);
      setTimerRunning(false);
    } else {
      setRunStartedAt(Date.now());
      setTimerRunning(true);
    }
  };

  // Pitch tokens: today's occupants (from viewedIv.onField, as ever) plus
  // any activeSwap participant not among them — a player who's fading
  // out of a slot they just left, or whose arrival hasn't landed in the
  // real data yet (phase "pending", the pre-mounted invisible ghost —
  // see beginSwap's own comment for why that frame has to exist).
  const realPitchLayout = getFormationLayout(viewedIv.onField);
  const realPitchIds = new Set(realPitchLayout.map((s) => s.id));
  const pitchGhosts = activeSwap
    ? Object.entries(activeSwap.pitchSlotFor)
        .filter(([id]) => !realPitchIds.has(id))
        .map(([id, slot]) => ({ id, ...slot }))
    : [];
  const pitchRenderList = [...realPitchLayout, ...pitchGhosts];

  // Bench chips: today's occupants (viewedIv.bench) plus any activeSwap
  // participant who touches the bench (either side of the swap) but
  // isn't among them yet/any more — same pre-mount-then-reveal reasoning
  // as the pitch list above. A field<->field role swap (see "Make
  // keeper" onto an already-on-pitch player) never touches the bench at
  // all, so it never adds anything here.
  const realBenchSet = new Set(viewedIv.bench);
  const benchGhostIds = activeSwap
    ? Object.entries(activeSwap.participants)
        .filter(([id, p]) => !realBenchSet.has(id) && (p.preLoc === "bench" || p.postLoc === "bench"))
        .map(([id]) => id)
    : [];
  // Real-use feedback: rendering the departing and arriving halves of a
  // straight bench<->pitch swap as two ordinary flex items made the row
  // temporarily grow to fit both, and the departing chip's own upward
  // transform then visually collided with whatever else was sitting
  // where it moved to — exactly the "reflow" part A's own spec called
  // out. benchPairs (computeSwapPlan) groups each such pair so they
  // share ONE flex item below instead, stacked on top of each other —
  // the row's layout never has to make room for a second chip at all.
  const benchPairIds = new Set((activeSwap?.benchPairs || []).flatMap((p) => [p.outId, p.inId]));
  const benchRenderList = [...viewedIv.bench, ...benchGhostIds].filter((id) => !benchPairIds.has(id));

  // Rest-state opacity/transform/transition for one swap participant at
  // one location ("pitch" or "bench") this render — the CSS half of
  // parts A/B/E. Not called at all for a non-participant token, which
  // always stays plain opacity:1/transform:none/transition:none (today's
  // unaffected behaviour). `phase` decides which side of the flip we're
  // looking at: "pending" hasn't committed yet, so presence still
  // reflects where the data stands right now (pre-flip); "active" has
  // committed, so presence reflects the participant's real new location.
  const swapVisualStyle = (participant, location) => {
    const present = activeSwap.phase === "pending"
      ? participant.preLoc === location
      : participant.postLoc === location;
    const arriving = participant.postLoc === location;
    if (reducedMotion) {
      return {
        opacity: present ? 1 : 0,
        transform: "none",
        transition: "opacity 160ms ease",
      };
    }
    return {
      opacity: present ? 1 : 0,
      transform: present ? "none" : (location === "pitch" ? "translateY(168px) scale(.58)" : "translateY(-30px) scale(.82)"),
      transition: arriving
        ? "transform 560ms cubic-bezier(.3,1.34,.5,1) 90ms, opacity 250ms ease 90ms"
        : "transform 500ms cubic-bezier(.5,0,.78,.1), opacity 310ms ease 80ms",
    };
  };

  // Gold hold marker (part C): only once a swap has actually committed
  // (phase "active"), and only at whichever location a participant ends
  // up in — never at the location they left. Delay is measured from the
  // moment this ring itself mounts, which is exactly when "active" starts
  // (a fresh element per swap, via the key below) — so "140ms after
  // travel completes" is just travelMs + 140 from that same instant.
  // Reduced motion still gets the full GOLD_HOLD_MS hold — only the
  // travel it's timed against is shorter (part E).
  const goldRingStyle = () => {
    const travelMs = reducedMotion ? 160 : 650;
    // Per-keyframe timing-functions (in the @keyframes rule itself, below)
    // give the fade-in and fade-out their own independent "ease" curves —
    // this shorthand deliberately carries no timing-function of its own
    // so it can't override those.
    return { animation: `mvGoldRing ${GOLD_RING_TOTAL_MS}ms ${travelMs + 140}ms both` };
  };

  return (
    // No extra bottom padding needed here for the fixed action bar —
    // `main` (SubRotationPlanner.jsx) already reserves bottom clearance
    // for exactly this on every screen it renders.
    <section>
      <div style={styles.mdHeader}>
        <div style={styles.mdHeaderTopRow}>
          <div style={styles.mdCrestOuter}>{crestSrc && <img src={crestSrc} alt="" style={styles.mdCrestImg} />}</div>
          <div style={styles.mdTeamNameStack}>
            <div style={styles.mdTeamNameLabel}>Team</div>
            <div style={styles.mdTeamName}>{teamName}</div>
          </div>
          <button
            style={{ ...styles.mdCogBtn, ...(cogOrigin ? { ...styles.mdOriginLit, ...styles.mdCogBtnLit } : {}) }}
            onClick={(e) => {
              // Read the rect synchronously, before handing off to the
              // updater callback — by the time that runs, the synthetic
              // event's currentTarget has already been cleared.
              const top = e.currentTarget.getBoundingClientRect().bottom + 8;
              setCogOrigin((current) => (current ? null : { top }));
            }}
            title="Menu"
          >
            <GearIcon size={28} />
          </button>
        </div>
        {/* position:relative — this row's only change — anchors the
            fairness toast mark below to sit flush against this row's own
            right edge, vertically centred on the timer's own line box. */}
        <div style={{ ...styles.mdTimerRow, position: "relative" }}>
          {/* No more "Paused" text chip — the Play/Pause icon on the
              action bar's clock button already says which state it's in.
              Start/Pause/Resume lives in the action bar now, next to
              "Next sub" (README > A2-Match-actionbar > Action bar) — not
              here; an earlier round of real-device feedback had moved it
              up to this row instead, since reverted per an updated README. */}
          {/* A hidden gesture, not a visible control — tapping this opens
              the reset confirm (see handleTimerTap above). No visual
              affordance is added on purpose (real-use feedback: a
              dedicated action-bar Reset button "looked terrible") — a
              <button> only so it's a real, focusable/keyboard-operable
              tap target, styled to look identical to the plain <span> it
              replaced. */}
          <button
            style={{
              ...styles.mdTimerDisplay, ...(isPaused ? styles.mdTimerDisplayPaused : {}),
              // No font:"inherit" here — that's the CSS shorthand for
              // family/size/weight/style/line-height all at once, so
              // adding it *after* the mdTimerDisplay spread above silently
              // wiped out its own fontSize:66/Baloo 2/800 weight in favor
              // of whatever this button inherited from its parent (a much
              // smaller body-text size) — real-device feedback: the timer
              // rendered "super tiny". mdTimerDisplay already sets every
              // font property this needs explicitly, so there's nothing
              // left for a button's own default font to leak through.
              border: "none", background: "transparent", padding: 0, cursor: "pointer", userSelect: "none",
            }}
            onClick={handleTimerTap}
          >
            {fmtClock(elapsedSec)}
          </button>
          <span style={styles.mdTimerCaption}>of {Math.round(totalGameSec / 60)} min</span>

          {/* key={toastTriggerCount}: forces a brand-new instance on
              every fresh trigger (rather than reusing one across
              triggers), so a second change landing while the first toast
              is still fading still gets its own full enter transition and
              its own aria-live announcement, instead of silently no-op'ing
              because the underlying visibility flag was already "shown". */}
          {toastTriggerCount > 0 && <FairnessToastMark key={toastTriggerCount} spreadMin={spreadMin} intervalLen={intervalLen} />}
        </div>
      </div>
      {/* Reclaimed header height (caption moved beside the timer instead of
          under it) is spent on a taller pitch below, not left as empty
          space — see pitchInnerHeight. */}

      {isMatchComplete && (
        // The clear next step once a match ends — same underlying flow as
        // the cog menu's settings entry (opens the same settings form to
        // change squad/settings and regenerate), just surfaced as its own
        // obvious call-to-action right when it becomes relevant. Full-time
        // itself isn't part of this redesign yet (see the handoff's "not
        // yet designed" list) — this banner keeps its pre-redesign look,
        // aside from the confetti burst (backlog #4) layered over it.
        <div style={{ position: "relative" }}>
          <div style={styles.matchCompleteBanner}>
            <span>🏁 Match complete</span>
            <button style={styles.confirmBtn} onClick={onShowSettings}>
              Start new game
            </button>
          </div>
          {confettiPieces.length > 0 && (
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none", zIndex: 5 }}>
              {confettiPieces.map((p) => (
                <div
                  key={p.id}
                  style={{
                    position: "absolute", left: `${p.left}%`, top: 0,
                    width: p.isCircle ? 8 : 7, height: p.isCircle ? 8 : 12,
                    borderRadius: p.isCircle ? "50%" : 2,
                    background: p.color,
                    "--mv-confetti-drift": `${p.drift}px`,
                    "--mv-confetti-spin": `${p.spin}deg`,
                    animation: `mvConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {confettiPieces.length > 0 && (
        <style>{`
          @keyframes mvConfettiFall {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translate(var(--mv-confetti-drift), 300px) rotate(var(--mv-confetti-spin)); opacity: 0; }
          }
        `}</style>
      )}

      {/* Swap-animation gold hold marker (part C): fade in over
          GOLD_FADE_IN_MS, hold at full opacity for GOLD_HOLD_MS, fade out
          over GOLD_FADE_OUT_MS — as one keyframe animation (see
          goldRingStyle above) so its own animation-delay does all the
          "140ms after travel completes" timing, rather than a
          setTimeout-driven opacity toggle. The two per-keyframe timing-
          functions below keep the fade-in and fade-out each on their own
          independent "ease" curve instead of one "ease" stretched flat
          across the whole GOLD_RING_TOTAL_MS. Percentages computed from
          the same constants goldRingStyle uses, so the two can't drift
          out of sync if GOLD_HOLD_MS gets tuned again. */}
      {activeSwap && (
        <style>{`
          @keyframes mvGoldRing {
            0% { opacity: 0; animation-timing-function: ease; }
            ${(GOLD_FADE_IN_MS / GOLD_RING_TOTAL_MS * 100).toFixed(4)}% { opacity: 1; animation-timing-function: linear; }
            ${((GOLD_FADE_IN_MS + GOLD_HOLD_MS) / GOLD_RING_TOTAL_MS * 100).toFixed(4)}% { opacity: 1; animation-timing-function: ease; }
            100% { opacity: 0; }
          }
        `}</style>
      )}

      <div style={styles.intervalTabsWrap}>
        <div style={styles.intervalTabs}>
          {plan.map((iv) => (
            <button
              key={iv.index}
              onClick={() => setActiveInterval(iv.index)}
              style={{
                ...styles.intervalTab,
                ...(activeInterval === iv.index ? styles.intervalTabActive : {}),
                ...(breakBoundaries.has(iv.index) ? styles.intervalTabBreakStart : {}),
              }}
              title={breakBoundaries.has(iv.index) ? "Break" : undefined}
            >
              {iv.startMin}–{iv.endMin}′
            </button>
          ))}
        </div>
      </div>

      {isPastInterval && (
        <div style={styles.swapBanner}>Interval Complete. Navigate to the active Interval for live updates.</div>
      )}
      <div style={{ ...styles.pitchInner, height: pitchInnerHeight }}>
        <PitchMarkings height={pitchInnerHeight} />
        {pitchRenderList.map(({ id, isGk, topPct, leftPct }) => {
          const participant = activeSwap?.participants[id];
          const swapStyle = participant ? swapVisualStyle(participant, "pitch") : null;
          // A swap ghost (this id isn't really on the pitch this render,
          // per today's actual data) must never be tappable — it's
          // purely the outgoing/incoming visual, not a real occupant.
          const isGhost = !realPitchIds.has(id);
          return (
            <div key={id} style={{ ...styles.formationToken, top: `${topPct}%`, left: `${leftPct}%` }}>
              {/* Real-use feedback: the swap fade/travel used to be applied
                  to the shirt button alone — the name label below it (a
                  sibling, not a button descendant) stayed at opacity 1 the
                  whole time, so an outgoing and incoming player's names
                  sat fully visible on top of each other for the entire
                  hold, not just the brief crossfade. This wrapper carries
                  the shirt+name together now, so the name fades and
                  travels in lockstep with the shirt instead of being left
                  behind. formationToken's own flex/gap above still just
                  centers this one child — unaffected otherwise. */}
              <div
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  ...(swapStyle ? { opacity: swapStyle.opacity, transform: swapStyle.transform, transition: swapStyle.transition } : {}),
                }}
              >
                <button
                  style={{
                    ...styles.mdShirtBtn,
                    ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdShirtBtnSwapTarget : {}),
                    ...(menuPlayerId === id ? { ...styles.mdOriginLit, ...styles.mdShirtBtnLit } : {}),
                  }}
                  onClick={() => handleTokenTap(id)}
                  disabled={interactionLocked || isGhost}
                  aria-hidden={isGhost || undefined}
                  tabIndex={isGhost ? -1 : undefined}
                >
                  <div style={{ position: "relative", width: shirtWidth, height: shirtHeight }}>
                    <KitShirt width={shirtWidth} height={shirtHeight} isGk={isGk} />
                    <span
                      style={{
                        ...styles.mdShirtNumber,
                        top: Math.round(shirtHeight * (24 / 58)),
                        fontSize: Math.round(shirtWidth * (24 / 62)),
                      }}
                    >
                      {numberOf(id)}
                    </span>
                    {showNextSubBadges && comingOffIds.has(id) && (
                      <span style={styles.mdOutgoingBadge} title="Coming off next interval">
                        <ArrowDown size={11} strokeWidth={3.5} color="#fff" />
                      </span>
                    )}
                    {showNextSubBadges && becomingKeeperId === id && (
                      <span style={styles.nextKeeperBadge} title="Becoming keeper next interval">
                        🧤
                      </span>
                    )}
                    {showNextSubBadges && steppingDownKeeperId === id && (
                      <span style={styles.nextOnBadge} title="Staying on, switching to outfield next interval">
                        <ArrowUp size={11} strokeWidth={3.5} />
                      </span>
                    )}
                    {/* Gold hold marker, pitch end (part C) — a separate
                        element outside the shirt SVG, never altering it. */}
                    {activeSwap?.phase === "active" && participant?.postLoc === "pitch" && (
                      <div key={activeSwap.key} style={{ ...styles.mdSwapGoldRingPitch, ...goldRingStyle() }} aria-hidden="true" />
                    )}
                  </div>
                </button>
                <span style={styles.mdShirtPlayerName}>{nameOf(id)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-use feedback: the empty-bench message read as misaligned
          against "BENCH". mdBenchStrip's own alignItems:"flex-start" (and
          mdBenchLabel's own paddingTop:5) are tuned for the chip-row case
          below — that padding compensates for the label sitting beside a
          much taller row of number-disc chips, pinning it to their first
          line. Neither reason applies to a plain one-line text message of
          a similar size to the label itself, so this case gets its own
          treatment instead of inheriting numbers tuned for a different
          row: centred alignment, and the label's own padding zeroed out
          rather than reused. */}
      {/* benchEmpty (not benchRenderList) drives the "Full squad on
          field" copy and centring — a swap-animation ghost chip mid-swap
          (e.g. the bench's only player becoming keeper) shouldn't flip
          this to the empty-state message just because the real bench
          count hit zero for a moment; benchRenderList still has that
          ghost in it below regardless of which branch renders. */}
      <div style={{ ...styles.mdBenchStrip, alignItems: benchEmpty ? "center" : "flex-start" }}>
        <div style={{ ...styles.mdBenchLabel, ...(benchEmpty ? { paddingTop: 0 } : {}) }}>BENCH</div>
        {benchEmpty && benchRenderList.length === 0 && (activeSwap?.benchPairs || []).length === 0 ? (
          <span style={styles.mdBenchEmpty}>Full squad on field</span>
        ) : (
          // Block 8, part D: one row, two zones — available players first
          // (where the coach looks first), then a divider, then anyone
          // injured, rather than a separate "Injured" sub-label and second
          // row. renderInjuredChip's own pink tint + cross badge already
          // reads as "injured" without a text label repeating it.
          <div style={styles.mdBenchChipRow}>
            {benchRenderList.map(renderBenchToken)}
            {(activeSwap?.benchPairs || []).map(renderBenchSlotPair)}
            {(benchRenderList.length > 0 || (activeSwap?.benchPairs || []).length > 0) && injuredThisGame.length > 0 && <div style={styles.mdBenchDivider} />}
            {injuredThisGame.map(renderInjuredChip)}
          </div>
        )}
      </div>

      {/* Swap-picking hint and the post-action confirmation toast keep
          their existing fixed-bottom treatment — neither is one of the
          two anchored popovers this step covers (there's no reference
          design screen for "mid-swap, picking a target"), so both stay
          exactly as they were. */}
      {!interactionLocked && (confirmMessage || swapPickId) && (
        <div style={styles.actionSheet}>
          {confirmMessage ? (
            <div style={styles.actionSheetConfirm}>✓ {confirmMessage}</div>
          ) : (
            <div style={styles.actionSheetSwapRow}>
              Tap another player to swap with <strong>{nameOf(swapPickId)}</strong>
              <button style={styles.swapCancelBtn} onClick={() => setSwapPickId(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {!interactionLocked && menuPlayerId && (
        // Block 8, part C — A2g-Player-tap as a bottom sheet, not an
        // anchored popover: pinned to the true bottom of the screen
        // (mdSheet), so it can never get pushed out of view the way the
        // old tap-anchored version could for a player low on the pitch.
        // Dismissed by tapping the scrim, the token again (handleTokenTap's
        // own toggle), or any action inside it. The tapped token itself
        // stays lit above the scrim (mdShirtBtnLit/mdBenchChipLit,
        // zIndex 47) — that's what tells the coach who this is about, and
        // the name in the sheet's own header confirms it.
        <>
          <div
            style={styles.mdScrim}
            data-testid="scrim"
            onClick={() => setMenuPlayerId(null)}
          />
          <div
            style={{ ...styles.mdSheet, ...styles.mdSheetPlayerTap, ...playerSheetDrag.dragStyle }}
            data-testid="player-popover"
          >
            <div {...playerSheetDrag.dragHandleProps}>
              <div style={styles.mdSheetGrabHandle} />
              <div style={styles.mdPlayerPopoverHeader}>
                <div style={styles.mdPlayerPopoverHeaderShirt}>
                  <KitShirt width={40} height={38} isGk={Boolean(menuOnFieldRecord?.isGk)} />
                  <span style={{ ...styles.mdShirtNumber, top: 15, fontSize: 16 }}>{numberOf(menuPlayerId)}</span>
                </div>
                <div style={styles.mdPlayerPopoverName}>{nameOf(menuPlayerId)}</div>
                <div style={styles.mdPlayerPopoverMeta}>{fmtClock(Math.round(playedMinFor(menuPlayerId) * 60))} played</div>
              </div>
            </div>
            <button
              style={styles.mdPlayerPopoverRow}
              onClick={() => {
                setSwapPickId(menuPlayerId);
                setMenuPlayerId(null);
              }}
            >
              <span style={{ ...styles.mdPlayerPopoverIconTile, ...styles.mdTintGreen }}>
                <ArrowLeftRight size={16} color={tokens.color.pitchGreen} />
              </span>
              <div>
                <div style={styles.mdPlayerPopoverRowLabel}>Swap player</div>
                <div style={styles.mdPlayerPopoverRowConsequence}>
                  {swapPartnerFor(menuPlayerId)
                    ? `${nameOf(swapPartnerFor(menuPlayerId))} comes on`
                    : "Tap another player to swap with them"}
                </div>
              </div>
            </button>
            {menuCanMakeKeeper && (
              <button
                style={styles.mdPlayerPopoverRow}
                onClick={() => {
                  setConfirmMessage(`${nameOf(menuPlayerId)} is now keeper`);
                  const target = menuPlayerId;
                  const gkId = viewedGk.id;
                  setMenuPlayerId(null);
                  beginSwap([{ outId: gkId, inId: target }], () => onSwap(target, gkId));
                }}
              >
                <span style={{ ...styles.mdPlayerPopoverIconTile, ...styles.mdTintYellow }}>🧤</span>
                <div>
                  <div style={styles.mdPlayerPopoverRowLabel}>Make keeper</div>
                  <div style={styles.mdPlayerPopoverRowConsequence}>{nameOf(viewedGk.id)} moves out</div>
                </div>
              </button>
            )}
            <button
              style={styles.mdPlayerPopoverRow}
              onClick={() => {
                onInjury(menuPlayerId);
                setMenuPlayerId(null);
              }}
            >
              <span style={{ ...styles.mdPlayerPopoverIconTile, ...styles.mdTintRed }}>
                <MedicalCross size={16} color={tokens.color.injuryRed} />
              </span>
              <div>
                <div style={styles.mdPlayerPopoverRowLabel}>Mark injured</div>
                <div style={styles.mdPlayerPopoverRowConsequence}>Off, stops counting toward minutes</div>
              </div>
            </button>
          </div>
        </>
      )}

      {!interactionLocked && injuredPopoverId && (
        // Block 8, part C — A2i-Back-from-injury as the same bottom-sheet
        // shell, injury-red instead of yellow. injuredAt may be missing for
        // a game resumed from before this session's own tracking existed —
        // falls back to just "Not counting minutes" rather than showing a
        // broken time. The injured chip itself stays lit above the scrim
        // (mdInjuredChipLit) — the element being acted on, same as the
        // player-tap sheet's own shirt.
        <>
          <div
            style={styles.mdScrim}
            data-testid="scrim"
            onClick={() => setInjuredPopoverId(null)}
          />
          <div
            style={{ ...styles.mdSheet, ...styles.mdSheetInjury, ...injurySheetDrag.dragStyle }}
            data-testid="back-popover"
          >
            <div {...injurySheetDrag.dragHandleProps}>
              <div style={styles.mdSheetGrabHandle} />
              <div style={styles.mdBackPopoverHeader}>
                <span style={styles.mdBackPopoverCrossBadge}>
                  <MedicalCross size={20} color="#fff" />
                </span>
                <div>
                  <div style={styles.mdBackPopoverName}>{nameOf(injuredPopoverId)} is out</div>
                  <div style={styles.mdBackPopoverMeta}>
                    {injuredAt[injuredPopoverId] !== undefined
                      ? `Off at ${fmtClock(injuredAt[injuredPopoverId])} · not counting minutes`
                      : "Not counting minutes"}
                  </div>
                </div>
              </div>
            </div>
            <div style={styles.mdBackPopoverBtnRow}>
              <button
                style={styles.mdBackPopoverBtnPrimary}
                onClick={() => {
                  onBringBack(injuredPopoverId);
                  setInjuredPopoverId(null);
                }}
              >
                Back to bench
              </button>
              <button style={styles.mdBackPopoverBtnSecondary} onClick={() => setInjuredPopoverId(null)}>
                Still out
              </button>
            </div>
          </div>
        </>
      )}

      {/* "Sub done" always does the same single confirmSubLog action
          regardless of timing or which of these three bars it's tapped
          from — the old early-vs-in-warning-window "Sub made early"/"Sub
          made" distinction was cosmetic only (nothing downstream reads
          which one fired, only whether cur.index has *any*
          confirmation), so one shared action across all three isn't a
          behavior change. */}
      {/* README > A2-Match-actionbar > Action bar: one line, countdown on
          the left, a single clock button on the right whose label follows
          the clock (Start / Pause / Resume) — no full-width button row
          beneath, and no "Sub done" anywhere in this bar. Confirmed
          explicitly: sub confirmation happens only in the final-60 sheet
          below, which already names who's coming off/on with room to
          spare — this bar no longer offers an early-confirm shortcut. */}
      {autoApplyToast && !isMatchComplete && (
        <AutoApplyToast
          key={autoApplyToast.key}
          message={autoApplyMessage(autoApplyToast.index)}
          onUndo={() => {
            const idx = autoApplyToast.index;
            setSubLog((prev) => {
              const next = { ...prev };
              delete next[idx];
              return next;
            });
            setAutoApplyToast(null);
          }}
        />
      )}

      {isPreKickoff && !sheetOpen && (
        // Used to keep its own distinct shape — a status line, then ONE
        // full-width "Start match" button (README > A2e-Prekickoff's own
        // spec) — taller and visually different from every other state's
        // bar. Real-device feedback: wanted this to read as "the same
        // element" as the running/paused bar, not a bigger, different-
        // looking one just for this state — same mdActionBarInlineRow +
        // mdActionBarClockBtn shape and size as Resume/Pause below,
        // deliberately deviating from the README here.
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Ready to go</span>
              <button
                style={{ ...styles.mdActionBarClockBtn, ...styles.mdActionBarClockBtnPrimary }}
                onClick={toggleTimer}
              >
                <Play size={17} color={tokens.color.deepGreen} fill={tokens.color.deepGreen} /> Start match
              </button>
            </div>
          </div>
        </div>
      )}

      {isPaused && !sheetOpen && (
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Clock stopped</span>
              <button
                style={{ ...styles.mdActionBarClockBtn, ...styles.mdActionBarClockBtnPrimary }}
                onClick={toggleTimer}
              >
                <Play size={17} color={tokens.color.deepGreen} fill={tokens.color.deepGreen} /> Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {!isMatchComplete && !isPreKickoff && !isPaused && !showSheet1 && !showSheet2 && !sheetOpen && (
        // The plain "running" bar. Mutually exclusive with both final-60
        // sheets below (never rendered at the same time) — they'd
        // otherwise show the exact same "Next sub" countdown twice at
        // once, which is redundant even with one of the two dimmed behind
        // a scrim.
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Next sub {fmtClock(Math.max(0, secLeftInInterval))}</span>
              <button
                style={{ ...styles.mdActionBarClockBtn, ...styles.mdActionBarClockBtnRunning }}
                onClick={toggleTimer}
              >
                <Pause size={17} color={tokens.color.deepGreen} fill={tokens.color.deepGreen} /> Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block 11: the final-60 takeover from here down replaces the old
          single full-screen sheet with two, fixed to the viewport bottom
          same as every other bottom sheet in this file (see
          mdFinal60Shell's own comment for why — a real in-flow version
          landed below the fold on a real device). mdScrim dims the
          pitch/bench, which stay fully visible above the sheet, not
          replaced by it. keeperFromBench decides whether the prepare
          sheet's emphasised card shows at all — a keeper change that's
          really just an already-on-pitch role swap (no genuine bench
          arrival) has nothing to prepare, so no card, same as how someone
          only changing position never gets one either. */}
      {(showSheet1 || showSheet2) && (
        <div style={styles.mdScrim} data-testid="scrim" />
      )}
      {showSheet1 && (
        <PrepareSheet
          key={pendingIndex}
          pendingChanges={pendingChanges}
          keeperFromBench={becomingKeeperFromBench}
          nameOf={nameOf}
          numberOf={numberOf}
          toggleTimer={toggleTimer}
          onReady={() => setSheet1DismissedForIndex(pendingIndex)}
          onMount={() =>
            setSheetAnnouncement(
              `Get ready: ${[
                becomingKeeperFromBench ? `${nameOf(pendingChanges.becomingKeeperId)} to the goal` : null,
                pendingChanges.comingOnIds.size > 0
                  ? `${[...pendingChanges.comingOnIds].map(nameOf).join(", ")} at halfway`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}`
            )
          }
        />
      )}
      {showSheet2 && (
        <ExecuteSheet
          key={pendingIndex}
          steps={executeSteps}
          nameOf={nameOf}
          numberOf={numberOf}
          toggleTimer={toggleTimer}
          onDismiss={() => setSheet2DismissedForIndex(pendingIndex)}
          onMount={() => setSheetAnnouncement(`Make the changes, ${executeSteps.length} steps`)}
          onSubDone={() => {
            const confirmIndex = pendingIndex;
            const confirmSec = elapsedSec;
            setSubLog((prev) => ({ ...prev, [confirmIndex]: confirmSec }));
            // See pendingConfirm's own comment above: this doesn't
            // animate anything itself — it just registers that whenever
            // the clock's own auto-follow effect actually advances the
            // board past this interval, that specific advance should
            // carry the animation.
            const pairs = executeSteps.filter((s) => s.outId && s.inId).map((s) => ({ outId: s.outId, inId: s.inId }));
            const plan = computeSwapPlan(pairs);
            if (Object.keys(plan.participants).length > 0) {
              setPendingConfirm({ forIndex: confirmIndex, ...plan });
            }
          }}
        />
      )}

      {resetConfirmOpen && (
        // Same shared caution-sheet shell as SquadSettingsForm's own
        // "rebuild rotation" confirm (styles.js has the full story on why
        // it's shared) — grab handle, scrim-dismiss, swipe-to-dismiss, the
        // same RotateIcon in its header badge. Different copy: this one is
        // explicit that minutes *aren't* kept, the opposite of the rebuild
        // sheet's own reassurance, since resetting genuinely does rewind
        // the clock and sub log — only the rotation plan itself survives.
        <>
          <div style={styles.mdCautionSheetScrim} onClick={() => setResetConfirmOpen(false)} />
          <div style={{ ...styles.mdCautionSheet, ...resetSheetDrag.dragStyle }} data-testid="reset-confirm-sheet">
            <div {...resetSheetDrag.dragHandleProps}>
              <div style={styles.mdSheetGrabHandle} />
              <div style={styles.mdCautionSheetHeaderRow}>
                <span style={styles.mdCautionSheetIconBadge}>
                  <RotateIcon />
                </span>
                <div style={styles.mdCautionSheetTitle}>Restart this game?</div>
              </div>
            </div>
            <div style={styles.mdCautionSheetBody}>
              The clock and sub log go back to 0:00 — the {fmtClock(elapsedSec)} played so far won't be kept. Today's
              rotation stays exactly as it is; this doesn't build a new one.
            </div>
            <div style={styles.mdCautionSheetBtnRow}>
              <button
                style={styles.mdCautionSheetBtnPrimary}
                onClick={() => {
                  setResetConfirmOpen(false);
                  onReset();
                }}
              >
                Reset
              </button>
              <button style={styles.mdCautionSheetBtnSecondary} onClick={() => setResetConfirmOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {cogOrigin && (
        // A2d-Menu-trimmed (#10a): no group headers — "holding only what a
        // coach touches during a game." Manage squad, Switch team, Account,
        // and Sign out all moved to Team & account (#10e), reached through
        // the last row here — Season Minutes moved back out of there and
        // in here instead (real-use feedback, paired directly under
        // Today's Minutes). Reset
        // is a hidden gesture now (tap the timer display, see
        // handleTimerTap above) rather than any kind of menu row — real-
        // use feedback found a dedicated visible control for it "looked
        // terrible". Grows from the cog (cogOrigin.top, captured when it
        // was tapped), dismissed by tapping the scrim, the cog again, or
        // any row inside it.
        <>
          <div style={styles.mdScrim} data-testid="scrim" onClick={() => setCogOrigin(null)} />
          <div style={{ ...styles.mdPopover, top: cogOrigin.top }} data-testid="cog-popover">
            <button
              style={styles.mdCogMenuRow}
              onClick={() => {
                setCogOrigin(null);
                onShowSummary();
              }}
            >
              {/* "Minutes so far" + a live elapsed-time value (fmtClock
                  (elapsedSec)) were both leftover from before this screen's
                  own reversion back to a full-game projection (see
                  SummaryModal.jsx's own header comment) — "so far" hasn't
                  described what it opens for a while, and the elapsed-time
                  chip was never actually a preview of that screen's content
                  in the first place. Real-use feedback caught both.
                  "Today's Minutes" (not bare "Minutes") — real-use
                  feedback, once Season Minutes sat right below it the two
                  needed to read as clearly distinct at a glance. */}
              <span style={{ ...styles.mdCogMenuIconTile, ...styles.mdTintYellow }}>
                <BarChart2 size={16} color={tokens.color.deepGreen} />
              </span>
              <span style={styles.mdCogMenuLabel}>Today's Minutes</span>
              <span style={styles.mdCogMenuChevron}>›</span>
            </button>
            <button
              style={styles.mdCogMenuRow}
              onClick={() => {
                setCogOrigin(null);
                onShowSeason();
              }}
            >
              {/* Real-use feedback: moved out of Team & account entirely
                  (not just linked here too) — "take Season Minutes out of
                  the Team & Account menu and put it below Minutes Today in
                  the main menu." Same yellow tint as Today's Minutes right
                  above it — the two are a deliberate pair, distinguished by
                  icon (History, not BarChart2) rather than color. */}
              <span style={{ ...styles.mdCogMenuIconTile, ...styles.mdTintYellow }}>
                <History size={16} color={tokens.color.deepGreen} />
              </span>
              <span style={styles.mdCogMenuLabel}>Season Minutes</span>
              <span style={styles.mdCogMenuChevron}>›</span>
            </button>
            <button
              style={styles.mdCogMenuRow}
              onClick={() => {
                setCogOrigin(null);
                onShowSquadChange();
              }}
            >
              <span style={{ ...styles.mdCogMenuIconTile, ...styles.mdTintGreen }}>
                <ArrowLeftRight size={16} color={tokens.color.pitchGreen} />
              </span>
              {/* "Who's here" — matches the screen's own header title
                  exactly (SquadChangeScreen.jsx), same consistency fix as
                  Minutes/Game settings. Was "Squad change" here while the
                  screen itself already said "Who's here?". */}
              <span style={styles.mdCogMenuLabel}>Who's here</span>
              {availableCount != null && <span style={styles.mdCogMenuValue}>{availableCount} in</span>}
              <span style={styles.mdCogMenuChevron}>›</span>
            </button>
            <button
              style={styles.mdCogMenuRow}
              onClick={() => {
                setCogOrigin(null);
                onShowSettings();
              }}
            >
              <span style={{ ...styles.mdCogMenuIconTile, ...styles.mdTintNeutral }}>
                <GearIcon size={16} />
              </span>
              <span style={styles.mdCogMenuLabel}>Game settings</span>
              {gameSettingsSummary && <span style={styles.mdCogMenuValue}>{gameSettingsSummary}</span>}
              <span style={styles.mdCogMenuChevron}>›</span>
            </button>

            <div style={styles.mdCogMenuDivider} />

            <button
              style={styles.mdCogMenuRow}
              onClick={() => {
                setCogOrigin(null);
                onShowTeamSwitcher();
              }}
            >
              <span style={styles.mdCogMenuCrestIcon}>{crestSrc && <img src={crestSrc} alt="" style={styles.mdCogMenuCrestImg} />}</span>
              <span style={styles.mdCogMenuLabel}>Team &amp; account</span>
              <span style={styles.mdCogMenuValue}>{teamName}</span>
              <span style={styles.mdCogMenuChevron}>›</span>
            </button>

            <div style={styles.mdPopoverFooter}>
              Bench Buddy <span style={styles.mdPopoverFooterVersion}>v0.1.0</span>
            </div>
          </div>
        </>
      )}

      {/* Part D: announces a coach-committed swap once, on commit (see
          beginSwap's own rAF effect — swapAnnouncement is set at the same
          moment the real state change fires, not once the animation
          finishes). Visually hidden via the standard clip-based
          technique, same as FairnessToastMark's own hidden span above —
          nothing new drawn on screen, just present in the a11y tree. */}
      <div
        aria-live="polite"
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        {swapAnnouncement}
      </div>

      {/* Block 11: each final-60 sheet announces itself once, on mount
          (see PrepareSheet/ExecuteSheet's own onMount) — same
          visually-hidden pattern as swapAnnouncement just above, kept as
          its own region rather than sharing one so a sheet opening right
          after a swap doesn't have its announcement silently dropped for
          repeating the same text a screen reader would otherwise
          de-duplicate. */}
      <div
        aria-live="polite"
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        {sheetAnnouncement}
      </div>
    </section>
  );
}
