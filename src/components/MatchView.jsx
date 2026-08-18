import { useState, useEffect } from "react";
import {
  RotateCcw, Play, Pause, Settings, BarChart2, History, Users, X, ArrowDown, ArrowUp, Shield, ArrowLeftRight,
} from "lucide-react";
import { intervalAtElapsed, computeNextChangeBadges, computeBreakBoundaries } from "../lib/rotation.js";
import { computeLiveElapsedSec, fmtClock } from "../lib/clock.js";
import { getFormationLayout, computeTokenSize } from "../lib/formation.js";
import { styles } from "./styles.js";
import { GearIcon, KitShirt } from "./matchDayIcons.jsx";

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
  keeperEligibleIds,
  breakSegments,
  nameOf,
  numberOf,
  teamName,
  crestSrc,
  onInjury,
  onBringBack,
  onSwap,
  onShowSummary,
  onShowSettings,
  onShowSeason,
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

  // Which token's tap-to-open action menu is currently showing — purely
  // transient UI state, doesn't need to live in useMatchState the way
  // swapPickId does (that one has to survive being read by performSwap).
  const [menuPlayerId, setMenuPlayerId] = useState(null);
  const menuOnFieldRecord = menuPlayerId ? viewedIv.onField.find((p) => p.id === menuPlayerId) : null;
  const menuCanMakeKeeper = menuOnFieldRecord && !menuOnFieldRecord.isGk && keeperEligibleIds.includes(menuPlayerId);

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
  // accidentally tapping an injured player), so nothing extra needs to be
  // checked here for those. Tapping the swap source again is treated as an
  // implicit cancel rather than a (meaningless) self-swap. Otherwise a tap
  // opens (or closes, if already open) that player's own action menu.
  const handleTokenTap = (id) => {
    if (interactionLocked) return;
    if (swapPickId) {
      if (id === swapPickId) {
        setSwapPickId(null);
        return;
      }
      setConfirmMessage(`${nameOf(swapPickId)} swapped with ${nameOf(id)}`);
      onSwap(swapPickId, id);
      setSwapPickId(null);
      return;
    }
    setMenuPlayerId((current) => (current === id ? null : id));
  };

  const outfielders = viewedIv.onField.filter((p) => !p.isGk);
  const tokenSize = computeTokenSize(outfielders.length);
  // 3-row formations (5+ outfielders) need more vertical room than the
  // original fixed 2-row height ever had to allow for.
  const pitchInnerHeight = outfielders.length > 4 ? 280 : 220;
  // The kit-shirt SVG's own natural aspect ratio (62x58, see
  // matchDayIcons.jsx) — scaled by the same tokenSize headcount tiering
  // formation.js already provides, rather than formation.js needing to
  // know anything about shirt shapes.
  const shirtWidth = tokenSize;
  const shirtHeight = Math.round(tokenSize * (58 / 62));

  // Which of breakSegments' blocks (see computeBreakBoundaries above) have
  // fully elapsed — purely a display split for the header's block bar,
  // same "zero effect on the actual plan" caveat as breakBoundaries itself.
  const sortedBreakBoundaries = [...breakBoundaries].sort((a, b) => a - b);
  const blockRanges = [];
  let blockRangeStart = 0;
  for (const b of sortedBreakBoundaries) {
    blockRanges.push([blockRangeStart, b]);
    blockRangeStart = b;
  }
  blockRanges.push([blockRangeStart, plan.length]);

  // The action bar's small muted status line (e.g. "2 to swap · 1 out") —
  // tied to the LIVE upcoming change like the rest of the countdown, not
  // whichever interval the coach happens to be browsing (viewedIv).
  const actionBarStatusParts = [];
  if (liveChanges.comingOffIds.size > 0) actionBarStatusParts.push(`${liveChanges.comingOffIds.size} to swap`);
  if (injuredThisGame.length > 0) actionBarStatusParts.push(`${injuredThisGame.length} out`);
  const actionBarStatus = actionBarStatusParts.join(" · ");

  // Cog menu — interim scaffolding for this step. The real anchored,
  // glowing-origin-control popover (absorbing Season/Switch-team/Account/
  // Sign-out too) is its own step; for now this just keeps every one of
  // those entry points reachable via a plain reused modal, since the new
  // header has no room left for the separate Summary/Edit buttons the old
  // one had.
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  // Bench tokens look and behave identically wherever they're rendered
  // (the Outfield-waiting, Keeper-waiting and Injured rows all use this) —
  // kept as one render function rather than a separate component since it
  // just closes over this render's own state/handlers, no lifecycle of its
  // own. An injured player's chip looks exactly like any other bench chip
  // for now — the red-cross treatment is its own later step.
  const renderBenchToken = (id) => (
    <button
      key={id}
      style={{
        ...styles.mdBenchChip,
        ...(swapPickId && swapPickId !== id && !interactionLocked ? styles.mdBenchChipSwapTarget : {}),
      }}
      onClick={() => handleTokenTap(id)}
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
    <section>
      <div style={styles.mdHeader}>
        <div style={styles.mdHeaderTopRow}>
          <div style={styles.mdCrestOuter}>{crestSrc && <img src={crestSrc} alt="" style={styles.mdCrestImg} />}</div>
          <div style={styles.mdTeamName}>{teamName}</div>
          <button style={styles.mdCogBtn} onClick={() => setShowQuickMenu(true)} title="Menu">
            <GearIcon size={20} />
          </button>
        </div>
        <div style={{ ...styles.mdTimerRow, ...(isPaused ? styles.mdTimerRowPaused : {}) }}>
          <span style={{ ...styles.mdTimerDisplay, ...(isPaused ? styles.mdTimerDisplayPaused : {}) }}>
            {fmtClock(elapsedSec)}
          </span>
          <div style={styles.mdTimerCaptionRow}>
            {isPaused && <span style={styles.mdPausedChip}>Paused</span>}
            <span style={styles.mdTimerCaption}>of {Math.round(totalGameSec / 60)} min</span>
          </div>
        </div>
        <div style={styles.mdBlockBar}>
          {blockRanges.map(([, end], i) => (
            <div
              key={i}
              style={{
                ...styles.mdBlockSegment,
                ...(elapsedSec >= plan[end - 1].endMin * 60 ? styles.mdBlockSegmentElapsed : {}),
              }}
            />
          ))}
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
                {isGk && <span style={styles.mdGkTag}>GK</span>}
                {showNextSubBadges && comingOffIds.has(id) && (
                  <span style={styles.mdOutgoingBadge} title="Coming off next interval">
                    <ArrowDown size={13} strokeWidth={3} color="#fff" />
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
          <>
            <div style={styles.mdBenchSubLabel}>Outfield (waiting)</div>
            <div style={styles.mdBenchChipRow}>
              {viewedIv.bench.filter((id) => id !== becomingKeeperId).map(renderBenchToken)}
            </div>
            <div style={{ ...styles.mdBenchSubLabel, marginTop: 10 }}>Keeper (waiting)</div>
            <div style={styles.mdBenchChipRow}>
              {viewedIv.bench.includes(becomingKeeperId) ? (
                renderBenchToken(becomingKeeperId)
              ) : (
                <span style={styles.mdBenchEmpty}>—</span>
              )}
            </div>
          </>
        )}
        {injuredThisGame.length > 0 && (
          <>
            <div style={{ ...styles.mdBenchSubLabel, marginTop: 10 }}>Injured</div>
            <div style={styles.mdBenchChipRow}>{injuredThisGame.map(renderBenchToken)}</div>
          </>
        )}
      </div>

      {!interactionLocked && (confirmMessage || swapPickId || menuPlayerId) && (
        <div style={styles.actionSheet}>
          {confirmMessage ? (
            <div style={styles.actionSheetConfirm}>✓ {confirmMessage}</div>
          ) : swapPickId ? (
            <div style={styles.actionSheetSwapRow}>
              Tap another player to swap with <strong>{nameOf(swapPickId)}</strong>
              <button style={styles.swapCancelBtn} onClick={() => setSwapPickId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div style={styles.tokenActionMenuHeader}>{nameOf(menuPlayerId)}</div>
              {injuredThisGame.includes(menuPlayerId) ? (
                <button
                  style={styles.tokenActionMenuItem}
                  onClick={() => {
                    onBringBack(menuPlayerId);
                    setMenuPlayerId(null);
                  }}
                >
                  <ArrowLeftRight size={15} /> Back in
                </button>
              ) : (
                <>
                  <button
                    style={styles.tokenActionMenuItem}
                    onClick={() => {
                      setSwapPickId(menuPlayerId);
                      setMenuPlayerId(null);
                    }}
                  >
                    <ArrowLeftRight size={15} /> Swap
                  </button>
                  {menuCanMakeKeeper && (
                    <button
                      style={styles.tokenActionMenuItem}
                      onClick={() => {
                        setConfirmMessage(`${nameOf(menuPlayerId)} is now keeper`);
                        onSwap(menuPlayerId, viewedGk.id);
                        setMenuPlayerId(null);
                      }}
                    >
                      <Shield size={15} /> Make keeper
                    </button>
                  )}
                  <button
                    style={{ ...styles.tokenActionMenuItem, ...styles.tokenActionMenuItemDanger }}
                    onClick={() => {
                      onInjury(menuPlayerId);
                      setMenuPlayerId(null);
                    }}
                  >
                    🤕 Mark injured
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* "Sub done" always does the same single confirmSubLog action
          regardless of timing or which of these three bars it's tapped
          from — the old early-vs-in-warning-window "Sub made early"/"Sub
          made" distinction was cosmetic only (nothing downstream reads
          which one fired, only whether cur.index has *any*
          confirmation), so one shared action across all three isn't a
          behavior change. */}
      {isPreKickoff && (
        <div style={styles.mdActionBar}>
          <div style={styles.mdActionBarStatusRow}>
            <span style={styles.mdActionBarCountdown}>Ready to go</span>
            {nextIv && <span style={styles.mdActionBarStatus}>first sub at {nextIv.startMin}′</span>}
          </div>
          <button style={styles.mdActionBarBtnStart} onClick={toggleTimer}>
            <Play size={22} /> Start match
          </button>
        </div>
      )}

      {isPaused && (
        <div style={styles.mdActionBar}>
          <div style={styles.mdActionBarStatusRow}>
            <span style={styles.mdActionBarCountdown}>Clock stopped</span>
            {nextIv && <span style={styles.mdActionBarStatus}>sub due in {fmtClock(Math.max(0, secLeftInInterval))}</span>}
          </div>
          <div style={styles.mdActionBarBtnRow}>
            {nextIv && (
              <button
                style={styles.mdActionBarBtnPause}
                onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
              >
                Sub now
              </button>
            )}
            <button style={{ ...styles.mdActionBarBtnPrimary, ...(nextIv ? {} : { flex: 1 }) }} onClick={toggleTimer}>
              <Play size={20} /> Resume
            </button>
          </div>
        </div>
      )}

      {!isMatchComplete && !isPreKickoff && !isPaused && !inFinal60 && (
        // The plain "running" bar. Mutually exclusive with the final60
        // sheet below (not rendered at the same time) — they'd otherwise
        // show the exact same "Next sub" countdown twice at once, which is
        // redundant even with one of the two dimmed behind a scrim.
        <div style={styles.mdActionBar}>
          <div style={styles.mdActionBarStatusRow}>
            <span style={styles.mdActionBarCountdown}>Next sub {fmtClock(Math.max(0, secLeftInInterval))}</span>
            {actionBarStatus && <span style={styles.mdActionBarStatus}>{actionBarStatus}</span>}
          </div>
          <div style={styles.mdActionBarBtnRow}>
            <button style={{ ...styles.mdActionBarBtnPause, ...(nextIv ? {} : { flex: 1 }) }} onClick={toggleTimer}>
              <Pause size={20} /> Pause
            </button>
            {nextIv && (
              <button
                style={styles.mdActionBarBtnPrimary}
                onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}
              >
                Sub done ✓
              </button>
            )}
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
          <div style={styles.mdFinal60Scrim} />
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

      {showQuickMenu && (
        // Interim scaffolding (see the showQuickMenu comment above) — a
        // plain reused modal standing in for the real anchored, glowing-
        // origin-control cog menu, which is its own later step.
        <div style={styles.modalOverlay} onClick={() => setShowQuickMenu(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Menu</h3>
              <button style={styles.modalCloseBtn} onClick={() => setShowQuickMenu(false)} title="Close menu">
                <X size={18} />
              </button>
            </div>
            <button
              style={styles.tokenActionMenuItem}
              onClick={() => {
                setShowQuickMenu(false);
                onShowSummary();
              }}
            >
              <BarChart2 size={15} /> Minutes so far
            </button>
            <button
              style={styles.tokenActionMenuItem}
              onClick={() => {
                setShowQuickMenu(false);
                onShowSettings();
              }}
            >
              <Settings size={15} /> Squad &amp; game settings
            </button>
            <button
              style={styles.tokenActionMenuItem}
              onClick={() => {
                setShowQuickMenu(false);
                onShowSeason();
              }}
            >
              <History size={15} /> Season data
            </button>
            <button
              style={styles.tokenActionMenuItem}
              onClick={() => {
                setShowQuickMenu(false);
                onShowTeamSwitcher();
              }}
            >
              <Users size={15} /> Switch team
            </button>
            <button
              style={styles.tokenActionMenuItem}
              onClick={() => {
                setShowQuickMenu(false);
                resetClock();
              }}
            >
              <RotateCcw size={15} /> Reset clock
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
