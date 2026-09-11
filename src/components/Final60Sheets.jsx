import { useState, useEffect } from "react";
import { Pause } from "lucide-react";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion.js";
import { styles, tokens } from "./styles.js";

// The final-60 two-sheet flow (block 11: Prepare, then Execute) — split
// out of MatchView.jsx (debt ledger, Next lane) along its own existing
// seam: every piece here was already a separate top-level function in
// that file, called either directly from MatchView's own JSX
// (final60Keyframes, Final60Scrim, PrepareSheet, ExecuteSheet — all
// exported below) or only from other pieces in this same group
// (Final60SheetShell, stepTitle, stepPlayersText, nextOnFieldMinute,
// FINAL60_DISC_COLOR — kept local, unexported). Pure code motion, no
// behavior change — see each piece's own comment, carried over verbatim.

// Block 11's entrance/exit motion, as real CSS @keyframes rather than a
// JS-driven opacity/transform transition. Real-use feedback: three rounds
// running the "mount hidden, flip a tick later" idiom off a JS timer
// (single rAF, then double-nested rAF, then setTimeout) all still failed
// on a real device — abrupt on the way in, and the last round regressed
// the way out too. A CSS animation sidesteps the whole class of bug: it
// starts the moment the element is inserted into the DOM, needing no JS
// trigger to fire at all (unlike a transition, which only ever animates
// in response to a style *change* — something has to reliably cause that
// change after mount, and that "something" is exactly what kept failing).
// mdFinal60Sheet{Enter,Exit} own opacity+the slide; mdFinal60Scrim{Enter,
// Exit} own just opacity for the flat backdrop. Both are simple two-
// keyframe fades/slides — nothing about the direction needs a percentage-
// based multi-keyframe shape the way the gold ring's hold-then-fade does.
export function final60Keyframes() {
  return (
    <style>{`
      @keyframes mdFinal60SheetEnter {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes mdFinal60SheetExit {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(24px); }
      }
      @keyframes mdFinal60ScrimEnter { from { opacity: 0; } to { opacity: 1; } }
      @keyframes mdFinal60ScrimExit { from { opacity: 1; } to { opacity: 0; } }
    `}</style>
  );
}

