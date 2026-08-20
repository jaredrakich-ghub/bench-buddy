import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Shuffle } from "lucide-react";
import {
  computeIntervals, computeBreakBoundaries, keeperShiftIntervalsFor, generatePlan, computeFairnessSpread, isFairSpread,
  recommendSubIntervals,
} from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { styles, tokens } from "./styles.js";

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

const TILE_ORDER = [
  { key: "fieldSize", label: "on pitch", min: 2, step: 1 },
  { key: "gameMinutes", label: "minutes", min: 5, step: 5 },
  { key: "subIntervalMinutes", label: "sub every", min: 2, step: 1 },
];

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
// This also doubles as squad management — add, remove, assign a squad
// number, mark keeper-eligible — same as before. The design's own squad
// section is just a flat list of name chips with no room for any of that,
// so rather than drop real, working functionality to match the mockup
// literally, availability now lives on the chip row itself (tap to drop
// out, matching the design) and everything else (number, keeper-eligible,
// remove) stays as a trimmed detail-row list underneath, headed "Manage
// squad" so its purpose next to the quick chip row above is clear.
//
// Keeper eligibility itself: the design's "In goal today" chips look like
// three states (starting / included / not included), but this app only
// ever had two real keeper-related fields — a permanent per-player
// `keeperEligible` flag and a per-game `startingGkId` pick. Rather than add
// a third, this-game-only "in the pool today" concept, the "In goal today"
// list only ever shows players who are already keeper-eligible (tap =
// pick/un-pick as today's starter); granting or revoking eligibility
// itself stays a deliberate, permanent action via 🧤 in the squad list
// below. Confirmed with the user: reuse the existing flag rather than
// build new per-game state, since a coach visits this screen every single
// game and would see (and could fix) a stale "permanent" exclusion right
// away, not lose track of it.
export default function SquadSettingsForm({
  roster,
  gameSettings,
  setGameSettings,
  availableIds,
  setAvailableIds,
  newPlayerName,
  setNewPlayerName,
  addPlayer,
  removePlayer,
  toggleAvailable,
  toggleKeeperEligible,
  setPlayerNumber,
  numberOf,
  showRestartWarning,
  onSubmit,
  submitLabel,
  startingGkId,
  setStartingGkId,
  variant = "inline",
  title = "Today's game",
  onClose,
}) {
  const validation = validateGameSettings(gameSettings, availableIds.length);

  const keeperEligibleIds = useMemo(() => roster.filter((p) => p.keeperEligible).map((p) => p.id), [roster]);
  const inGoalCandidates = useMemo(
    () => roster.filter((p) => availableIds.includes(p.id) && p.keeperEligible),
    [roster, availableIds]
  );

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
  const [expandedSection, setExpandedSection] = useState(null); // "goal" | "swaps" | "breaks" | null
  const [showAddChip, setShowAddChip] = useState(false);
  const [editingNumberId, setEditingNumberId] = useState(null);

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

  const commitNumber = (id, raw) => {
    const trimmed = raw.trim();
    setPlayerNumber(id, trimmed === "" ? null : Number(trimmed));
    setEditingNumberId(null);
  };

  const submitAddChip = () => {
    if (!newPlayerName.trim()) return;
    addPlayer();
    setShowAddChip(false);
  };

  // ---- Shared pieces --------------------------------------------------

  function renderTiles() {
    return (
      <div style={styles.settingsGrid}>
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
    if (currentRec) {
      return (
        <div style={{ ...styles.mdSetupHint, color: currentRec.fair ? tokens.color.pitchGreen : styles.mdSetupHint.color }}>
          {currentRec.numIntervals} sub windows · {currentRec.fair ? `fairest for ${availableIds.length} players` : `up to ${Math.round(currentRec.bestSpread)} min apart today`}
        </div>
      );
    }
    const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
    return <div style={styles.mdSetupHint}>≈ {intervalLen.toFixed(1)} min per interval · {numIntervals} sub windows this game</div>;
  }

  // Not part of the design file at all (it only shows the current sub
  // interval's own fairness, not a picker) — kept from the original form
  // rather than dropped, same reasoning as Manage squad below: this is
  // real, working functionality the mockup just didn't happen to depict.
  function renderSubIntervalRecs() {
    if (!subIntervalRecs) return null;
    return (
      <>
        <div style={styles.mdSetupHint}>
          For today's {availableIds.length} available players — tap a fairer sub interval, or keep what you've got:
        </div>
        <div style={styles.mdSetupChipRow}>
          {subIntervalRecs.map((r) => {
            const isSelected = Number(gameSettings.subIntervalMinutes) === r.subIntervalMinutes;
            return (
              <button
                key={r.subIntervalMinutes}
                style={{
                  ...styles.mdSetupChip,
                  ...(r.fair ? styles.mdSetupChipFair : {}),
                  ...(isSelected ? styles.mdSetupChipActive : {}),
                }}
                onClick={() => setGameSettings({ ...gameSettings, subIntervalMinutes: r.subIntervalMinutes })}
                title={
                  r.fair
                    ? `${r.subIntervalMinutes} min subs keeps everyone within about one interval of each other today.`
                    : `${r.subIntervalMinutes} min subs could leave some players up to ${Math.round(r.bestSpread)} min behind others today, even with the fairest possible starting keeper.`
                }
              >
                {r.fair ? "✓" : "✗"} {r.subIntervalMinutes}
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
          No keeper-eligible players available today — mark someone 🧤 in Manage squad below.
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
          <button style={styles.mdSetupAddChip} onClick={() => setShowAddChip((v) => !v)}>
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

  // Trimmed from the original all-in-one row: availability and
  // starting-keeper moved to the chip rows above, so each row here is just
  // number / name / keeper-eligible / remove.
  function renderManageSquadRows() {
    if (roster.length === 0) return <div style={styles.emptyState}>No players yet — add your squad above.</div>;
    return roster.map((p) => {
      const isEditingNumber = editingNumberId === p.id;
      return (
        <div key={p.id} style={styles.mdSetupRow}>
          {isEditingNumber ? (
            <input
              autoFocus
              type="number"
              style={styles.mdSetupNumberInput}
              defaultValue={p.number ?? ""}
              onBlur={(e) => commitNumber(p.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNumber(p.id, e.target.value);
                if (e.key === "Escape") setEditingNumberId(null);
              }}
            />
          ) : (
            <button
              style={{ ...styles.mdSetupNumberBadge, ...(p.number != null ? styles.mdSetupNumberBadgeSet : {}) }}
              onClick={() => setEditingNumberId(p.id)}
              title="Set squad number"
            >
              {p.number ?? "–"}
            </button>
          )}
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
          <button style={styles.mdSetupRemoveBtn} onClick={() => removePlayer(p.id)} title="Remove from squad">
            <Trash2 size={14} />
          </button>
        </div>
      );
    });
  }

  function renderWarningsAndSubmit() {
    return (
      <>
        {showRestartWarning && (
          <div style={styles.mdSetupWarning}>This will restart the rotation from 0:00 and clear this game's progress so far.</div>
        )}
        {fairnessWarning && <div style={styles.mdSetupWarning}>{fairnessWarning}</div>}
        {!validation.valid && (
          <div style={styles.mdSetupWarning}>
            {validation.errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        )}
        <button style={{ ...styles.mdSetupSubmitBtn, opacity: validation.valid ? 1 : 0.5 }} disabled={!validation.valid} onClick={onSubmit}>
          <Shuffle size={16} /> {submitLabel}
        </button>
      </>
    );
  }

  // ---- Layouts ----------------------------------------------------------

  const header = (
    <div style={styles.mdSetupHeaderRow}>
      <div style={styles.mdSetupTitle}>{title}</div>
      {onClose && (
        <button style={styles.mdSetupCloseBtn} onClick={onClose} title="Close">
          ✕
        </button>
      )}
    </div>
  );

  if (variant === "edit") {
    return (
      <>
        {header}

        <div style={styles.mdSetupHeaderInRow}>
          <div style={styles.mdSetupSectionTitle}>Who's here?</div>
          <span style={styles.mdSetupInChip}>{availableIds.length} in</span>
          <span style={styles.mdSetupDropOutHint}>tap to drop out</span>
          {renderSelectAll()}
        </div>
        {renderSquadChips()}

        <div style={{ ...styles.mdSetupSectionTitle, marginTop: 22, marginBottom: 11 }}>The game</div>
        {renderTiles()}
        {renderIntervalPreview()}
        {renderSubIntervalRecs()}

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
          {expandedSection === "goal" ? (
            <div style={{ ...styles.mdSetupCard, ...styles.mdSetupCardDark }}>
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={{ ...styles.mdSetupCardTitle, ...styles.mdSetupCardTitleOnDark }}>In goal today</div>
                <span style={{ ...styles.mdSetupCardHint, ...styles.mdSetupCardHintOnDark }}>
                  {startingGkId ? `${roster.find((p) => p.id === startingGkId)?.name} starts` : "Random"}
                </span>
                <span
                  style={styles.mdSetupCardChevronOnDark}
                  onClick={() => setExpandedSection(null)}
                  role="button"
                  tabIndex={0}
                >
                  ⌄
                </span>
              </div>
              <div style={{ marginTop: 12 }}>{renderInGoalChips(true)}</div>
              <div style={styles.mdSetupCardCaptionOnDark}>Tap a name to pick who starts in goal today.</div>
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("goal")}>
              <span style={styles.mdSetupAccordionLabel}>In goal today</span>
              <span style={styles.mdSetupAccordionValue}>
                {startingGkId ? `${roster.find((p) => p.id === startingGkId)?.name} starts` : "Random"}
              </span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}

          {expandedSection === "swaps" ? (
            <div style={{ ...styles.mdSetupCard, ...styles.mdSetupCardDark }}>
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={{ ...styles.mdSetupCardTitle, ...styles.mdSetupCardTitleOnDark }}>Keeper swaps</div>
                {renderKeeperSwapStepper(true)}
              </div>
              <div style={styles.mdSetupCardCaptionOnDark}>Leave at the sub length to rotate keepers every window.</div>
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("swaps")}>
              <span style={styles.mdSetupAccordionLabel}>Keeper swaps</span>
              <span style={styles.mdSetupAccordionValue}>Every {keeperSwapValue}′</span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}

          {expandedSection === "breaks" ? (
            <div style={styles.mdSetupCard}>
              <div style={styles.mdSetupCardHeaderRow}>
                <div style={styles.mdSetupCardTitle}>Breaks</div>
                <span style={styles.mdSetupAccordionChevron} onClick={() => setExpandedSection(null)} role="button" tabIndex={0}>
                  ⌄
                </span>
              </div>
              <div style={{ marginTop: 11 }}>{renderBreaksChips()}</div>
              {renderBreaksBar()}
            </div>
          ) : (
            <button style={styles.mdSetupAccordionRow} onClick={() => setExpandedSection("breaks")}>
              <span style={styles.mdSetupAccordionLabel}>Breaks</span>
              <span style={styles.mdSetupAccordionValue}>{BREAK_OPTIONS.find((o) => o.segments === (gameSettings.breakSegments || 1))?.label}</span>
              <span style={styles.mdSetupAccordionChevron}>›</span>
            </button>
          )}
        </div>

        <div style={{ ...styles.mdSetupSectionTitle, fontSize: 18, marginTop: 22, marginBottom: 8 }}>Manage squad</div>
        <div>{renderManageSquadRows()}</div>

        {renderWarningsAndSubmit()}
      </>
    );
  }

  // "inline" (A3) — everything open.
  return (
    <>
      {header}

      {renderTiles()}
      {renderIntervalPreview()}
      {renderSubIntervalRecs()}

      <div style={{ ...styles.mdSetupCard, marginTop: 14 }}>
        <div style={styles.mdSetupCardHeaderRow}>
          <div style={styles.mdSetupCardTitle}>In goal today</div>
          <span style={styles.mdSetupCardHint}>👑 starts</span>
        </div>
        <div style={{ marginTop: 11 }}>{renderInGoalChips(false)}</div>
        <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 10, borderTop: `2px solid ${tokens.color.creamDeep}`, paddingTop: 10 }}>
          <span style={styles.mdSetupAccordionLabel}>Swap every</span>
          {renderKeeperSwapStepper(false)}
        </div>
      </div>

      <div style={styles.mdSetupCard}>
        <div style={styles.mdSetupCardTitle}>Breaks</div>
        <div style={{ marginTop: 11 }}>{renderBreaksChips()}</div>
        {renderBreaksBar()}
      </div>

      <div style={styles.mdSetupHeaderInRow}>
        <div style={styles.mdSetupSectionTitle}>Squad</div>
        <span style={styles.mdSetupInChip}>{availableIds.length} in</span>
        <span style={styles.mdSetupDropOutHint}>tap to drop out</span>
        {renderSelectAll()}
      </div>
      {renderSquadChips()}

      <div style={{ ...styles.mdSetupSectionTitle, fontSize: 18, marginTop: 22, marginBottom: 8 }}>Manage squad</div>
      <div>{renderManageSquadRows()}</div>

      {renderWarningsAndSubmit()}
    </>
  );
}
