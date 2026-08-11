import { ChevronRight, ChevronLeft, RotateCcw, Play, Pause, Settings, BarChart2 } from "lucide-react";
import { intervalAtElapsed } from "../lib/rotation.js";
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
  nameOf,
  onInjury,
  onBringBack,
  onSwap,
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

  // Who's actually changing at the next sub window, so the board can flag
  // it well before the last-minute warning above kicks in — visible only
  // while looking at the live interval itself (browsing to a past/future
  // interval, see the auto-follow effect in SubRotationPlanner, naturally
  // hides it, since "coming off/on next" only means something for what's
  // happening right now).
  //
  // Two kinds of badge, kept visually distinct on purpose:
  //   - Regular bench<->field subs get a colored ↓/↑ badge. Off/on players
  //     are paired up by position in their respective lists and share a
  //     color per pair (cycling through subPairColors), so "these two
  //     changes go together" reads at a glance instead of as 2-4 unrelated
  //     dots. This is a display-only pairing, not something the rotation
  //     algorithm itself tracks — with the usual 1 (occasionally 2) change
  //     per interval it lines up naturally.
  //   - A keeper handover is a role change, not necessarily a substitution
  //     (the two players involved often stay on the pitch the whole time,
  //     invisible to a plain bench/field diff) — it gets its own gold 🧤
  //     badge on whoever's becoming keeper, wherever they currently are,
  //     instead of a colored arrow, even if they're also physically coming
  //     on from the bench. That's what makes it read as "keeper's
  //     changing", not "just another sub".
  const isViewingLiveInterval = activeInterval === cur.index;
  const showNextChangeBadges = isViewingLiveInterval && Boolean(nextIv);
  const rawComingOff = showNextChangeBadges
    ? cur.onField.map((p) => p.id).filter((id) => !nextIv.onField.some((p) => p.id === id))
    : [];
  const rawComingOn = showNextChangeBadges
    ? nextIv.onField.map((p) => p.id).filter((id) => !cur.onField.some((p) => p.id === id))
    : [];
  const becomingKeeperId = showNextChangeBadges && gkChanging ? nextGk.id : null;
  const regularComingOn = rawComingOn.filter((id) => id !== becomingKeeperId);

  const subPairColors = ["#3B82F6", "#8B5CF6", "#0D9488"];
  const offColorFor = (id) => subPairColors[rawComingOff.indexOf(id) % subPairColors.length];
  const onColorFor = (id) => subPairColors[regularComingOn.indexOf(id) % subPairColors.length];

  const comingOffIds = new Set(rawComingOff);
  const comingOnIds = new Set(regularComingOn);

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

      <div style={styles.intervalCountdown}>
        Sub window ends in <strong>{fmtClock(Math.max(0, secLeftInInterval))}</strong>
        {nextIv && confirmedAt === undefined && !inWarningWindow && (
          <button style={styles.confirmBtnInline} onClick={() => setSubLog((prev) => ({ ...prev, [cur.index]: elapsedSec }))}>
            ✓ Sub made early
          </button>
        )}
      </div>

      {inWarningWindow && confirmedAt === undefined && (
        <div style={styles.gkWarmup}>
          <div style={styles.warmupText}>
            <div>
              {secLeftInInterval > 0
                ? noBenchToRotate
                  ? `Keeper swap coming up — window closes in ${fmtClock(secLeftInInterval)}`
                  : `Start looking for the next sub — window closes in ${fmtClock(secLeftInInterval)}`
                : "Sub window is up — make the change now"}
            </div>
            {gkChanging && (
              <div>
                <span style={{ marginRight: 4 }}>🧤</span>
                Send <strong>{nameOf(nextGk.id)}</strong> down to warm up in goal
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
        {swapPickId && (
          <div style={styles.swapBanner}>
            Tap a player on the pitch to bring on <strong>{nameOf(swapPickId)}</strong>
            <button style={styles.swapCancelBtn} onClick={() => setSwapPickId(null)}>
              Cancel
            </button>
          </div>
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
                    ...(swapPickId ? styles.tokenSwapTarget : {}),
                  }}
                  onClick={() => swapPickId && onSwap(swapPickId, id)}
                  disabled={!swapPickId}
                >
                  {isGk ? <span style={styles.gloveIcon}>🧤</span> : <FootballerIcon size={27} />}
                </button>
                {comingOffIds.has(id) && (
                  <span style={{ ...styles.nextOffBadge, background: offColorFor(id) }} title="Coming off next interval">
                    ↓
                  </span>
                )}
                {becomingKeeperId === id && (
                  <span style={styles.nextKeeperBadge} title="Becoming keeper next interval">
                    🧤
                  </span>
                )}
                {!injuredThisGame.includes(id) && !swapPickId && (
                  <button style={styles.injuryBtnSide} onClick={() => onInjury(id)} title="Mark injured / off">
                    🤕
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
                      <span style={{ ...styles.nextOnBadge, background: onColorFor(id) }} title="Coming on next interval">
                        ↑
                      </span>
                    )}
                    {becomingKeeperId === id && (
                      <span style={styles.nextKeeperBadge} title="Becoming keeper next interval">
                        🧤
                      </span>
                    )}
                  </div>
                  <span style={styles.tokenName}>{nameOf(id)}</span>
                  <button
                    style={{ ...styles.swapBtn, ...(swapPickId === id ? styles.swapBtnActive : {}) }}
                    onClick={() => setSwapPickId(swapPickId === id ? null : id)}
                  >
                    {swapPickId === id ? "Cancel" : "Swap in"}
                  </button>
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
                    <button style={styles.backInBtn} onClick={() => onBringBack(id)}>
                      Back in
                    </button>
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
