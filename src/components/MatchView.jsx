import { useState, useEffect } from "react";
import {
  RotateCcw, Play, Pause, BarChart2, History, Shirt, User, LogOut, Home,
  ArrowDown, ArrowUp, ArrowLeftRight,
} from "lucide-react";
import { intervalAtElapsed, computeNextChangeBadges, computeBreakBoundaries } from "../lib/rotation.js";
import { computeLiveElapsedSec, fmtClock } from "../lib/clock.js";
import { getFormationLayout, computeTokenSize } from "../lib/formation.js";
import { styles, tokens } from "./styles.js";
import { GearIcon, KitShirt, MedicalCross } from "./matchDayIcons.jsx";

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
  userEmail,
  availableCount,
  rosterSize,
  gameSettingsSummary,
  onInjury,
  onBringBack,
  onSwap,
  onShowSummary,
  onShowSettings,
  onShowSeason,
  onShowTeamSwitcher,
  onSignOut,
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
  // purely for a readable "X -> Y" line — the underlying schedule has no
  // concept of one player specifically "replacing" another (any bench
  // player filling any vacated slot is equally valid), so pairing is done
  // by zipping the two lists in whatever order they naturally come out in,
  // not read back from anywhere else. The keeper handover is the one
  // *real* pair (there's exactly one outgoing and one incoming keeper), so
  // it's built directly from curGk/becomingKeeperId rather than zipped in
  // with the rest, and excluded from the regular lists so no one appears
  // in two rows.
  const outgoingKeeperId = liveChanges.becomingKeeperId ? curGk?.id : null;
  const regularOffIds = [...liveChanges.comingOffIds].filter((id) => id !== outgoingKeeperId);
  const regularOnIds = [...liveChanges.comingOnIds].filter((id) => id !== liveChanges.becomingKeeperId);
  const final60Rows = [];
  if (liveChanges.becomingKeeperId) {
    final60Rows.push({ outId: outgoingKeeperId, inId: liveChanges.becomingKeeperId, isKeeperSwap: true });
  }
  for (let i = 0; i < Math.max(regularOffIds.length, regularOnIds.length); i++) {
    final60Rows.push({ outId: regularOffIds[i] ?? null, inId: regularOnIds[i] ?? null, isKeeperSwap: false });
  }

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

  // Which token's tap-to-open action popover is currently showing, plus
  // where it should grow from — purely transient UI state, doesn't need
  // to live in useMatchState the way swapPickId does (that one has to
  // survive being read by performSwap). menuOrigin.top is captured from
  // the tapped element's own getBoundingClientRect() at tap time (see
  // handleTokenTap) — position:fixed's `top`, so it stays correct
  // regardless of where in the page this happens to render.
  const [menuPlayerId, setMenuPlayerId] = useState(null);
  const [menuOrigin, setMenuOrigin] = useState(null);
  const menuOnFieldRecord = menuPlayerId ? viewedIv.onField.find((p) => p.id === menuPlayerId) : null;
  const menuCanMakeKeeper = menuOnFieldRecord && !menuOnFieldRecord.isGk && keeperEligibleIds.includes(menuPlayerId);

  // The player-tap popover's "Swap player" row previews who the schedule
  // already has lined up to come on for this specific player, the same
  // way final60Rows pairs off/on lists — reusing that pairing here (based
  // on the *viewed* interval's badges, not live) rather than a second,
  // divergent implementation. Null when this player isn't part of a
  // scheduled change this window (an off-schedule swap the coach is
  // initiating themselves), in which case the row falls back to generic
  // copy instead of guessing.
  const viewedOutgoingKeeperId = becomingKeeperId ? viewedGk?.id : null;
  const viewedRegularOffIds = [...comingOffIds].filter((id) => id !== viewedOutgoingKeeperId);
  const viewedRegularOnIds = [...comingOnIds].filter((id) => id !== becomingKeeperId);
  const swapPartnerFor = (id) => {
    const idx = viewedRegularOffIds.indexOf(id);
    return idx === -1 ? null : viewedRegularOnIds[idx] ?? null;
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

  // Pitch shirts and non-injured bench chips: opens (or closes, if
  // already open) the three-action player-tap popover.
  const handleTokenTap = (id, e) => {
    if (interactionLocked) return;
    if (trySwapComplete(id)) return;
    if (menuPlayerId === id) {
      setMenuPlayerId(null);
      setMenuOrigin(null);
      return;
    }
    setMenuPlayerId(id);
    setMenuOrigin({ top: e.currentTarget.getBoundingClientRect().bottom + 8 });
  };

  // Injured chips open their own dedicated two-button popover
  // (A2i-Back-from-injury) instead — a completely different shape/content
  // from the general player-tap menu, not a variant of it, so this is a
  // separate piece of state (injuredPopoverId) rather than menuPlayerId
  // reused with an injured-specific branch.
  const [injuredPopoverId, setInjuredPopoverId] = useState(null);
  const [injuredPopoverOrigin, setInjuredPopoverOrigin] = useState(null);
  const handleInjuredChipTap = (id, e) => {
    if (interactionLocked) return;
    if (trySwapComplete(id)) return;
    if (injuredPopoverId === id) {
      setInjuredPopoverId(null);
      setInjuredPopoverOrigin(null);
      return;
    }
    setInjuredPopoverId(id);
    setInjuredPopoverOrigin({ top: e.currentTarget.getBoundingClientRect().bottom + 8 });
  };

  const outfielders = viewedIv.onField.filter((p) => !p.isGk);
  const tokenSize = computeTokenSize(outfielders.length);
  // 3-row formations (5+ outfielders) need more vertical room than the
  // original fixed 2-row height ever had to allow for. Bumped up from the
  // original 220/280 — real-device feedback called the pitch "way too
  // squeezed vertically".
  const pitchInnerHeight = outfielders.length > 4 ? 340 : 270;
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
      onClick={(e) => handleTokenTap(id, e)}
      disabled={interactionLocked}
    >
      <span style={{ ...styles.mdBenchChipNumber, ...(keeperEligibleIds.includes(id) ? styles.mdBenchChipNumberGk : {}) }}>
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
      onClick={(e) => handleInjuredChipTap(id, e)}
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

  const resetClock = () => {
    setTimerRunning(false);
    setRunStartedAt(null);
    setBaseElapsedSec(0);
    setElapsedSec(0);
    setSubLog({});
    // Without this, the clock could show 0:00 while the pitch board still
    // displayed whatever interval the coach last happened to be browsing
    // (browsing away from live during play is expected now — see the
    // auto-follow effect in SubRotationPlanner) — the board should match
    // "0:00" exactly the same way it matches any other elapsed time.
    setActiveInterval(0);
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
            <GearIcon size={20} />
          </button>
        </div>
        <div style={styles.mdTimerRow}>
          {/* No more "Paused" text chip — the Play/Pause icon already says
              which state it's in, and the chip was forcing this row to
              stack vertically on pause (digits above, chip+caption below),
              which shifted the buttons out of alignment with the clock
              every time. One consistent row now regardless of state; the
              greyed-out digit color (mdTimerDisplayPaused) is still the
              paused "look", just without a redundant label. */}
          <div style={styles.mdTimerLeft}>
            <span style={{ ...styles.mdTimerDisplay, ...(isPaused ? styles.mdTimerDisplayPaused : {}) }}>
              {fmtClock(elapsedSec)}
            </span>
            <span style={styles.mdTimerCaption}>of {Math.round(totalGameSec / 60)} min</span>
          </div>
          {/* Start/Pause and Reset sit right beside the clock, sized to
              match it — the coach's own real-device feedback: reachable
              without scrolling, and reading as "as important as the clock
              itself" rather than small icons tucked up by the crest. The
              bottom action bar keeps the sub-confirmation action only (see
              mdActionBar below); it no longer duplicates the clock controls. */}
          <div style={styles.mdTimerBtnGroup}>
            {!isMatchComplete && (
              <button
                style={styles.mdTimerPrimaryBtn}
                onClick={toggleTimer}
                title={timerRunning ? "Pause" : isPreKickoff ? "Start" : "Resume"}
              >
                {timerRunning ? (
                  <Pause size={28} color={tokens.color.deepGreen} fill={tokens.color.deepGreen} />
                ) : (
                  <Play size={28} color={tokens.color.deepGreen} fill={tokens.color.deepGreen} />
                )}
              </button>
            )}
            <button style={styles.mdTimerResetBtn} onClick={resetClock} title="Reset clock">
              <RotateCcw size={20} color={tokens.color.deepGreen} />
            </button>
          </div>
        </div>
      </div>

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
              onClick={(e) => handleTokenTap(id, e)}
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
                {isGk && <span style={styles.mdGkTag}>GK</span>}
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
        {viewedIv.bench.length === 0 ? (
          <span style={styles.mdBenchEmpty}>Full squad on field</span>
        ) : (
          // One row, no "Outfield (waiting)"/"Keeper (waiting)" sub-labels —
          // renderBenchToken already flips the keeper-eligible player's
          // number disc gold and shows the 🧤 badge when they're becoming
          // keeper next interval, which was the whole point of the split;
          // the labels were redundant with that and cost two lines of
          // vertical space for what's usually a single extra chip.
          <div style={styles.mdBenchChipRow}>{viewedIv.bench.map(renderBenchToken)}</div>
        )}
        {injuredThisGame.length > 0 && (
          <>
            <div style={{ ...styles.mdBenchSubLabel, marginTop: 10 }}>Injured</div>
            <div style={styles.mdBenchChipRow}>{injuredThisGame.map(renderInjuredChip)}</div>
          </>
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

      {!interactionLocked && menuPlayerId && menuOrigin && (
        // A2g-Player-tap: grows from the tapped token (menuOrigin.top —
        // see handleTokenTap), dismissed by tapping the scrim, the token
        // again (handleTokenTap's own toggle), or any action inside it.
        <>
          <div
            style={styles.mdScrim}
            data-testid="scrim"
            onClick={() => {
              setMenuPlayerId(null);
              setMenuOrigin(null);
            }}
          />
          <div style={{ ...styles.mdPopover, top: menuOrigin.top }} data-testid="player-popover">
            <div style={styles.mdPlayerPopoverHeader}>
              <div style={styles.mdPlayerPopoverName}>{nameOf(menuPlayerId)}</div>
              {/* Injured players never reach this popover (see
                  handleInjuredChipTap/injuredPopoverId below) — every
                  player who does is by definition on the pitch or bench. */}
              <div style={styles.mdPlayerPopoverMeta}>
                #{numberOf(menuPlayerId)} · {menuOnFieldRecord ? "on pitch" : "bench"}
              </div>
            </div>
            <button
              style={styles.mdPlayerPopoverRow}
              onClick={() => {
                setSwapPickId(menuPlayerId);
                setMenuPlayerId(null);
                setMenuOrigin(null);
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
                  setMenuOrigin(null);
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
                setMenuOrigin(null);
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

      {!interactionLocked && injuredPopoverId && injuredPopoverOrigin && (
        // A2i-Back-from-injury: grows from the tapped injured chip, its
        // square corner (bottom-right, per mdBackPopover) pointing back
        // down at it. injuredAt may be missing for a game resumed from
        // before this session's own tracking existed — falls back to
        // just "Not counting minutes" rather than showing a broken time.
        <>
          <div
            style={styles.mdScrim}
            data-testid="scrim"
            onClick={() => {
              setInjuredPopoverId(null);
              setInjuredPopoverOrigin(null);
            }}
          />
          <div style={{ ...styles.mdBackPopover, top: injuredPopoverOrigin.top }} data-testid="back-popover">
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
            <div style={styles.mdBackPopoverBtnRow}>
              <button
                style={styles.mdBackPopoverBtnPrimary}
                onClick={() => {
                  onBringBack(injuredPopoverId);
                  setInjuredPopoverId(null);
                  setInjuredPopoverOrigin(null);
                }}
              >
                Back to bench
              </button>
              <button
                style={styles.mdBackPopoverBtnSecondary}
                onClick={() => {
                  setInjuredPopoverId(null);
                  setInjuredPopoverOrigin(null);
                }}
              >
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
      {isPreKickoff && nextIv && (
        // Start now lives in the timer row (see mdTimerPrimaryBtn above), so
        // this is context only — no button to duplicate it.
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Ready to go</span>
              <span style={styles.mdActionBarStatus}>first sub at {nextIv.startMin}′</span>
            </div>
          </div>
        </div>
      )}

      {isPaused && (
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Clock stopped</span>
              {nextIv && (
                <button
                  style={styles.mdActionBarBtnCompact}
                  onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
                >
                  Sub now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isMatchComplete && !isPreKickoff && !isPaused && !inFinal60 && (
        // The plain "running" bar. Mutually exclusive with the final60
        // sheet below (not rendered at the same time) — they'd otherwise
        // show the exact same "Next sub" countdown twice at once, which is
        // redundant even with one of the two dimmed behind a scrim. Pause
        // lives in the header now, so this bar is just the sub-confirm
        // action, countdown and button on one row — the "X to swap" detail
        // that used to sit under the countdown is dropped here too, since
        // the final-60 takeover already surfaces that detail when it
        // actually matters (inside 60 seconds of the sub).
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
            <div style={styles.mdActionBarInlineRow}>
              <span style={styles.mdActionBarCountdown}>Next sub {fmtClock(Math.max(0, secLeftInInterval))}</span>
              {nextIv && (
                <button
                  style={styles.mdActionBarBtnCompact}
                  onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
                >
                  Sub done ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {inFinal60 && (
        // Full-screen takeover (A2b-Match-final60): a dark scrim over the
        // header/pitch/bench (already non-interactive behind it too — see
        // interactionLocked above), plus a sheet that's the sole confirm
        // surface for this window. One row per outgoing/incoming pair; a
        // row missing one side (e.g. an uneven off/on count) just shows
        // whichever side it has, no arrow.
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
                      {row.isKeeperSwap && <span style={styles.mdGkTagInline}>GK</span>}
                    </span>
                  )}
                  {row.outId && row.inId && <span style={styles.mdFinal60Arrow}>→</span>}
                  {row.inId && (
                    <span style={styles.mdFinal60Chip}>
                      <span style={{ ...styles.mdBenchChipNumber, ...(row.isKeeperSwap ? styles.mdBenchChipNumberGk : {}) }}>
                        {numberOf(row.inId)}
                      </span>
                      <span style={styles.mdBenchChipName}>{nameOf(row.inId)}</span>
                      {row.isKeeperSwap && <span style={styles.mdGkTagInline}>GK</span>}
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

      {cogOrigin && (
        // A2d-Menu-anchored: grows from the cog (cogOrigin.top, captured
        // when it was tapped), dismissed by tapping the scrim, the cog
        // again, or any row inside it. No standalone close button, same
        // as the design — that's genuinely all "dismiss" needs here.
        // "Reset clock" has no row in the reference screens (nothing in
        // this design covers it) — kept in "This game" since that's the
        // closest existing group, rather than dropped.
        <>
          <div style={styles.mdScrim} data-testid="scrim" onClick={() => setCogOrigin(null)} />
          <div style={{ ...styles.mdPopover, top: cogOrigin.top }} data-testid="cog-popover">
            <div style={styles.mdPopoverGroup}>
              <div style={styles.mdPopoverGroupHeader}>
                <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.yellow }} />
                <span style={styles.mdPopoverGroupLabel}>This game</span>
                <span style={styles.mdPopoverGroupRule} />
              </div>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowSummary();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintYellow }}>
                  <BarChart2 size={16} color={tokens.color.deepGreen} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Minutes so far</span>
                <span style={styles.mdPopoverRowValue}>{fmtClock(elapsedSec)}</span>
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowSettings();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintGreen }}>
                  <ArrowLeftRight size={16} color={tokens.color.pitchGreen} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Squad change</span>
                {availableCount != null && <span style={styles.mdPopoverRowValue}>{availableCount} in</span>}
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowSettings();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
                  <GearIcon size={16} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Game settings</span>
                {gameSettingsSummary && <span style={styles.mdPopoverRowValue}>{gameSettingsSummary}</span>}
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  resetClock();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
                  <RotateCcw size={16} color={tokens.color.mutedText} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Reset clock</span>
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
            </div>

            <div style={styles.mdPopoverGroup}>
              <div style={styles.mdPopoverGroupHeader}>
                <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.pitchGreen }} />
                <span style={styles.mdPopoverGroupLabel}>Team</span>
                <span style={styles.mdPopoverGroupRule} />
              </div>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowSeason();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintGreen }}>
                  <BarChart2 size={16} color={tokens.color.pitchGreen} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Season data</span>
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowSettings();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintYellow }}>
                  <Shirt size={16} color={tokens.color.deepGreen} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Manage squad</span>
                {rosterSize != null && <span style={styles.mdPopoverRowValue}>{rosterSize} players</span>}
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowTeamSwitcher();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
                  <Home size={16} color={tokens.color.mutedText} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Switch team</span>
                <span style={styles.mdPopoverRowValue}>{teamName}</span>
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
            </div>

            <div style={styles.mdPopoverGroup}>
              <div style={styles.mdPopoverGroupHeader}>
                <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.chevron }} />
                <span style={styles.mdPopoverGroupLabel}>App</span>
                <span style={styles.mdPopoverGroupRule} />
              </div>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onShowTeamSwitcher();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
                  <User size={16} color={tokens.color.mutedText} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Account</span>
                {userEmail && <span style={styles.mdPopoverRowValue}>{userEmail}</span>}
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
              <button
                style={styles.mdPopoverRow}
                onClick={() => {
                  setCogOrigin(null);
                  onSignOut();
                }}
              >
                <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
                  <LogOut size={16} color={tokens.color.mutedText} />
                </span>
                <span style={styles.mdPopoverRowLabel}>Sign out</span>
                <span style={styles.mdPopoverRowChevron}>›</span>
              </button>
            </div>

            <div style={styles.mdPopoverFooter}>
              Bench Buddy <span style={styles.mdPopoverFooterVersion}>v0.1.0</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
