import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Shuffle, ChevronDown, Check } from "lucide-react";
import {
  computeIntervals, computeBreakBoundaries, keeperShiftIntervalsFor, generatePlan, computeFairnessSpread, isFairSpread,
  recommendSubIntervals,
} from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { fmtClock } from "../lib/clock.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";
import { styles, tokens } from "./styles.js";
import { RotateIcon } from "./strokeIcons.jsx";

// Drawn (stroke, not solid-fill) icons for the edit layout's own four
// accordion-section badges, plus the "rebuild rotation" confirm sheet's
// own header icon — a deliberately different visual family from
// matchDayIcons.jsx (that file's icons are explicitly solid-fill by
// design; these are line-drawn tags/badges). Kept local to this file
// since nothing else uses them yet. fill="none"/round caps+joins on every
// one, matching the app's one drawn-icon convention.
function GloveIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tokens.color.deepGreen} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 12V5.6a1.6 1.6 0 0 1 3.2 0V11" />
      <path d="M10.2 11V4.4a1.6 1.6 0 0 1 3.2 0V11" />
      <path d="M13.4 11V6a1.6 1.6 0 0 1 3.2 0v7" />
      <path d="M16.6 10.4a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-2.2a5 5 0 0 1-3.6-1.5L4 15.4a1.7 1.7 0 0 1 2.4-2.4L7 13.6" />
    </svg>
  );
}
// Two straight opposite-pointing arrows, not a curved/circular swap
// glyph — a curved pair fuses into a blob at 44px tile size.
function SwapIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={tokens.color.pitchGreen} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 8.5H5" />
      <path d="M8.6 5 5 8.5l3.6 3.5" />
      <path d="M4 15.5h15" />
      <path d="M15.4 12l3.6 3.5-3.6 3.5" />
    </svg>
  );
}
function BreaksIcon() {
  return (
    <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={tokens.color.actionBar} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </svg>
  );
}
// How many groups the match-screen interval tabs get visually split into —
// "breakSegments" is the group count (2 = halves = 1 divider, 3 = thirds =
// 2 dividers, and so on), not the divider count directly. See
// computeBreakBoundaries (rotation.js) for the actual math and why that
// framing was chosen.
const BREAK_OPTIONS = [
  { segments: 1, label: "None" },
  { segments: 2, label: "Halves" },
  { segments: 3, label: "Thirds" },
  { segments: 4, label: "Quarters" },
];

// The edit layout's own collapsed-row VALUE text — distinct from
// BREAK_OPTIONS' own chip labels above (kept short as tap targets:
// "Halves"/"Thirds"/"Quarters"). Real-use feedback: wanted the row to
// read as one phrase, "Breaks" + this value, matching how "Keeper
// changes" + "Every 4′" already reads elsewhere in this same accordion.
// "None" stays a plain noun — "Breaks Every none" doesn't parse.
const BREAK_VALUE_LABEL = { 1: "None", 2: "Every half", 3: "Every third", 4: "Every quarter" };

const TILE_ORDER = [
  { key: "fieldSize", label: "on pitch", min: 2, step: 1 },
  { key: "gameMinutes", label: "minutes", min: 5, step: 5 },
  { key: "subIntervalMinutes", label: "sub every", min: 2, step: 1 },
];

// A small tinted icon tile per edit-layout accordion section (collapsed
// row only — see sectionBadge below) — real-use feedback ("it looks
// pretty boring right now" first, then the icons themselves went through
// a design pass replacing the original emoji with these drawn glyphs).
// Deliberately no red/pink tile in this set — red is reserved for injury
// across the app. #EADFC2 is a one-off for Keepers' own tile (a warm
// neutral distinct from "goal"'s own headerYellow, even though both reuse
// the same GloveIcon glyph — the two sections are related, just not
// visually identical), not yet a shared token.
const SECTION_BADGE = {
  goal: { Icon: GloveIcon, bg: tokens.color.headerYellow },
  swaps: { Icon: SwapIcon, bg: tokens.color.mint },
  breaks: { Icon: BreaksIcon, bg: tokens.color.creamDeep },
  keepers: { Icon: GloveIcon, bg: "#EADFC2" },
};

