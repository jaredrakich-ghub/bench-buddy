import { useState, useEffect } from "react";
import { Play, Pause, BarChart2, History, ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { intervalAtElapsed, computeNextChangeBadges, computeBreakBoundaries, pairChanges } from "../lib/rotation.js";
import { computeLiveElapsedSec, fmtClock } from "../lib/clock.js";
import { getFormationLayout, computeTokenSize } from "../lib/formation.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { styles, tokens } from "./styles.js";
import { GearIcon, KitShirt, MedicalCross } from "./matchDayIcons.jsx";
import { RotateIcon } from "./strokeIcons.jsx";

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
  swapPickId,
  setSwapPickId,
  injuredThisGame,
  injuredAt,
  keeperEligibleIds,
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
  onShowSettings,
  onShowSquadChange,
  onShowTeamSwitcher,
}) {
  const totalGameSec = plan[plan.length - 1].endMin * 60;
  const isMatchComplete = elapsedSec >= totalGameSec;
  // Purely visual — which interval tabs get a grouping gap before them for
  // a half-time/third-time/quarter-time break. See computeBreakBoundaries's
  // own comment: this has no effect on the plan itself, only this row.
  const breakBoundaries = computeBreakBoundaries(plan.length, breakSegments);
  const cur = plan[intervalAtElapsed(plan, elapsedSec)];
  const secLeftInInterval = cur.endMin * 60 - elapsedSec;
  const nextIv = plan[cur.index + 1];
  const curGk = cur.onField.find((p) => p.isGk);
  const nextGk = nextIv?.onField.find((p) => p.isGk);
  const gkChanging = nextGk && (!curGk || curGk.id !== nextGk.id);
  // Who's actually changing at the real, live upcoming transition — always
  // tied to elapsedSec, never to whatever interval the coach happens to be
  // browsing (see viewedIv/viewedGk etc. below, which is the separate
  // "what am I looking at" version used for the pitch board's badges). The
  // warning box needs the live one specifically: it's telling the coach
  // what to physically do right now, so it can't follow them if they've
  // tapped ahead to check a later interval.
  const liveChanges = computeNextChangeBadges({ cur, nextIv, curGk, nextGk, gkChanging });

  // Four mutually-exclusive match states, driving which action-bar variant
  // (and, for final60, the full-screen sheet) renders below. Order matters
  // for how these compose: match-complete is checked first (untouched by
  // this redesign), then pre-kickoff/paused (both simply !timerRunning,
  // split by whether anything has happened yet), then final60 (only
  // possible while actually running), else the plain running bar.
  const isPreKickoff = !timerRunning && elapsedSec === 0 && !isMatchComplete;
  const isPaused = !timerRunning && elapsedSec > 0 && !isMatchComplete;
  // Same "is there actually anything to confirm this window" guard the old
  // inline warning box used — a bench-less squad with no keeper handover
  // has nothing to sub, so the last-60s takeover shouldn't fire for it.
  const noBenchToRotate = cur.bench.length === 0;
  const hasSomethingToConfirm = nextIv && (!noBenchToRotate || gkChanging);
  // subLog[cur.index] being set — from either the running bar's always-on
  // "Sub done" or the final60 sheet's own copy of that same button — means
  // this interval's sub is already handled, so the takeover shouldn't
  // reappear for it even if elapsedSec is still inside the last-60s window.
  const confirmedAt = subLog[cur.index];
  const inFinal60 = timerRunning && hasSomethingToConfirm && secLeftInInterval <= 60 && confirmedAt === undefined;

  // The final60 sheet pairs each outgoing player with whoever's arriving,
  // purely for a readable "X -> Y" line — see pairChanges (rotation.js)
  // for exactly how, and for the real case it can't cleanly pair (the
  // outgoing keeper stepping down to outfield instead of leaving, while
  // the incoming keeper is a genuine bench arrival) — that row renders
  // with an explanatory line instead of a bare, unexplained chip.
  const final60Rows = pairChanges({
    comingOffIds: liveChanges.comingOffIds,
    comingOnIds: liveChanges.comingOnIds,
    curGkId: curGk?.id,
    becomingKeeperId: liveChanges.becomingKeeperId,
  });

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
  const menuCanMakeKeeper = menuOnFieldRecord && !menuOnFieldRecord.isGk && keeperEligibleIds.includes(menuPlayerId);

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

  // Nothing on the board should be tappable while either guard holds: a
  // past interval can't be edited (see isPastInterval's own comment
  // above), and the final60 sheet is meant to be the sole focus of that
  // moment ("everything else dims" per the design) — its own Sub done
  // button is the only action available until it resolves.
  const interactionLocked = isPastInterval || inFinal60;
  // Pre-kickoff shows no next-sub preview badges at all (per the design —
  // nothing's "coming up soon" in a meaningful sense before the clock has
  // even started) even though the same badge data would otherwise compute
  // fine at elapsedSec 0 same as any other moment.
  const showNextSubBadges = !isPreKickoff;

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
    onSwap(swapPickId, id);
    setSwapPickId(null);
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

  // The action bar's small muted status line (e.g. "2 to swap · 1 out") —
  // tied to the LIVE upcoming change like the rest of the countdown, not
  // whichever interval the coach happens to be browsing (viewedIv).
  const actionBarStatusParts = [];
  if (liveChanges.comingOffIds.size > 0) actionBarStatusParts.push(`${liveChanges.comingOffIds.size} to swap`);
  if (injuredThisGame.length > 0) actionBarStatusParts.push(`${injuredThisGame.length} out`);
  const actionBarStatus = actionBarStatusParts.join(" · ");

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
  const renderBenchToken = (id) => (
    <button
      key={id}
      style={{
        ...styles.mdBenchChip,
        ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdBenchChipSwapTarget : {}),
        ...(menuPlayerId === id ? { ...styles.mdOriginLit, ...styles.mdBenchChipLit } : {}),
      }}
      onClick={() => handleTokenTap(id)}
      disabled={interactionLocked}
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
  );

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

  return (
    // No extra bottom padding needed here for the fixed action bar —
    // `main` (SubRotationPlanner.jsx) already reserves bottom clearance
    // for exactly this on every screen it renders.
    <section>
      <div style={styles.mdHeader}>
        <div style={styles.mdHeaderTopRow}>
          <div style={styles.mdCrestOuter}>{crestSrc && <img src={crestSrc} alt="" style={styles.mdCrestImg} />}</div>
          <div style={styles.mdTeamName}>{teamName}</div>
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
        <div style={styles.mdTimerRow}>
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
              border: "none", background: "transparent", padding: 0, cursor: "pointer", font: "inherit", userSelect: "none",
            }}
            onClick={handleTimerTap}
          >
            {fmtClock(elapsedSec)}
          </button>
          <span style={styles.mdTimerCaption}>of {Math.round(totalGameSec / 60)} min</span>
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
        // yet designed" list) — this banner keeps its pre-redesign look.
        <div style={styles.matchCompleteBanner}>
          <span>🏁 Match complete</span>
          <button style={styles.confirmBtn} onClick={onShowSettings}>
            Start new game
          </button>
        </div>
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
        {getFormationLayout(viewedIv.onField).map(({ id, isGk, topPct, leftPct }) => (
          <div key={id} style={{ ...styles.formationToken, top: `${topPct}%`, left: `${leftPct}%` }}>
            <button
              style={{
                ...styles.mdShirtBtn,
                ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdShirtBtnSwapTarget : {}),
                ...(menuPlayerId === id ? { ...styles.mdOriginLit, ...styles.mdShirtBtnLit } : {}),
              }}
              onClick={() => handleTokenTap(id)}
              disabled={interactionLocked}
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
              </div>
            </button>
            <span style={styles.mdShirtPlayerName}>{nameOf(id)}</span>
          </div>
        ))}
      </div>

      <div style={styles.mdBenchStrip}>
        <div style={styles.mdBenchLabel}>BENCH</div>
        {viewedIv.bench.length === 0 && injuredThisGame.length === 0 ? (
          <span style={styles.mdBenchEmpty}>Full squad on field</span>
        ) : (
          // Block 8, part D: one row, two zones — available players first
          // (where the coach looks first), then a divider, then anyone
          // injured, rather than a separate "Injured" sub-label and second
          // row. renderInjuredChip's own pink tint + cross badge already
          // reads as "injured" without a text label repeating it.
          <div style={styles.mdBenchChipRow}>
            {viewedIv.bench.map(renderBenchToken)}
            {viewedIv.bench.length > 0 && injuredThisGame.length > 0 && <div style={styles.mdBenchDivider} />}
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
                  onSwap(menuPlayerId, viewedGk.id);
                  setMenuPlayerId(null);
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

      {!isMatchComplete && !isPreKickoff && !isPaused && !inFinal60 && !sheetOpen && (
        // The plain "running" bar. Mutually exclusive with the final60
        // sheet below (not rendered at the same time) — they'd otherwise
        // show the exact same "Next sub" countdown twice at once, which is
        // redundant even with one of the two dimmed behind a scrim.
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

      {inFinal60 && (
        // Full-screen takeover (A2b-Match-final60): a dark scrim over the
        // header/pitch/bench (already non-interactive behind it too — see
        // interactionLocked above), plus a sheet that's the sole confirm
        // surface for this window. One row per outgoing/incoming pair; a
        // row can genuinely end up with only one side filled (see
        // pairChanges, rotation.js) when the outgoing keeper stays on the
        // pitch as an outfielder instead of leaving — that absorbs a
        // vacancy without it coming from (or going to) the bench, so
        // there's no real partner to show. Explained inline rather than
        // left as a bare, unexplained chip.
        <>
          <div style={styles.mdScrim} data-testid="scrim" />
          <div style={styles.mdFinal60Sheet} data-testid="final60-sheet">
            <div style={styles.mdActionBarStatusRow}>
              <span style={styles.mdFinal60Countdown}>Next sub {fmtClock(Math.max(0, secLeftInInterval))}</span>
              {actionBarStatus && <span style={styles.mdFinal60Status}>{actionBarStatus}</span>}
            </div>
            <div style={styles.mdFinal60RowList}>
              {final60Rows.map((row, i) => (
                <div key={i} style={styles.mdFinal60Row}>
                  {row.outId && (
                    <span style={styles.mdFinal60Chip}>
                      <span style={styles.mdFinal60ChipNumberOut}>{numberOf(row.outId)}</span>
                      <span style={styles.mdBenchChipName}>{nameOf(row.outId)}</span>
                      {row.outIsKeeper && <span style={styles.mdGkTagInline}>GK</span>}
                    </span>
                  )}
                  {row.outId && row.inId && <span style={styles.mdFinal60Arrow}>→</span>}
                  {row.outId && !row.inId && (
                    <span style={styles.mdFinal60OrphanNote}>no bench arrival this window</span>
                  )}
                  {!row.outId && row.inId && (
                    <span style={styles.mdFinal60OrphanNote}>no pitch departure this window</span>
                  )}
                  {row.inId && (
                    <span style={styles.mdFinal60Chip}>
                      <span style={{ ...styles.mdBenchChipNumber, ...(row.inIsKeeper ? styles.mdBenchChipNumberGk : {}) }}>
                        {numberOf(row.inId)}
                      </span>
                      <span style={styles.mdBenchChipName}>{nameOf(row.inId)}</span>
                      {row.inIsKeeper && <span style={styles.mdGkTagInline}>GK</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={styles.mdActionBarBtnRow}>
              <button style={styles.mdActionBarBtnPause} onClick={toggleTimer}>
                <Pause size={20} /> Pause
              </button>
              <button
                style={styles.mdActionBarBtnPrimary}
                onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
              >
                Sub done ✓
              </button>
            </div>
          </div>
        </>
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
        // A2d-Menu-trimmed (#10a): four rows, no group headers — "holding
        // only what a coach touches during a game." Season data, Manage
        // squad, Switch team, Account, and Sign out all moved to
        // Team & account (#10e), reached through the last row here. Reset
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
                  in the first place. Real-use feedback caught both. */}
              <span style={{ ...styles.mdCogMenuIconTile, ...styles.mdTintYellow }}>
                <BarChart2 size={16} color={tokens.color.deepGreen} />
              </span>
              <span style={styles.mdCogMenuLabel}>Minutes</span>
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
    </section>
  );
}
