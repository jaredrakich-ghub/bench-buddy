import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Shuffle, Play, Check } from "lucide-react";
import {
  computeIntervals, keeperShiftIntervalsFor, generatePlan, computeFairnessSpread, isFairSpread, recommendSubIntervals,
} from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { styles, tokens } from "./styles.js";

// A fixed, small set of realistic choices — matches what a coach would
// actually consider typing, not an exhaustive search. Kept as a module
// constant so its identity is stable across renders (it's a useMemo dep).
const SUB_INTERVAL_CANDIDATES = [4, 5, 6, 7, 8];

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

// Shared form for both first-time setup (inline) and later edits (modal).
// This also doubles as squad management — add, remove, mark available, and
// mark keeper-eligible — all in one place, since in practice a coach
// touches all of this together when setting up a game.
//
// The old manual "Backup & restore" text-export panel was removed once
// Firestore sync landed — that was the workaround for data living only in
// one browser, which is exactly what a real account now solves properly.
//
// This is a genuinely large component because it's a genuinely multi-purpose
// form. If it keeps growing, splitting the squad list into its own
// component would be a reasonable next step — not done now to avoid
// over-fragmenting for a modest reduction in size (see the Phase 4
// architecture notes).
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
  showRestartWarning,
  onSubmit,
  submitLabel,
  startingGkId,
  setStartingGkId,
}) {
  const validation = validateGameSettings(gameSettings, availableIds.length);

  const keeperEligibleIds = useMemo(() => roster.filter((p) => p.keeperEligible).map((p) => p.id), [roster]);

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
  // today (i.e. before "select at least fieldSize+1 available players" is
  // satisfied), so this never judges an in-progress, not-yet-final headcount
  // as the coach is still ticking availability. It DOES keep recomputing
  // live as that count changes after that point, same as everything else on
  // this screen — the "For today's N available players" label makes that
  // obviously intentional rather than a flicker.
  const subIntervalRecs = useMemo(() => {
    if (!validation.valid) return null;
    return recommendSubIntervals({
      candidateMinutes: SUB_INTERVAL_CANDIDATES,
      gameMinutes: gameSettings.gameMinutes,
      fieldSize: gameSettings.fieldSize,
      availableIds,
      keeperEligibleIds,
    });
  }, [validation.valid, gameSettings.gameMinutes, gameSettings.fieldSize, availableIds, keeperEligibleIds]);

  // Which player's squad-number badge is currently a live input — purely
  // transient UI state, same "one thing open at a time" shape as the
  // match screen's own menuPlayerId. Committed on blur/Enter; emptying it
  // clears the number back to unset rather than leaving a stale 0/NaN.
  const [editingNumberId, setEditingNumberId] = useState(null);
  const commitNumber = (id, raw) => {
    const trimmed = raw.trim();
    setPlayerNumber(id, trimmed === "" ? null : Number(trimmed));
    setEditingNumberId(null);
  };

  return (
    <>
      <div style={styles.settingsGrid}>
        <div style={styles.mdSetupTile}>
          <span style={styles.mdSetupTileLabel}>Players on field</span>
          <input
            type="number"
            min={2}
            style={styles.mdSetupTileInput}
            value={gameSettings.fieldSize}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, fieldSize: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, fieldSize: 5 });
            }}
          />
        </div>
        <div style={styles.mdSetupTile}>
          <span style={styles.mdSetupTileLabel}>Game length (min)</span>
          <input
            type="number"
            min={5}
            style={styles.mdSetupTileInput}
            value={gameSettings.gameMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, gameMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, gameMinutes: 40 });
            }}
          />
        </div>
        <div style={styles.mdSetupTile}>
          <span style={styles.mdSetupTileLabel}>Sub every (min)</span>
          <input
            type="number"
            min={2}
            step={0.5}
            style={styles.mdSetupTileInput}
            value={gameSettings.subIntervalMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, subIntervalMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, subIntervalMinutes: 6 });
            }}
          />
        </div>
      </div>

      <div style={styles.mdSetupSectionLabel}>Keeper shift (min)</div>
      <div style={{ ...styles.mdSetupTile, maxWidth: 160, textAlign: "left" }}>
        <input
          type="number"
          min={gameSettings.subIntervalMinutes || 2}
          step={0.5}
          style={{ ...styles.mdSetupTileInput, textAlign: "left" }}
          placeholder={`Same as sub (${gameSettings.subIntervalMinutes || "?"})`}
          value={gameSettings.keeperShiftMinutes ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setGameSettings({ ...gameSettings, keeperShiftMinutes: v === "" ? "" : Number(v) });
          }}
        />
      </div>
      <div style={styles.mdSetupHint}>Leave blank to rotate keepers every sub window.</div>

      <div style={styles.mdSetupSectionLabel}>Breaks</div>
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
      <div style={styles.mdSetupHint}>
        Just a visual grouping on the match screen for your own planning — doesn't change how the rotation itself is
        worked out.
      </div>

      <div style={styles.mdSetupHint}>
        {(() => {
          const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
          const shiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes || 1, gameSettings.keeperShiftMinutes);
          const preview = `≈ ${intervalLen.toFixed(1)} min per interval · ${numIntervals} sub windows this game`;
          return shiftIntervals > 1
            ? `${preview} · keeper changes every ${shiftIntervals} sub windows (~${(shiftIntervals * intervalLen).toFixed(0)} min)`
            : preview;
        })()}
      </div>

      {subIntervalRecs && (
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
      )}

      <div style={styles.subTitleRow}>
        <h3 style={styles.subTitle}>Squad &amp; availability</h3>
        <span style={styles.countBadge}>{availableIds.length} available</span>
        {roster.length > 0 && (
          <button
            style={styles.selectAllBtn}
            onClick={() => setAvailableIds(availableIds.length === roster.length ? [] : roster.map((p) => p.id))}
          >
            {availableIds.length === roster.length ? "Clear all" : "Select all"}
          </button>
        )}
      </div>

      <div style={styles.mdSetupAddRow}>
        <input
          style={styles.mdSetupInput}
          placeholder="Add player name"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
        />
        <button style={styles.mdSetupAddBtn} onClick={addPlayer}>
          <Plus size={16} /> Add
        </button>
      </div>

      {roster.length > 0 && (
        <div style={styles.mdSetupHint}>
          Tap a player's number to set their squad number. Tap 🧤 to mark who can play keeper, ▶ to start them in goal today.
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {roster.length === 0 && <div style={styles.emptyState}>No players yet. Add your squad above.</div>}
        {roster.map((p) => {
          const isAvailable = availableIds.includes(p.id);
          const isEditingNumber = editingNumberId === p.id;
          return (
            <div key={p.id} style={styles.mdSetupRow}>
              <button
                style={{ ...styles.mdSetupToggle, ...(isAvailable ? styles.mdSetupToggleActive : {}), background: tokens.color.pitchGreen, color: "#fff" }}
                onClick={() => toggleAvailable(p.id)}
                title={isAvailable ? "Available today — tap to mark unavailable" : "Not available today — tap to include"}
              >
                {isAvailable && <Check size={16} />}
              </button>
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
              {isAvailable && p.keeperEligible && (
                <button
                  style={{
                    ...styles.mdSetupToggle,
                    ...(startingGkId === p.id ? { ...styles.mdSetupToggleActive, background: tokens.color.pitchGreen, color: "#fff" } : {}),
                  }}
                  onClick={() => setStartingGkId(startingGkId === p.id ? null : p.id)}
                  title={startingGkId === p.id ? "Cancel — don't start in goal" : "Start this player in goal"}
                >
                  <Play size={14} />
                </button>
              )}
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
        })}
      </div>

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