// README > A3-Setup / A4-Setup (`#3a`, `#4a`, `#4b`). Two layouts, both
// built here, picked by `variant`:
//   - "inline" (A3) — first-time setup, before any rotation has ever been
//     built for this team. Everything shown open at once, since there's
//     nothing "already answered" yet for a coach to skim past.
//   - "edit" (A4-collapsed/expanded) — editing an existing game's settings.
//     The three advanced choices (In goal today / Keeper swaps / Breaks)
//     collapse into one-line rows carrying their current value, and expand
//     in place (one at a time) when tapped — "a coach in a hurry can go
//     straight to Build rotation" per the design file's own rationale.
// Both variants share the same tap-to-edit number tiles, in-goal keeper
// picker, keeper-swap stepper, and breaks control underneath — only the
// wrapper around them differs.
//
// Squad roster management (add, remove, assign a squad number, rename) no
// longer lives here at all — real-use feedback moved it to a standalone
// screen (ManageSquadScreen.jsx, reached from Team & account) once this
// form's own Who's-here chip row already covered add/availability and the
// Keepers section below covered eligibility, leaving nothing left in a
// "Manage squad" section here worth keeping. Availability lives on the
// chip row itself (tap to drop out).
//
// Keeper eligibility itself: the design's "In goal today" chips look like
// three states (starting / included / not included), but this app only
// ever had two real keeper-related fields — a permanent per-player
// `keeperEligible` flag and a per-game `startingGkId` pick. Rather than add
// a third, this-game-only "in the pool today" concept, the "In goal today"
// list only ever shows players who are already keeper-eligible (tap =
// pick/un-pick as today's starter); granting or revoking eligibility
// itself stays a deliberate, permanent action via 🧤 in the Keepers
// section (renderKeepersSection below). Confirmed with the user: reuse the
// existing flag rather than build new per-game state, since a coach visits
// this screen every single game and would see (and could fix) a stale
// "permanent" exclusion right away, not lose track of it.
export default function SquadSettingsForm({
  roster,
  gameSettings,
  setGameSettings,
  availableIds,
  setAvailableIds,
  newPlayerName,
  setNewPlayerName,
  addPlayer,
  toggleAvailable,
  toggleKeeperEligible,
  setAllKeeperEligible,
  numberOf,
  gameInProgress,
  elapsedSec,
  onSubmit,
  submitLabel,
  startingGkId,
  setStartingGkId,
  variant = "inline",
  title = "Today's game",
  onClose,
  // Which accordion section (edit variant only) should already be open on
  // arrival — "goal" | "swaps" | "breaks" | null. null for the normal
  // default (nothing expanded).
  initialExpandedSection = null,
  // Only used by the "inline" variant's own crest+title header (see
  // `header` below) — the very-first-team case, which has no onClose to
  // hang a back button off of instead — and by the "edit" variant's own
  // small crest+name row (see teamName below), so this one prop serves
  // both headers rather than needing a second copy of the same image.
  crestSrc,
  // Backlog #1: confirming which team you're setting up next. Only passed
  // for the "Set up next game" moment specifically (SubRotationPlanner
  // gates it on isMatchComplete) — every other "edit" call (plain "Game
  // settings" mid-match) leaves this unset, since there's no ambiguity
  // about which team you're looking at while its own match is live on
  // screen right behind this modal. Presence of this prop, not a separate
  // boolean, is what decides whether the header's small crest+name row
  // renders at all.
  teamName,
  // Backlog #1, corrected: starting a new game should confirm who's
  // actually here today, the same as a brand-new team's first-ever setup
  // already does — not silently reuse whichever availableIds happens to
  // be left over from the last game. Gated separately from teamName
  // (rather than reusing that same presence check) since the two ended
  // up being asked for together but aren't the same thing — a future
  // "edit" call could plausibly want one without the other. Only
  // SubRotationPlanner's "Set up next game" call passes this true; plain
  // mid-match "Game settings" leaves it false, same as before.
  confirmAvailability = false,
  // True while RotationProgressOverlay is showing over this screen —
  // disables the submit button (see renderWarningsAndSubmit) so the build
  // sequence can't be restarted underneath the overlay's own scrim.
  overlayOpen = false,
}) {
  const validation = validateGameSettings(gameSettings, availableIds.length);

  const keeperEligibleIds = useMemo(() => roster.filter((p) => p.keeperEligible).map((p) => p.id), [roster]);
  const inGoalCandidates = useMemo(
    () => roster.filter((p) => availableIds.includes(p.id) && p.keeperEligible),
    [roster, availableIds]
  );
  // "inline" layout's own Keepers collapsed-row value — see
  // renderKeeperEligibilityRows below for the full section.
  const keepersValue =
    roster.length === 0
      ? "Add squad first"
      : keeperEligibleIds.length === roster.length
      ? "Shared by all"
      : `${keeperEligibleIds.length} of ${roster.length}`;

  // If the currently-picked kid stops being available or loses their glove
  // (unticked mid-setup), the pick would silently go stale until submit —
  // clear it right away instead so the button state stays honest.
  useEffect(() => {
    if (startingGkId && !(availableIds.includes(startingGkId) && keeperEligibleIds.includes(startingGkId))) {
      setStartingGkId(null);
    }
  }, [startingGkId, availableIds, keeperEligibleIds, setStartingGkId]);

  // Only bother simulating once the rest of the form is actually valid —
  // no point warning about a plan that can't be generated anyway.
  const fairnessWarning = useMemo(() => {
    if (!startingGkId || !validation.valid) return null;
    const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes, gameSettings.subIntervalMinutes);
    const shiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes, gameSettings.keeperShiftMinutes);
    const { intervals } = generatePlan({
      availableIds,
      gameMinutes: gameSettings.gameMinutes,
      numIntervals,
      fieldSize: gameSettings.fieldSize,
      keeperEligibleIds,
      keeperShiftIntervals: shiftIntervals,
      startingGkId,
    });
    const spread = computeFairnessSpread(intervals, availableIds);
    if (isFairSpread(spread, intervalLen)) return null;
    const name = roster.find((p) => p.id === startingGkId)?.name ?? "this player";
    return `Starting ${name} in goal means some players could get up to ${Math.round(spread)} more minutes than others today.`;
  }, [startingGkId, validation.valid, gameSettings, availableIds, keeperEligibleIds, roster]);

  // Gated on validation.valid, same as fairnessWarning above — deliberately
  // not shown before there's actually a legitimate, generatable squad for
  // today. Also drives the "N sub windows · fairest for M players" line
  // under the tiles.
  const subIntervalRecs = useMemo(() => {
    if (!validation.valid) return null;
    return recommendSubIntervals({
      candidateMinutes: [4, 5, 6, 7, 8],
      gameMinutes: gameSettings.gameMinutes,
      fieldSize: gameSettings.fieldSize,
      availableIds,
      keeperEligibleIds,
    });
  }, [validation.valid, gameSettings.gameMinutes, gameSettings.fieldSize, availableIds, keeperEligibleIds]);
  const currentRec = subIntervalRecs?.find((r) => Number(gameSettings.subIntervalMinutes) === r.subIntervalMinutes);

  // Which tile ("fieldSize" | "gameMinutes" | "subIntervalMinutes") is
  // flipped dark with its stepper showing — one at a time. Which of the
  // three accordion sections is expanded in the "edit" layout — also one
  // at a time, same "one thing open" shape used elsewhere in this app
  // (e.g. the match screen's own player-tap menu).
  const [activeTile, setActiveTile] = useState(null);
  // Real-use feedback: a flipped tile only settled back on a tap dead
  // centre on its own body — tapping anywhere else on the page (another
  // section, the header, blank space) left it stuck open. Listens for a
  // pointerdown anywhere while a tile's flipped and closes it unless the
  // tap landed inside the tiles row itself — tapping a *different* tile
  // there already switches activeTile directly (see renderTiles' own
  // onClick), so this only needs to catch genuinely outside taps, not
  // fight that existing in-row switch.
  const tilesRowRef = useRef(null);
  useEffect(() => {
    if (!activeTile) return;
    const handlePointerDown = (e) => {
      if (tilesRowRef.current && !tilesRowRef.current.contains(e.target)) setActiveTile(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeTile]);
  const [expandedSection, setExpandedSection] = useState(initialExpandedSection); // "goal" | "swaps" | "breaks" | null
  const [showAddChip, setShowAddChip] = useState(false);
  // "Keepers" — shared by both layouts now (real-use feedback: turning
  // this off for anyone shouldn't be buried inside a Manage squad list a
  // coach might not open for a while — and Manage squad itself no longer
  // even lives here, see renderKeepersSection/ManageSquadScreen.jsx). Its
  // own independent collapse state, not folded into expandedSection above
  // — it sits alongside that group (real-use feedback: directly against
  // First in goal today, which it feeds), not competing with it for "one
  // thing open at a time".
  const [keepersExpanded, setKeepersExpanded] = useState(false);
  // Progressive disclosure for the sub-interval fairness picker (see
  // renderSubIntervalRecs below) — collapsed behind a tappable "Improve
  // fairness" prompt until a coach actually asks to see it. Real-use
  // feedback: showing the picker even when the current pick is already
  // fair invites solving a problem that doesn't exist.
  const [fairnessExpanded, setFairnessExpanded] = useState(false);
  // Real-use feedback: without this reset, expanding the prompt once for
  // an unfair pick left it expanded for every *later* pick too — so a
  // second unfair choice skipped straight to the bare chip row with no
  // "Improve fairness" prompt ever shown for it. Collapse fresh every time
  // the actual interval changes, so the prompt is what a coach sees first
  // for whichever pick they're looking at right now.
  useEffect(() => {
    setFairnessExpanded(false);
  }, [gameSettings.subIntervalMinutes]);
  // The edit layout's own "rebuild rotation" confirm sheet — see
  // renderWarningsAndSubmit/handleSubmitClick below. Not used by "inline"
  // (first-time setup never has a game in progress to confirm about).
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Real-use feedback: this looked like every other bottom sheet in the
  // app (mdSheet's own grab handle) but didn't swipe-dismiss like one —
  // same shared hook the match screen's player-tap/injury sheets use.
  const confirmSheetDrag = useSheetDrag(() => setConfirmOpen(false));

  // Real-use feedback: the old restart-warning banner interrupted every
  // visit, even ones with nothing to lose, and its own wording was wrong
  // (minutes already played are never cleared). Now: skip the interruption
  // entirely when there's no game in progress (gameInProgress false —
  // true first-time setup, or editing before a game's ever been started),
  // and only ask via the confirm sheet when there's an actual in-progress
  // game whose remaining plan is about to be rebuilt.
  const handleSubmitClick = () => {
    if (gameInProgress) setConfirmOpen(true);
    else onSubmit();
  };

  const stepTile = (key, dir) => {
    const tile = TILE_ORDER.find((t) => t.key === key);
    const current = Number(gameSettings[key]) || tile.min;
    setGameSettings({ ...gameSettings, [key]: Math.max(tile.min, current + dir * tile.step) });
  };

  const keeperSwapValue = gameSettings.keeperShiftMinutes || gameSettings.subIntervalMinutes || 2;
  const stepKeeperSwap = (dir) => {
    const floor = gameSettings.subIntervalMinutes || 2;
    const next = Math.max(floor, keeperSwapValue + dir);
    setGameSettings({ ...gameSettings, keeperShiftMinutes: next === floor ? "" : next });
  };

  const submitAddChip = () => {
    if (!newPlayerName.trim()) return;
    addPlayer();
    setShowAddChip(false);
  };

  // ---- Shared pieces --------------------------------------------------

  function sectionBadge(key) {
    const { Icon, bg } = SECTION_BADGE[key];
    return (
      <span style={{ ...styles.mdSetupRowIconTile, background: bg }}>
        <Icon />
      </span>
    );
  }

  function renderTiles() {
    return (
      <div ref={tilesRowRef} style={styles.settingsGrid}>
        {TILE_ORDER.map(({ key, label }) => {
          const isActive = activeTile === key;
          const value = gameSettings[key];
          if (!isActive) {
            return (
              <button key={key} style={styles.mdSetupTile} onClick={() => setActiveTile(key)}>
                <div style={styles.mdSetupTileValue}>{value === "" || value == null ? "–" : value}</div>
                <span style={styles.mdSetupTileLabel}>{label}</span>
              </button>
            );
          }
          return (
            // A div, not a nested button, so the real +/- buttons inside it
            // stay valid HTML — tapping anywhere else on the flipped tile
            // (not the steppers themselves) settles it back, per the design.
            <div
              key={key}
              style={{ ...styles.mdSetupTile, ...styles.mdSetupTileActive }}
              onClick={() => setActiveTile(null)}
              role="button"
              tabIndex={0}
            >
              <div style={styles.mdSetupTileStepRow}>
                <button
                  style={{ ...styles.mdSetupTileStepBtn, ...styles.mdSetupTileStepBtnMinus }}
                  onClick={(e) => { e.stopPropagation(); stepTile(key, -1); }}
                >
                  −
                </button>
                <span style={styles.mdSetupTileStepValue}>{value}</span>
                <button
                  style={{ ...styles.mdSetupTileStepBtn, ...styles.mdSetupTileStepBtnPlus }}
                  onClick={(e) => { e.stopPropagation(); stepTile(key, 1); }}
                >
                  +
                </button>
              </div>
              <span style={{ ...styles.mdSetupTileLabel, ...styles.mdSetupTileActiveLabel }}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderIntervalPreview() {
    // Fair: a short confirmation, not a number to parse — real-use
    // feedback, see renderSubIntervalRecs below for the fuller story.
    // There's nothing to act on here, so nothing more to say.
    //
    // Real-use feedback again: "This is already one of the fairest..."
    // read as odd — "already" implies the coach expected otherwise, when
    // they've usually just picked this interval fresh. Named what's being
    // judged (this sub interval) instead of leaning on "already".
    //
    // Real-device feedback: the longer original wording ("This sub
    // interval gives one of the fairest rotations for today.") wrapped to
    // two lines on a phone-width screen. Shortened to fit on one.
    if (currentRec?.fair) {
      return (
        <div style={styles.mdSetupFairnessOk}>
          <Check size={13} strokeWidth={3} color={tokens.color.pitchGreen} />
          These sub settings provide a fair rotation.
        </div>
      );
    }
    if (currentRec) {
      return (
        <div style={styles.mdSetupHint}>
          {currentRec.numIntervals} sub windows · up to {Math.round(currentRec.bestSpread)} min apart today
        </div>
      );
    }
    const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
    return <div style={styles.mdSetupHint}>≈ {intervalLen.toFixed(1)} min per interval · {numIntervals} sub windows this game</div>;
  }

  // Not part of the design file at all (it only shows the current sub
  // interval's own fairness, not a picker) — kept from the original form
  // rather than dropped: this is real, working functionality the mockup
  // just didn't happen to depict.
  //
  // Design pass, real-use feedback: the old two-line "For today's N
  // players — tap a fairer sub interval, or keep what you've got:" prose
  // said in two lines what the chips already said on their own — cut to
  // one short label, and the chips now show the minute mark ("5′" not a
  // bare "5") and highlight a single best fit (smallest spread across
  // every candidate) instead of a generic ✓/✗ per chip. No separate
  // "currently selected" highlight anymore — the "sub every" tile above
  // already shows the live value; this row is purely "here's what's
  // fairest," not an echo of the current pick.
  //
  // Real-device feedback: even that one-line "Even splits for N players"
  // label was unclear jargon on its own ("I don't actually know what that
  // means") and, worse, redundant — renderIntervalPreview's own caption
  // right above this ("N sub windows · fairest for N players") already
  // says the same thing in context. Dropped the label entirely; each
  // chip's own tap title still explains itself.
  //
  // Progressive disclosure, real-use feedback: showing this picker
  // unconditionally — even when the coach's current pick is already fair
  // — invites solving a problem that doesn't exist. Fair: nothing renders
  // here at all (renderIntervalPreview's own checkmark line already says
  // so). Unfair: starts collapsed behind a tappable "Improve fairness"
  // prompt, only expanding into the actual chip picker once a coach asks
  // to see it — a guide, not something in their way.
  function renderSubIntervalRecs() {
    if (!subIntervalRecs || subIntervalRecs.length === 0) return null;
    if (currentRec?.fair) return null;
    if (!fairnessExpanded) {
      return (
        <button style={styles.mdSetupFairnessPrompt} onClick={() => setFairnessExpanded(true)}>
          <span style={styles.mdSetupFairnessPromptLabel}>Improve fairness</span>
          <span style={styles.mdSetupFairnessPromptHint}> — tap to explore fairer subbing options&nbsp;›</span>
        </button>
      );
    }
    const bestFitMinutes = subIntervalRecs.reduce((best, r) => (r.bestSpread < best.bestSpread ? r : best)).subIntervalMinutes;
    return (
      <>
        <div style={styles.mdSetupEvenSplitsRow}>
          {subIntervalRecs.map((r) => {
            const isBestFit = r.subIntervalMinutes === bestFitMinutes;
            return (
              <button
                key={r.subIntervalMinutes}
                style={{ ...styles.mdSetupSplitChip, ...(isBestFit ? styles.mdSetupSplitChipBest : {}) }}
                onClick={() => setGameSettings({ ...gameSettings, subIntervalMinutes: r.subIntervalMinutes })}
                title={
                  isBestFit
                    ? `${r.subIntervalMinutes} min subs is the fairest split today.`
                    : r.fair
                    ? `${r.subIntervalMinutes} min subs also keeps everyone within about one interval of each other today.`
                    : `${r.subIntervalMinutes} min subs could leave some players up to ${Math.round(r.bestSpread)} min behind others today, even with the fairest possible starting keeper.`
                }
              >
                <Check size={isBestFit ? 13 : 12} color={isBestFit ? "#fff" : tokens.color.pitchGreen} />
                {r.subIntervalMinutes}′
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderInGoalChips(onDark) {
    if (inGoalCandidates.length === 0) {
      return (
        <div style={onDark ? styles.mdSetupCardCaptionOnDark : styles.mdSetupHint}>
          No keeper-eligible players available today — mark someone 🧤 in Keepers above.
        </div>
      );
    }
    return (
      <div style={styles.mdBenchChipRow}>
        {inGoalCandidates.map((p) => {
          const isStarting = startingGkId === p.id;
          return (
            <button
              key={p.id}
              style={{ ...styles.mdBenchChip, background: isStarting ? tokens.color.yellow : tokens.color.mint }}
              onClick={() => setStartingGkId(isStarting ? null : p.id)}
            >
              <span
                style={{
                  ...styles.mdBenchChipNumber,
                  ...(isStarting ? { background: tokens.color.deepGreen, color: tokens.color.yellow } : {}),
                }}
              >
                {numberOf(p.id)}
              </span>
              <span style={styles.mdBenchChipName}>
                {p.name}
                {isStarting ? " \u{1F451}" : ""}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderKeeperSwapStepper(onDark) {
    return (
      <div style={styles.mdSetupInlineStepRow}>
        <button
          style={{ ...styles.mdSetupInlineStepBtn, ...(onDark ? styles.mdSetupInlineStepBtnMinusOnDark : styles.mdSetupInlineStepBtnMinus) }}
          onClick={() => stepKeeperSwap(-1)}
        >
          −
        </button>
        <span style={{ ...styles.mdSetupInlineStepValue, ...(onDark ? styles.mdSetupInlineStepValueOnDark : {}) }}>
          {keeperSwapValue}′
        </span>
        <button
          style={{ ...styles.mdSetupInlineStepBtn, ...(onDark ? styles.mdSetupInlineStepBtnPlusOnDark : styles.mdSetupInlineStepBtnPlus) }}
          onClick={() => stepKeeperSwap(1)}
        >
          +
        </button>
      </div>
    );
  }

  function renderBreaksChips() {
    return (
      <div style={styles.mdSetupChipRow}>
        {BREAK_OPTIONS.map((opt) => {
          const isSelected = (gameSettings.breakSegments || 1) === opt.segments;
          return (
            <button
              key={opt.segments}
              style={{ ...styles.mdSetupChip, ...(isSelected ? styles.mdSetupChipActive : {}) }}
              onClick={() => setGameSettings({ ...gameSettings, breakSegments: opt.segments })}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderBreaksBar() {
    const { numIntervals } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
    const boundaries = computeBreakBoundaries(numIntervals, gameSettings.breakSegments || 1);
    const segments = [];
    for (let i = 0; i < numIntervals; i++) {
      if (boundaries.has(i)) segments.push(<div key={`div-${i}`} style={styles.mdSetupBreakDivider} />);
      segments.push(
        <div
          key={i}
          style={{
            ...styles.mdSetupBreakSeg,
            ...(i === 0 && !boundaries.has(1) ? styles.mdSetupBreakSegFirst : {}),
            ...(i === numIntervals - 1 ? styles.mdSetupBreakSegLast : {}),
          }}
        />
      );
    }
    const groups = (gameSettings.breakSegments || 1) === 1 ? 1 : gameSettings.breakSegments;
    const perGroupMin = Math.round((gameSettings.gameMinutes || 0) / groups);
    return (
      <>
        <div style={styles.mdSetupBreakBar}>{segments}</div>
        <div style={styles.mdSetupHint}>
          {groups > 1 ? `${groups} blocks of ${perGroupMin}′ · ${numIntervals} sub windows` : `${numIntervals} sub windows this game`}
        </div>
      </>
    );
  }

  // Not in the design file (its squad section has no bulk control at all)
  // — kept from the original form rather than dropped.
  function renderSelectAll() {
    if (roster.length === 0) return null;
    const allSelected = availableIds.length === roster.length;
    return (
      <button
        style={{ ...styles.selectAllBtn, marginLeft: 0 }}
        onClick={() => setAvailableIds(allSelected ? [] : roster.map((p) => p.id))}
      >
        {allSelected ? "Clear all" : "Select all"}
      </button>
    );
  }

  function renderSquadChips() {
    return (
      <>
        <div style={styles.mdBenchChipRow}>
          {roster.map((p) => {
            const isAvailable = availableIds.includes(p.id);
            return (
              <button
                key={p.id}
                style={{ ...styles.mdBenchChip, ...(isAvailable ? {} : styles.mdSetupChipOut) }}
                onClick={() => toggleAvailable(p.id)}
              >
                <span style={{ ...styles.mdBenchChipNumber, ...(isAvailable ? {} : styles.mdSetupChipOutNumber) }}>
                  {numberOf(p.id)}
                </span>
                <span style={styles.mdBenchChipName}>{p.name}</span>
              </button>
            );
          })}
          <button
            style={{ ...styles.mdSetupAddChip, ...styles.mdSetupAddChipSticky }}
            onClick={() => setShowAddChip((v) => !v)}
          >
            <Plus size={14} /> Player
          </button>
        </div>
        {showAddChip && (
          <div style={{ ...styles.mdSetupAddRow, marginTop: 8 }}>
            <input
              autoFocus
              style={styles.mdSetupInput}
              placeholder="Player name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAddChip()}
            />
            <button style={styles.mdSetupAddBtn} onClick={submitAddChip}>
              Add
            </button>
          </div>
        )}
      </>
    );
  }

  // A focused subset of Manage squad's own old rows (name + the same 🧤
  // toggle, same styling), deliberately without the number badge or
  // remove button that row also carried: this moment is only ever about
  // keeper eligibility, not general roster upkeep (that lives in
  // ManageSquadScreen.jsx now, reached from Team & account).
  function renderKeeperEligibilityRows() {
    if (roster.length === 0) return <div style={styles.emptyState}>No players yet — add your squad above.</div>;
    return roster.map((p) => (
      <div key={p.id} style={styles.mdSetupRow}>
        <span style={styles.mdSetupRowName}>{p.name}</span>
        <button
          style={{
            ...styles.mdSetupToggle,
            ...(p.keeperEligible ? { ...styles.mdSetupToggleActive, background: tokens.color.headerYellow } : {}),
          }}
          onClick={() => toggleKeeperEligible(p.id)}
          title="Toggle keeper-eligible"
        >
          🧤
        </button>
      </div>
    ));
  }

  // "Keepers" — shared by both layouts now (real-use feedback: "This
  // should be available under Set up a New Team Screen and Set Up Next
  // Game" — extended to every "edit" render, not just the match-complete
  // one, so a coach flipping eligibility mid-season via plain Game
  // settings doesn't lose the only place that was ever reachable, now
  // that Manage squad's own 🧤 toggle is gone). Called from inside
  // renderGameSettingsAccordion below, as the first card in the same
  // flex-column stack as First in goal today/Keeper changes/Breaks — real
  // -use feedback wanted it sitting directly against the section it
  // depends on, not separated from it by the tiles/fairness note above
  // (no own margin here; the flex column's own gap handles spacing).
  function renderKeepersSection() {
    return (
      <>
        {keepersExpanded ? (
          <div style={styles.mdSetupCard}>
            <div style={styles.mdSetupCardHeaderRow}>
              <div style={styles.mdSetupCardTitle}>Keepers</div>
              {/* Real-use feedback: everyone's already eligible by
                  default, so this exists for restoring that after turning
                  some off. One tap both confirms the whole squad and moves
                  on — it also collapses the card back down, the same way
                  finishing this step naturally hands off to the settings
                  group below it. */}
              {roster.length > 0 && (
                <button
                  style={{ ...styles.selectAllBtn, marginLeft: 0 }}
                  onClick={() => {
                    setAllKeeperEligible(true);
                    setKeepersExpanded(false);
                  }}
                >
                  Select all
                </button>
              )}
              <span style={styles.mdSetupCardCollapseBtn} onClick={() => setKeepersExpanded(false)} role="button" tabIndex={0} title="Collapse">
                <ChevronDown size={22} strokeWidth={3} />
              </span>
            </div>
            <div style={styles.mdSetupHint}>Everyone can play in goal by default — turn off anyone who shouldn't.</div>
            <div style={{ marginTop: 8 }}>{renderKeeperEligibilityRows()}</div>
          </div>
        ) : (
          <button style={styles.mdSetupAccordionRow} onClick={() => setKeepersExpanded(true)}>
            {sectionBadge("keepers")}
            <span style={styles.mdSetupAccordionLabel}>Keepers</span>
            <span style={styles.mdSetupAccordionValue}>{keepersValue}</span>
            <span style={styles.mdSetupAccordionChevron}>›</span>
          </button>
        )}
      </>
    );
  }

  // Real-use feedback: "inline" (first-time setup) should now "appear
  // exactly how it does the Game settings screen" — including this
  // button, so both variants share the one green style/handler rather
  // than inline keeping its own separate yellow mdSetupSubmitBtn.
  // handleSubmitClick degrades safely for inline: gameInProgress is
  // structurally always false there (it's only ever true once a plan
  // exists, and inline only ever renders before one does), so it always
  // takes the plain onSubmit() path — the confirm sheet it would
  // otherwise open is only rendered in "edit"'s own return.
  function renderWarningsAndSubmit() {
    return (
      <>
        {fairnessWarning && <div style={styles.mdSetupWarning}>{fairnessWarning}</div>}
        {!validation.valid && (
          <div style={styles.mdSetupWarning}>
            {validation.errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}
        <button
          style={{ ...styles.mdSetupSubmitBtnPrimary, opacity: validation.valid && !overlayOpen ? 1 : 0.5 }}
          disabled={!validation.valid || overlayOpen}
          // Real-use spec: RotationProgressOverlay's own aria-hidden
          // scrim isn't reliably enough on its own to keep every
          // browser's Tab key off a hidden-but-still-focusable control —
          // explicitly pulling this out of tab order too is what actually
          // stops the build sequence from being restarted underneath it.
          tabIndex={overlayOpen ? -1 : undefined}
          onClick={handleSubmitClick}
        >
          <Shuffle size={16} /> {submitLabel}
        </button>
      </>
    );
  }

  // ---- Layouts ----------------------------------------------------------

  // "edit" gets the same yellow-beveled header/back-button shell Minutes
  // and Who's here already use (mdSubHeader) — real-use feedback wanted
  // this screen's own header to match those two, rather than the plain
  // title-row + ✕ it had before.
  //
  // "inline" (first-time setup) used to keep its own separate plain
  // title-row header, stacked right underneath SubRotationPlanner.jsx's
  // own app-level header — two headers doing overlapping jobs, one of
  // them the one screen in the app the match-day redesign never reached.
  // Real-use feedback ("a lot of the old UI appearing... we only get one
  // chance to make a good first impression"): consolidated into one
  // header, now context-aware for *which* first-time-setup moment this
  // is, and SubRotationPlanner's own outer header dropped entirely (see
  // its own history) now that this covers the whole job.
  //   - A genuinely new team with nowhere to go back to (the very first
  //     team, straight off sign-in — no onClose) gets a crest + title,
  //     the same shape MatchView's own header uses, so it still reads as
  //     the same screen family rather than a bespoke one.
  //   - An *additional* team (reached via Team & account's own "Manage
  //     squad"... "+ Add a team" row, which passes onClose to actually
  //     return there) gets the exact same back-chevron shell as "edit" —
  //     the coach already knows this shape from Game settings.
  const header =
    variant === "inline" && !onClose ? (
      <div style={styles.mdHeader}>
        <div style={styles.mdHeaderTopRow}>
          <div style={styles.mdCrestOuter}>{crestSrc && <img src={crestSrc} alt="" style={styles.mdCrestImg} />}</div>
          <div style={styles.mdTeamNameStack}>
            <div style={styles.mdTeamNameLabel}>Team</div>
            <div style={styles.mdTeamName}>{title}</div>
          </div>
        </div>
      </div>
    ) : (
      <div style={styles.mdSubHeader}>
        {onClose && (
          <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
            ‹
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {teamName && (
            <div style={styles.mdSubHeaderTeamRow}>
              {crestSrc && <img src={crestSrc} alt="" style={styles.mdSubHeaderTeamCrest} />}
              <span style={styles.mdSubHeaderTeamName}>{teamName}</span>
            </div>
          )}
          <div style={styles.mdSubHeaderTitle}>{title}</div>
        </div>
      </div>
    );

  // Tiles + interval preview/fairness chips + the First in goal today /
  // Keeper changes / Breaks accordion group — shared by both layouts now.
  // Originally "edit"-only; "inline" (first-time setup) used to show all
  // of this open flat instead, but real-use feedback ("appear exactly how
  // it does the Game settings screen") asked for the identical collapsed
  // shape there too, so this moved out of the "edit" branch into its own
  // function both can call.
  function renderGameSettingsAccordion() {
    return (
      <>
        {/* The "Who's here?" chip row (availability toggle + add-player)
            used to open here too — dropped on real-use feedback, now that
            it's fully covered by its own dedicated screen (cog menu's
            "Who's here" row, SquadChangeScreen.jsx) for "edit", and by
            "inline"'s own Who's-here section further up the page for
            first-time setup.

            "The game" label above the tiles is gone too — real-use
            feedback: it wasn't earning its own line, and removing it
            helps the submit button actually stay in view without
            scrolling. */}
        <div style={{ marginTop: 14 }}>{renderTiles()}</div>
        {renderIntervalPreview()}
        {renderSubIntervalRecs()}

        {/* marginBottom is a fixed floor, not the auto margin the submit
            button below uses to reach the bottom of the screen — on a
            tall roster, that auto margin can shrink close to nothing, so
            without this the button could end up sitting right against
            the submit button with no breathing room. */}
        <div style={{ marginTop: 22, marginBottom: 20, display: "flex", flexDirection: "column", gap: 9 }}>
          {renderKeepersSection()}

          {expandedSection === "goal" ? (
            <div style={{ ...styles.mdSetupCard, ...styles.mdSetupCardDark }}>
              {/* No section badge once expanded — real-device feedback,
                  didn't look right there. Header row is title + chevron
                  only, same shape every expanded card uses now — the
                  value badge moved to its own line below, rather than
                  competing with the title and a long player name for
                  space on one line (that combination could wrap the
                  title onto two lines on a phone-width screen). */}
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={{ ...styles.mdSetupCardTitle, ...styles.mdSetupCardTitleOnDark }}>First in goal today</div>
                <span
                  style={styles.mdSetupCardChevronOnDark}
                  onClick={() => setExpandedSection(null)}
                  role="button"
                  tabIndex={0}
                  title="Collapse"
                >
                  <ChevronDown size={22} strokeWidth={3} />
                </span>
              </div>
              <span style={{ ...styles.mdSetupCardValueBadge, ...(startingGkId ? styles.mdSetupCardValueBadgeSet : {}), marginTop: 10 }}>
                {startingGkId ? roster.find((p) => p.id === startingGkId)?.name : "Random"}
              </span>
              <div style={{ marginTop: 12 }}>{renderInGoalChips(true)}</div>
              <div style={styles.mdSetupCardCaptionOnDark}>Tap a name to pick who starts in goal today.</div>
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("goal")}>
              {sectionBadge("goal")}
              <span style={styles.mdSetupAccordionLabel}>First in goal today</span>
              <span style={styles.mdSetupAccordionValue}>
                {startingGkId ? roster.find((p) => p.id === startingGkId)?.name : "Random"}
              </span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}

          {expandedSection === "swaps" ? (
            <div style={{ ...styles.mdSetupCard, ...styles.mdSetupCardDark }}>
              {/* Same "header row = title + chevron only" shape as every
                  other expanded card now — the stepper moved below rather
                  than sharing the header row with the chevron (real-
                  device feedback: adding the chevron alongside the title
                  and stepper's 3 buttons wrapped "Keeper changes" onto
                  two lines on a phone-width screen; there just wasn't
                  room for all of it on one line). */}
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={{ ...styles.mdSetupCardTitle, ...styles.mdSetupCardTitleOnDark }}>Keeper changes</div>
                <span
                  style={styles.mdSetupCardChevronOnDark}
                  onClick={() => setExpandedSection(null)}
                  role="button"
                  tabIndex={0}
                  title="Collapse"
                >
                  <ChevronDown size={22} strokeWidth={3} />
                </span>
              </div>
              <div style={{ marginTop: 10 }}>{renderKeeperSwapStepper(true)}</div>
              <div style={styles.mdSetupCardCaptionOnDark}>Leave at the sub length to rotate keepers every window.</div>
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("swaps")}>
              {sectionBadge("swaps")}
              <span style={styles.mdSetupAccordionLabel}>Keeper changes</span>
              <span style={styles.mdSetupAccordionValue}>Every {keeperSwapValue}′</span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}

          {expandedSection === "breaks" ? (
            <div style={styles.mdSetupCard}>
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={styles.mdSetupCardTitle}>Breaks</div>
                <span style={styles.mdSetupCardCollapseBtn} onClick={() => setExpandedSection(null)} role="button" tabIndex={0} title="Collapse">
                  <ChevronDown size={22} strokeWidth={3} />
                </span>
              </div>
              <div style={{ marginTop: 11 }}>{renderBreaksChips()}</div>
              {renderBreaksBar()}
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("breaks")}>
              {sectionBadge("breaks")}
              <span style={styles.mdSetupAccordionLabel}>Breaks</span>
              <span style={styles.mdSetupAccordionValue}>{BREAK_VALUE_LABEL[gameSettings.breakSegments || 1]}</span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}
        </div>
      </>
    );
  }

  if (variant === "edit") {
    return (
      // display:flex/flexDirection:column + minHeight is what makes the
      // submit button's own margin-top:auto (below) mean something —
      // pushed to the bottom of a full screen's height rather than sitting
      // right after the last accordion row on a short page.
      //
      // 100dvh, not 100vh — real-device feedback, again: even with the
      // button's own marginBottom fudge factor (styles.js has the story),
      // it was still dropping out of view at the bottom on a short
      // settings page. 100vh reports the *largest possible* viewport,
      // ignoring whatever browser chrome (Safari's collapsing toolbar
      // especially) is actually on screen at that moment — so this
      // column, and the "bottom" margin-top:auto measures against, could
      // both be taller than what's genuinely visible, regardless of how
      // big the button's own bottom margin was made. 100dvh instead
      // tracks the *actual* visible viewport live, toolbar state and all,
      // so "the bottom of this column" now means the same thing as "the
      // bottom of what the coach can actually see" — the margin fudge
      // factor is still there for a deliberate visual gap, not to
      // compensate for this any more.
      //
      // The confirm sheet/scrim below are position:fixed (viewport-
      // anchored, styles.js has the real-device story on why), so they
      // float over whatever's here rather than needing this wrapper to
      // reserve space or provide a positioning anchor for them — no
      // position:relative or open-state paddingBottom needed.
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        {header}

        {/* Backlog #1, corrected: the same "Who's here" block the
            first-time-setup layout opens with below — availableIds is
            already prefilled with whoever was marked available last
            game (nothing resets it between games), so this reads as
            "confirm, don't re-decide from scratch": already-available
            players show selected, the rest of the squad shows the same
            greyed-out treatment SquadChangeScreen/first-time-setup
            already use for "not here today", and the same +Player
            control is here too for a new arrival who isn't on the
            roster yet. Real-use feedback: this should show every time a
            new game is being set up, not just for the very first team
            ever. */}
        {confirmAvailability && (
          <div style={{ marginTop: 2 }}>
            <div style={styles.mdSetupHeaderInRow}>
              <div style={styles.mdSetupSectionTitle}>Who's here</div>
              <span style={styles.mdSetupInChip}>{availableIds.length} in</span>
              <span style={styles.mdSetupDropOutHint}>tap to drop out</span>
              {renderSelectAll()}
            </div>
            {renderSquadChips()}
          </div>
        )}

        {renderGameSettingsAccordion()}

        {renderWarningsAndSubmit()}

        {confirmOpen && (
          // Same sheet mechanism as the match screen's own player-tap/
          // injury sheets (mdSheet) — grab handle, scrim-dismiss, no ✕,
          // swipe-down-to-dismiss (useSheetDrag, extracted from MatchView.
          // jsx once this sheet needed the identical behavior — real-use
          // feedback: it looked like every other bottom sheet but didn't
          // swipe-dismiss like one), and (styles.js has the real-device
          // story) the same position:fixed/viewport-anchored positioning
          // too, not a locally-scoped absolute. Amber top border
          // (caution), not red (reserved for injury elsewhere in the app).
          <>
            <div style={styles.mdCautionSheetScrim} onClick={() => setConfirmOpen(false)} />
            <div
              style={{ ...styles.mdCautionSheet, ...confirmSheetDrag.dragStyle }}
              data-testid="rebuild-confirm-sheet"
            >
              <div {...confirmSheetDrag.dragHandleProps}>
                <div style={styles.mdSheetGrabHandle} />
                <div style={styles.mdCautionSheetHeaderRow}>
                  <span style={styles.mdCautionSheetIconBadge}>
                    <RotateIcon />
                  </span>
                  <div style={styles.mdCautionSheetTitle}>Today's game is running</div>
                </div>
              </div>
              <div style={styles.mdCautionSheetBody}>
                A new rotation plans from 0:00. The {fmtClock(elapsedSec)} already played stays on each child's minutes — only the
                plan from here changes.
              </div>
              <div style={styles.mdCautionSheetBtnRow}>
                {/* "Build Rotation" — shorter than the main submit
                    button's own "Build new rotation" on purpose now.
                    Real-use feedback: at this point the coach already
                    tapped "Build new rotation" to get here, so this is
                    just confirming that same action, not naming it fresh
                    — and the shorter label actually fits on one line at
                    this button's own width (flex 1.35 of the row), where
                    the longer phrase wrapped. */}
                <button
                  style={styles.mdCautionSheetBtnPrimary}
                  onClick={() => {
                    setConfirmOpen(false);
                    onSubmit();
                  }}
                >
                  Build Rotation
                </button>
                <button style={styles.mdCautionSheetBtnSecondary} onClick={() => setConfirmOpen(false)}>
                  Keep current
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // "inline" (A3) — first-time setup. Real-use feedback restructured this
  // whole layout ("needs a lot of care as this is the user's first
  // experience with the app"):
  //   1. Who's here comes first, always open — the actual first thing a
  //      coach does is say who showed up today, not stare at number tiles.
  //   2. Keepers next, its own dedicated moment for keeper eligibility
  //      (default: everyone eligible) — collapsed, so it doesn't compete
  //      with Who's here for attention, but surfaced well before First in
  //      goal today, which depends on it.
  //   3. Then the exact same tiles+accordion group "edit" (Game settings)
  //      uses, collapsed the same way, ending in the same green "Build
  //      new rotation" button — a first-time coach who finishes setup and
  //      later revisits Game settings should recognize the same screen,
  //      not have to learn two different layouts for one job.
  // Same flex-column wrapper as "edit" now too, so the submit button's
  // own margin-top:auto behaves identically on both — 100dvh, not 100vh,
  // for the same real-device reason "edit"'s own copy of this wrapper
  // explains in full.
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {header}

      {/* Real-use feedback, twice now: "a considerable amount of space
          between the header and the Who's here section" — this wrapper's
          own marginTop stacks with the header's own marginBottom (mdHeader
          or mdSubHeader, whichever this variant renders) since margins
          between flex children don't collapse, unlike normal block
          siblings. Trimmed again the second time, once actually measured
          (not just added up from the source numbers) — turned out "Set up
          new team" and "Set up next game" already matched each other
          exactly; the ask was really "both are too roomy," not "these two
          disagree." */}
      <div style={{ marginTop: 2 }}>
        <div style={styles.mdSetupHeaderInRow}>
          <div style={styles.mdSetupSectionTitle}>Who's here</div>
          <span style={styles.mdSetupInChip}>{availableIds.length} in</span>
          <span style={styles.mdSetupDropOutHint}>tap to drop out</span>
          {renderSelectAll()}
        </div>
        {renderSquadChips()}
      </div>

      {renderGameSettingsAccordion()}

      {renderWarningsAndSubmit()}
    </div>
  );
}
