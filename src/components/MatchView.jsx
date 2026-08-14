import { ChevronRight, ChevronLeft, RotateCcw, Play, Pause, Settings, BarChart2, ArrowDown, ArrowUp } from "lucide-react";
import { intervalAtElapsed, computeNextChangeBadges } from "../lib/rotation.js";
import { computeLiveElapsedSec, fmtClock } from "../lib/clock.js";
import { getFormationLayout } from "../lib/formation.js";
import { styles } from "./styles.js";
import FootballerIcon from "./FootballerIcon.jsx";

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
  nameOf,
  onInjury,
  onBringBack,
  onSwap,
  onSwapKeeper,
  onShowSummary,
  onShowSettings,
}) {
  const totalGameSec = plan[plan.length - 1].endMin * 60;
  const isMatchComplete = elapsedSec >= totalGameSec;
  const cur = plan[intervalAtElapsed(plan, elapsedSec)];
  const secLeftInInterval = cur.endMin * 60 - elapsedSec;
  const nextIv = plan[cur.index + 1];
  const curGk = cur.onField.find((p) => p.isGk);
  const nextGk = nextIv?.onField.find((p) => p.isGk);
  const gkChanging = nextGk && (!curGk || curGk.id !== nextGk.id);
  const noBenchToRotate = cur.bench.length === 0;
  const inWarningWindow = nextIv && secLeftInInterval <= 60 && (!noBenchToRotate || gkChanging);
  const confirmedAt = subLog[cur.index];
  // Who's actually changing at the real, live upcoming transition — always
  // tied to elapsedSec, never to whatever interval the coach happens to be
  // browsing (see viewedIv/viewedGk etc. below, which is the separate
  // "what am I looking at" version used for the pitch board's badges). The
  // warning box needs the live one specifically: it's telling the coach
  // what to physically do right now, so it can't follow them if they've
  // tapped ahead to check a later interval.
  const liveChanges = computeNextChangeBadges({ cur, nextIv, curGk, nextGk, gkChanging });

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
      <div style={styles.subTrackerHeaderRow}>
        <h2 style={styles.sectionTitle}>Match Timer</h2>
        <div style={styles.headerBtnGroup}>
          <button style={styles.editSettingsBtn} onClick={onShowSummary} title="View minutes summary">
            <BarChart2 size={14} /> Summary
          </button>
          <button style={styles.editSettingsBtn} onClick={onShowSettings} title="Edit game settings">
            <Settings size={14} /> Edit
          </button>
        </div>
      </div>

      <div style={styles.timerBar}>
        <div style={styles.clockBlock}>
          <div style={styles.clockDisplay}>{fmtClock(elapsedSec)}</div>
          <div style={styles.clockSub}>of {fmtClock(totalGameSec)}</div>
        </div>
        {isMatchComplete ? (
          <button style={{ ...styles.timerBtn, ...styles.timerBtnDone }} disabled title="Match complete — reset the clock to keep tracking (e.g. extra time)">
            Full Time
          </button>
        ) : (
          <button style={{ ...styles.timerBtn, ...(timerRunning ? styles.timerBtnPause : styles.timerBtnPlay) }} onClick={toggleTimer}>
            {timerRunning ? <Pause size={18} /> : <Play size={18} />}
            {timerRunning ? "Pause" : "Start"}
          </button>
        )}
        <button style={styles.iconBtn} title="Reset clock" onClick={resetClock}>
          <RotateCcw size={16} />
        </button>
      </div>

      {isMatchComplete ? (
        // The clear next step once a match ends — same underlying flow as
        // Edit (opens the same settings form to change squad/settings and
        // regenerate), just surfaced as its own obvious call-to-action
        // right when it becomes relevant, instead of leaving "start a new
        // game" to be discovered via a gear-icon Edit button.
        <div style={styles.matchCompleteBanner}>
          <span>🏁 Match complete</span>
          <button style={styles.confirmBtn} onClick={onShowSettings}>
            Start new game
          </button>
        </div>
      ) : (
        // Stays put across the whole interval — only the button inside it
        // comes and goes (see below), never the row itself. An earlier
        // version hid this whole row once the warning box appeared, to
        // avoid showing the same countdown twice, but that meant the row's
        // full height collapsed at the exact instant the (taller) warning
        // box appeared below it — a jarring jump that looked like the "Sub
        // made early" button had moved or the two were overlapping. Keeping
        // this row's presence constant and only ever toggling the one
        // button inside it keeps the layout stable; a duplicated countdown
        // value for the last 60 seconds is a much smaller cost than that.
        <div style={styles.intervalCountdown}>
          Sub window ends in <strong>{fmtClock(Math.max(0, secLeftInInterval))}</strong>
          {nextIv && confirmedAt === undefined && !inWarningWindow && (
            <button style={styles.confirmBtnInline} onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}>
              ✓ Sub made early
            </button>
          )}
        </div>
      )}

      {inWarningWindow && confirmedAt === undefined && (
        <div style={styles.gkWarmup}>
          <div style={styles.warmupText}>
            <div style={styles.warmupCountdown}>{secLeftInInterval > 0 ? fmtClock(secLeftInInterval) : "Now"}</div>
            {(liveChanges.comingOffIds.size > 0 || liveChanges.comingOnIds.size > 0) && (
              <div>
                {liveChanges.comingOffIds.size > 0 && (
                  <>
                    OFF: <strong>{[...liveChanges.comingOffIds].map(nameOf).join(", ")}</strong>
                    {liveChanges.comingOnIds.size > 0 ? "   " : ""}
                  </>
                )}
                {liveChanges.comingOnIds.size > 0 && (
                  <>
                    ON: <strong>{[...liveChanges.comingOnIds].map(nameOf).join(", ")}</strong>
                  </>
                )}
              </div>
            )}
            {gkChanging && (
              <div>
                <span style={{ marginRight: 4 }}>🧤</span>
                Send <strong>{nameOf(nextGk.id)}</strong> to goal for the swap
              </div>
            )}
          </div>
          <button style={styles.confirmBtn} onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}>
            ✓ Sub made
          </button>
        </div>
      )}
      {confirmedAt !== undefined && nextIv && <div style={styles.confirmedNote}>✓ Sub confirmed at {fmtClock(confirmedAt)}</div>}

      <div style={styles.intervalTabsWrap}>
        <div style={styles.intervalTabs}>
          {plan.map((iv) => (
            <button
              key={iv.index}
              onClick={() => setActiveInterval(iv.index)}
              style={{ ...styles.intervalTab, ...(activeInterval === iv.index ? styles.intervalTabActive : {}) }}
            >
              {iv.startMin}–{iv.endMin}′
            </button>
          ))}
        </div>
      </div>

      <div style={styles.pitchBoard}>
        {isPastInterval ? (
          <div style={styles.swapBanner}>Interval Complete. Navigate to the active Interval for live updates.</div>
        ) : (
          swapPickId && (
            <div style={styles.swapBanner}>
              Tap a player on the pitch to bring on <strong>{nameOf(swapPickId)}</strong>
              <button style={styles.swapCancelBtn} onClick={() => setSwapPickId(null)}>
                Cancel
              </button>
            </div>
          )
        )}
        <div style={styles.pitchInner}>
          <div style={styles.pitchCenterCircle} />
          <div style={styles.pitchHalfwayLine} />
          <div style={styles.pitchGoalBox} />
          {getFormationLayout(plan[activeInterval].onField).map(({ id, isGk, topPct, leftPct }) => (
            <div key={id} style={{ ...styles.formationToken, top: `${topPct}%`, left: `${leftPct}%` }}>
              <div style={styles.tokenWithAction}>
                <button
                  style={{
                    ...styles.token,
                    ...(isGk ? styles.tokenGk : styles.tokenField),
                    ...(swapPickId && !isPastInterval ? styles.tokenSwapTarget : {}),
                  }}
                  onClick={() => swapPickId && !isPastInterval && onSwap(swapPickId, id)}
                  disabled={!swapPickId || isPastInterval}
                >
                  {isGk ? <span style={styles.gloveIcon}>🧤</span> : <FootballerIcon size={27} />}
                </button>
                {comingOffIds.has(id) && (
                  <span style={styles.nextOffBadge} title="Coming off next interval">
                    <ArrowDown size={11} strokeWidth={3.5} />
                  </span>
                )}
                {becomingKeeperId === id && (
                  <span style={styles.nextKeeperBadge} title="Becoming keeper next interval">
                    🧤
                  </span>
                )}
                {steppingDownKeeperId === id && (
                  <span style={styles.nextOnBadge} title="Staying on, switching to outfield next interval">
                    <ArrowUp size={11} strokeWidth={3.5} />
                  </span>
                )}
                {!injuredThisGame.includes(id) && !swapPickId && !isPastInterval && (
                  <button style={styles.injuryBtnSide} onClick={() => onInjury(id)} title="Mark injured / off">
                    🤕
                  </button>
                )}
                {!isGk && !swapPickId && !isPastInterval && keeperEligibleIds.includes(id) && (
                  <button style={styles.makeKeeperBtnSide} onClick={() => onSwapKeeper(id)} title="Make keeper now">
                    🧤
                  </button>
                )}
              </div>
              <span style={styles.tokenName}>{nameOf(id)}</span>
            </div>
          ))}
        </div>
        <div style={styles.benchInjuredRow}>
          <div style={styles.benchCol}>
            <div style={styles.pitchLabel}>BENCH</div>
            <div style={styles.tokenRow}>
              {plan[activeInterval].bench.length === 0 && <span style={styles.noneText}>Full squad on field</span>}
              {plan[activeInterval].bench.map((id) => (
                <div key={id} style={styles.tokenCol}>
                  <div style={styles.tokenCircleWrap}>
                    <div style={{ ...styles.token, ...styles.tokenBench }}>
                      <FootballerIcon size={27} />
                    </div>
                    {comingOnIds.has(id) && (
                      <span style={styles.nextOnBadge} title="Coming on next interval">
                        <ArrowUp size={11} strokeWidth={3.5} />
                      </span>
                    )}
                    {becomingKeeperId === id && (
                      <span style={styles.nextKeeperBadge} title="Becoming keeper next interval">
                        🧤
                      </span>
                    )}
                  </div>
                  <span style={styles.tokenName}>{nameOf(id)}</span>
                  {!isPastInterval && (
                    <button
                      style={{ ...styles.swapBtn, ...(swapPickId === id ? styles.swapBtnActive : {}) }}
                      onClick={() => setSwapPickId(swapPickId === id ? null : id)}
                    >
                      {swapPickId === id ? "Cancel" : "Swap in"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {injuredThisGame.length > 0 && (
            <div style={styles.injuredCol}>
              <div style={styles.pitchLabel}>INJURED</div>
              <div style={styles.tokenRow}>
                {injuredThisGame.map((id) => (
                  <div key={id} style={styles.tokenCol}>
                    <div style={{ ...styles.token, ...styles.tokenInjured }}>🤕</div>
                    <span style={styles.tokenName}>{nameOf(id)}</span>
                    {!isPastInterval && (
                      <button style={styles.backInBtn} onClick={() => onBringBack(id)}>
                        Back in
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={styles.planNav}>
        <button style={styles.iconBtn} disabled={activeInterval === 0} onClick={() => setActiveInterval((i) => Math.max(0, i - 1))}>
          <ChevronLeft size={18} />
        </button>
        <span style={styles.planNavLabel}>
          Interval {activeInterval + 1} of {plan.length}
        </span>
        <button
          style={styles.iconBtn}
          disabled={activeInterval === plan.length - 1}
          onClick={() => setActiveInterval((i) => Math.min(plan.length - 1, i + 1))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