// Block 11 — the shared shell both final-60 sheets sit in: the 240ms
// slide-up + fade on mount ("no animation under prefers-reduced-motion"),
// the grab handle + swipe-down-to-dismiss (useSheetDrag, same mechanism
// every other bottom sheet in this file already uses), and the in-flow-
// but-stacked-above-the-scrim trick (position:relative + a zIndex above
// mdScrim's own fixed 45 — that's what lets an ordinary flow element
// still paint over a position:fixed sibling).
//
// Two nested divs, not one, because the entrance/exit animation and a
// live drag both need to move the sheet via `transform`, and a CSS
// animation claims that property outright for as long as it's attached —
// even sitting idle at its own "forwards"-held end state, it still wins
// the cascade over a plain inline style trying to set the same property.
// The outer div owns the animation (opacity + the enter/exit slide) and
// is the one testId/role/aria-label point at; the inner owns the actual
// box chrome (background/padding/radius/shadow/scrolling) plus the drag's
// own transform, entirely independent of whatever the outer is doing —
// nested transforms stack visually, so a drag mid-way through an already-
// settled entrance still moves the whole card exactly as before.
//
// exiting/onExited add a real exit animation (real-use feedback: both
// sheets used to just vanish instantly on dismiss — tap, drag, or their
// own timer — with only the entrance ever animated). A plain setTimeout
// is what tells the parent it's safe to stop rendering this once the
// exit's had time to finish — same pattern the gold hold marker
// (goldRingStyle, further down this file) already uses for its own CSS
// @keyframes animation, and deliberately NOT `onAnimationEnd`: that
// event depends on `window.AnimationEvent` existing, which this
// project's own test environment doesn't have, so it's untestable here —
// but more importantly, unlike the entrance trigger this setTimeout isn't
// what starts the animation (the CSS keyframe above does that on its
// own, unconditionally, the instant `exiting` flips); it only decides
// when to stop rendering an already-finished, already-invisible element,
// so even a throttled timer firing late costs nothing worse than a brief
// extra moment of an invisible node sitting in the DOM.
function Final60SheetShell({ onDismiss, exiting, onExited, testId, ariaLabel, titleRow, children }) {
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!exiting) return undefined;
    if (reducedMotion) {
      onExited();
      return undefined;
    }
    const timer = setTimeout(onExited, 260); // the 240ms animation itself, plus a small margin
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting, reducedMotion]);
  const drag = useSheetDrag(onDismiss);
  const dragging = drag.dragStyle.transition === "none";
  return (
    <div
      style={
        reducedMotion
          ? { opacity: exiting ? 0 : 1 }
          : { animation: `${exiting ? "mdFinal60SheetExit" : "mdFinal60SheetEnter"} 240ms ease forwards` }
      }
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        style={{
          ...styles.mdFinal60Shell,
          transform: drag.dragStyle.transform,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        {/* Real-use feedback: swiping felt unreliable — the draggable
            zone used to be just the bare handle pill, a ~40x5px target
            easy to miss on a real phone. Widened to match the same
            handle+header convention SquadSettingsForm's own "rebuild
            rotation" confirm sheet already uses (mdCautionSheet) — the
            title row is plain text, nothing tappable in it, so folding
            it into the drag zone costs nothing while giving a finger a
            much bigger, more natural target than the handle alone. */}
        <div
          {...drag.dragHandleProps}
          // Preserves the same gap the title row used to get for free as
          // its own top-level flex item in mdFinal60Shell's own column
          // flex (gap:10) — now that it's nested a level deeper inside
          // this wrapper instead, that spacing has to be supplied
          // explicitly or it'd collapse down to just the handle's own
          // 4px margin.
          style={{ ...drag.dragHandleProps.style, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <div style={styles.mdFinal60Handle} />
          {titleRow}
        </div>
        {children}
      </div>
    </div>
  );
}

// Block 11's shared backdrop, behind both sheets — same CSS-@keyframes
// reasoning as Final60SheetShell above, just opacity only (no drag, no
// slide, no second nested div needed — a flat backdrop has nothing else
// competing for `transform`). `exiting` switches it to the exit keyframe
// in step with whichever sheet is currently exiting; unmounting itself is
// still owned entirely by the parent's `showSheet1 || showSheet2` — once
// neither sheet needs it, there's nothing left to keep it around for, so
// this doesn't need its own onAnimationEnd/onExited at all.
export function Final60Scrim({ exiting }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div
      style={{
        ...styles.mdScrim,
        ...(reducedMotion
          ? { opacity: exiting ? 0 : 1 }
          : { animation: `${exiting ? "mdFinal60ScrimExit" : "mdFinal60ScrimEnter"} 240ms ease forwards` }),
      }}
      data-testid="scrim"
    />
  );
}

// SHEET 1 — PREPARE. Only players who have to physically walk onto the
// pitch before the whistle get a card: the incoming keeper (if they're a
// genuine bench arrival — one already on the pitch just changing role has
// nothing to walk anywhere for, see MatchView's own becomingKeeperFromBench
// check) and every regular bench arrival. Nobody leaving, and nobody just
// changing position while staying on, appears here at all — they have
// nothing to do yet either.
export function PrepareSheet({ pendingChanges, keeperFromBench, nameOf, numberOf, toggleTimer, onReady, exiting, onExited, onMount }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onMount(), []);
  const { comingOnIds, becomingKeeperId } = pendingChanges;
  return (
    <Final60SheetShell
      onDismiss={onReady}
      exiting={exiting}
      onExited={onExited}
      testId="prepare-sheet"
      ariaLabel="Prepare for the next substitution"
      titleRow={
        <div style={styles.mdFinal60TitleRow}>
          <span style={styles.mdPrepareTitle}>Next sub 60 secs</span>
          <span style={styles.mdFinal60LabelWrap}>
            <span style={styles.mdFinal60Label}>GET READY</span>
          </span>
        </div>
      }
    >
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
// "George → Eli" — the collapsed-step and confirm-dialog plain-text
// summary of who's involved, shared by both.
function stepPlayersText(step, nameOf) {
  if (step.outId && step.inId) return `${nameOf(step.outId)} → ${nameOf(step.inId)}`;
  if (step.outId) return nameOf(step.outId);
  if (step.inId) return nameOf(step.inId);
  return "";
}

// Scans forward from the interval a cancelled sub was decided at, to name
// the next one this player is actually scheduled to appear on the pitch
// — the rebuilt plan already carries the answer, this just reads it back
// for the "Cancelled · ... first on at <minute>′" caption. null if the
// rotation never gets back to them (the game ends first).
function nextOnFieldMinute(plan, playerId, fromIndex) {
  for (let i = fromIndex + 1; i < plan.length; i++) {
    if (plan[i].onField.some((p) => p.id === playerId)) return plan[i].startMin;
  }
  return null;
}

export function ExecuteSheet({
  steps, nameOf, numberOf, toggleTimer, onDismiss, exiting, onExited, onMount,
  onSwapIncoming, plan, targetIndex, announce,
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onMount(), []);
  // Block 15 — cancelling a change. displaySteps is a frozen snapshot of
  // `steps` at mount (a fresh one every time, since the parent remounts
  // this whole component per pendingIndex via its own `key`), not the
  // live-recomputed array `steps` keeps being on every render. That's
  // deliberate: cancelling a step makes the plan's own real transition
  // for that pairing disappear entirely (the departing player never
  // really left, so buildFinal60Steps has nothing left to report there)
  // — rendering straight from the live `steps` prop would make a
  // cancelled step simply vanish instead of greying out in place, and
  // renumber everything after it. The cancel flow below patches this
  // local copy directly alongside the real onSwapIncoming call that
  // actually changes the plan, so the displayed list only ever changes
  // because the coach acted on it, never because of a side effect of
  // that action elsewhere.
  const [displaySteps, setDisplaySteps] = useState(steps);
  // Which step is open right now — tapping its title/"⋯" or its own
  // incoming player's chip both open the same one panel, so there's a
  // single, unambiguous target rather than the coach needing to remember
  // which spot on the row does what. This panel does exactly one thing:
  // offer to cancel the change. An earlier round of this feature also
  // let it open into a "redirect to a specific other bench player"
  // picker — real-use feedback was that having two different sets of
  // options behind one tap read as confusing, so that picker is gone;
  // cancelling (which already returns the departing player to the field
  // and moves the declined player to the front of the queue) is the one
  // thing this panel offers now, matching the reference design, which
  // never had a picker here either.
  //
  // Only one step open at a time; every other live step collapses to a
  // compact single line while something's open — the design's own
  // mockup does the same (screens 21-23), as a focus/declutter choice,
  // not because of any actual space constraint: this sheet is a fixed,
  // full-viewport overlay (mdFinal60Overlay) stacked above the whole
  // screen, not laid out alongside the pitch, so growing it doesn't
  // shrink the pitch either way.
  const [openIndex, setOpenIndex] = useState(null);
  const [confirmCancelIndex, setConfirmCancelIndex] = useState(null);

  const handleConfirmCancel = (i) => {
    const step = displaySteps[i];
    onSwapIncoming(step.inId, step.outId); // hand the spot right back to whoever was leaving
    const nextMin = nextOnFieldMinute(plan, step.inId, targetIndex);
    setDisplaySteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, cancelled: true, cancelledInId: step.inId, cancelledOutId: step.outId, cancelledNextMin: nextMin } : s))
    );
    setConfirmCancelIndex(null);
    setOpenIndex(null);
    announce(
      `Sub cancelled. ${nameOf(step.inId)} stays on the bench, first on ${nextMin != null ? `at ${nextMin} minutes` : "later this game"}.`
    );
  };
  const handleUndo = (i) => {
    const step = displaySteps[i];
    onSwapIncoming(step.cancelledOutId, step.cancelledInId); // swap back to how it was before the cancel
    setDisplaySteps((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, cancelled: false, cancelledInId: undefined, cancelledOutId: undefined, cancelledNextMin: undefined } : s))
    );
  };

  const confirmStep = confirmCancelIndex != null ? displaySteps[confirmCancelIndex] : null;

  return (
    <>
      <Final60SheetShell
        onDismiss={onDismiss}
        exiting={exiting}
        onExited={onExited}
        testId="execute-sheet"
        ariaLabel="Make the changes"
        titleRow={
          <div style={styles.mdFinal60TitleRow}>
            <span style={styles.mdExecuteTitle}>Make the changes</span>
            <span style={styles.mdFinal60LabelWrap}>
              <span style={styles.mdFinal60Label}>30 secs to go</span>
            </span>
          </div>
        }
      >
        <div style={styles.mdExecuteStepList}>
          {displaySteps.map((step, i) => {
            // Scoped to a genuine bench arrival. A same-pitch position
            // change (the stepping-down keeper taking an outfield spot)
            // has no clean "swap back" undo the way an arrival does — see
            // the block 15 comment on mdExecuteStepMore in styles.js for
            // the full reasoning — so it keeps its plain, always-
            // expanded, non-cancellable display.
            const cancellable = Boolean(onSwapIncoming) && step.inId != null && step.inColor === "arriving";
            const open = openIndex === i;
            const collapsed = !step.cancelled && openIndex !== null && openIndex !== i;
            const toggleOpen = () => setOpenIndex(open ? null : i);

            if (step.cancelled) {
              return (
                <div key={i} style={styles.mdExecuteStepRow}>
                  <span style={styles.mdExecuteStepCancelledNumeral}>{i + 1}.</span>
                  <div style={styles.mdExecuteStepBody}>
                    <div style={styles.mdExecuteCancelledTitleRow}>
                      <span style={styles.mdExecuteCancelledTitle}>{stepTitle(step, nameOf)}</span>
                      <button style={styles.mdExecuteUndoPill} onClick={() => handleUndo(i)}>
                        Undo
                      </button>
                    </div>
                    <span style={styles.mdExecuteCancelledCaption}>
                      Cancelled · {nameOf(step.cancelledOutId)} stays on ·{" "}
                      {step.cancelledNextMin != null
                        ? `${nameOf(step.cancelledInId)} first on at ${step.cancelledNextMin}′`
                        : `${nameOf(step.cancelledInId)} not scheduled on again this game`}
                    </span>
                  </div>
                </div>
              );
            }

            if (collapsed) {
              // The whole row — numeral included — dims together as one
              // unit (matches the spec's own markup exactly): the numeral
              // used to sit outside the opacity wrapper here, so it stayed
              // full-strength while only the title/players faded, a real
              // (if subtle) mismatch from the reference screens.
              return (
                <div key={i} style={styles.mdExecuteStepCollapsedRow}>
                  {/* No cap-height fudge here (unlike the open/cancelled
                      numeral) — this row centers its items instead of
                      top-aligning them, so the plain baseline already
                      lines up; matches the spec's own markup, which only
                      applies that offset to the open step's numeral. */}
                  <span style={styles.mdExecuteStepCollapsedNumeral}>{i + 1}.</span>
                  {cancellable ? (
                    <button style={styles.mdExecuteStepOpenBtn} onClick={toggleOpen}>
                      <span style={styles.mdExecuteStepCollapsedBody}>
                        <span style={styles.mdExecuteStepCollapsedTitle}>{stepTitle(step, nameOf)}</span>
                        <span style={styles.mdExecuteStepCollapsedPlayers}>{stepPlayersText(step, nameOf)}</span>
                      </span>
                      <span style={styles.mdExecuteStepMore} aria-hidden="true">
                        ⋯
                      </span>
                    </button>
                  ) : (
                    <span style={styles.mdExecuteStepCollapsedBody}>
                      <span style={styles.mdExecuteStepCollapsedTitle}>{stepTitle(step, nameOf)}</span>
                      <span style={styles.mdExecuteStepCollapsedPlayers}>{stepPlayersText(step, nameOf)}</span>
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div key={i} style={styles.mdExecuteStepRow}>
                <span style={styles.mdExecuteStepNumeral}>{i + 1}.</span>
                <div style={styles.mdExecuteStepBody}>
                  {cancellable ? (
                    <button style={styles.mdExecuteStepOpenBtn} onClick={toggleOpen}>
                      <span style={styles.mdExecuteStepInstruction}>{stepTitle(step, nameOf)}</span>
                      <span
                        style={{ ...styles.mdExecuteStepMore, ...(open ? styles.mdExecuteStepMoreActive : {}) }}
                        aria-label={`More options for step ${i + 1}`}
                      >
                        ⋯
                      </span>
                    </button>
                  ) : (
                    <span style={styles.mdExecuteStepInstruction}>{stepTitle(step, nameOf)}</span>
                  )}
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
                    {step.inId && cancellable && (
                      // Same action as the title's own "⋯" — tapping the
                      // incoming player themselves is at least as natural
                      // a place to ask "what about this sub?" as the dots
                      // are, so both open the one cancel panel below.
                      <button style={styles.mdExecuteChipOpenBtn} onClick={toggleOpen}>
                        <span style={{ ...styles.mdExecuteChipDisc, background: FINAL60_DISC_COLOR[step.inColor] }}>
                          {numberOf(step.inId)}
                        </span>
                        <span style={styles.mdExecuteChipName}>{nameOf(step.inId)}</span>
                        {step.inIsKeeper && <span style={{ ...styles.mdFinal60GkPill, marginLeft: "auto" }}>GK</span>}
                      </button>
                    )}
                    {step.inId && !cancellable && (
                      <span style={styles.mdExecuteChip}>
                        <span style={{ ...styles.mdExecuteChipDisc, background: FINAL60_DISC_COLOR[step.inColor] }}>
                          {numberOf(step.inId)}
                        </span>
                        <span style={styles.mdExecuteChipName}>{nameOf(step.inId)}</span>
                        {step.inIsKeeper && <span style={{ ...styles.mdFinal60GkPill, marginLeft: "auto" }}>GK</span>}
                      </span>
                    )}
                  </div>
                  {open && (
                    <div style={styles.mdExecuteStepActionRow}>
                      <button style={styles.mdExecuteCancelBtn} onClick={() => setConfirmCancelIndex(i)}>
                        ✕ Cancel this change
                      </button>
                      <button style={styles.mdExecuteCloseBtn} onClick={() => setOpenIndex(null)}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={styles.mdFinal60ActionRow}>
          <button style={styles.mdFinal60ActionPause} onClick={toggleTimer}>
            <Pause size={20} /> Pause
          </button>
          {/* Block 11 real-use-feedback simplification: "sub done" is now a
              coach acknowledgment, not an action — it changes no state and
              has no effect on the board or on minutes, same as the prepare
              sheet's own "Ready" (see MatchView's own comment where this is
              wired up for the full reasoning). It's just this sheet's own
              dismiss, same as the drag handle. */}
          <button style={styles.mdFinal60ActionPrimary} onClick={onDismiss}>
            Sub done ✓
          </button>
        </div>
      </Final60SheetShell>
      {/* Block 15 — the one centred-card dialog in this app; everything
          else here is a bottom sheet or an anchored popover. Sits above
          the execute sheet itself (mdFinal60Overlay's own zIndex 46), not
          inside it, since it has to interrupt that sheet rather than live
          in its own scroll area. "Keep the sub" is the primary action —
          the dialog opened on one tap and must cost one tap to leave. */}
      {confirmStep && (
        <>
          <div style={styles.mdCancelDialogScrim} data-testid="cancel-dialog-scrim" onClick={() => setConfirmCancelIndex(null)} />
          <div style={styles.mdCancelDialogCard} data-testid="cancel-confirm-dialog" role="dialog" aria-modal="true">
            <span style={styles.mdCancelDialogTitle}>{nameOf(confirmStep.inId)} doesn&apos;t come on</span>
            <span style={styles.mdCancelDialogBody}>
              {nameOf(confirmStep.outId)} stays on. {nameOf(confirmStep.inId)} stays on the bench, first on at the next
              interval.
            </span>
            <button style={styles.mdCancelDialogCancelBtn} onClick={() => handleConfirmCancel(confirmCancelIndex)}>
              ✕ Cancel the sub
            </button>
            <button style={styles.mdCancelDialogKeepBtn} onClick={() => setConfirmCancelIndex(null)}>
              Keep the sub
            </button>
          </div>
        </>
      )}
    </>
  );
}
