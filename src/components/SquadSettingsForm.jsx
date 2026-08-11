import { Plus, Trash2, Shuffle } from "lucide-react";
import { computeIntervals, keeperShiftIntervalsFor } from "../lib/rotation.js";
import { validateGameSettings } from "../lib/validation.js";
import { styles } from "./styles.js";

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
  showRestartWarning,
  onSubmit,
  submitLabel,
}) {
  const validation = validateGameSettings(gameSettings, availableIds.length);

  return (
    <>
      <div style={styles.settingsGrid}>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Players on field</span>
          <input
            type="number"
            min={2}
            style={styles.numInput}
            value={gameSettings.fieldSize}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, fieldSize: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, fieldSize: 5 });
            }}
          />
        </label>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Game length (min)</span>
          <input
            type="number"
            min={5}
            style={styles.numInput}
            value={gameSettings.gameMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, gameMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, gameMinutes: 40 });
            }}
          />
        </label>
        <label style={styles.settingLabel}>
          <span style={styles.settingLabelText}>Sub every (min)</span>
          <input
            type="number"
            min={2}
            step={0.5}
            style={styles.numInput}
            value={gameSettings.subIntervalMinutes}
            onChange={(e) => {
              const v = e.target.value;
              setGameSettings({ ...gameSettings, subIntervalMinutes: v === "" ? "" : Number(v) });
            }}
            onBlur={(e) => {
              if (e.target.value === "") setGameSettings({ ...gameSettings, subIntervalMinutes: 6 });
            }}
          />
        </label>
      </div>

      <label style={{ ...styles.settingLabel, marginTop: 12, maxWidth: 220 }}>
        <span style={styles.settingLabelText}>Keeper shift (min)</span>
        <input
          type="number"
          min={gameSettings.subIntervalMinutes || 2}
          step={0.5}
          style={styles.numInput}
          placeholder={`Same as sub (${gameSettings.subIntervalMinutes || "?"})`}
          value={gameSettings.keeperShiftMinutes ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setGameSettings({ ...gameSettings, keeperShiftMinutes: v === "" ? "" : Number(v) });
          }}
        />
      </label>
      <div style={styles.modeHint}>Leave blank to rotate keepers every sub window.</div>

      <div style={styles.intervalPreview}>
        {(() => {
          const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
          const shiftIntervals = keeperShiftIntervalsFor(gameSettings.subIntervalMinutes || 1, gameSettings.keeperShiftMinutes);
          const preview = `≈ ${intervalLen.toFixed(1)} min per interval · ${numIntervals} sub windows this game`;
          return shiftIntervals > 1
            ? `${preview} · keeper changes every ${shiftIntervals} sub windows (~${(shiftIntervals * intervalLen).toFixed(0)} min)`
            : preview;
        })()}
      </div>

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

      <div style={styles.addRow}>
        <input
          style={styles.input}
          placeholder="Add player name"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPlayer()}
        />
        <button style={styles.primaryBtn} onClick={addPlayer}>
          <Plus size={16} /> Add
        </button>
      </div>

      {roster.length > 0 && (
        <div style={styles.modeHint}>Tap 🧤 to mark who can play keeper.</div>
      )}

      <div style={styles.squadList}>
        {roster.length === 0 && <div style={styles.emptyState}>No players yet. Add your squad above.</div>}
        {roster.map((p) => {
          const availIdx = availableIds.indexOf(p.id);
          const isAvailable = availIdx !== -1;
          return (
            <div key={p.id} style={styles.squadRow}>
              <button
                style={{ ...styles.numberBadge, ...(isAvailable ? styles.numberBadgeActive : {}) }}
                onClick={() => toggleAvailable(p.id)}
                title="Toggle available today"
              >
                {isAvailable ? availIdx + 1 : ""}
              </button>
              <span style={styles.squadName}>{p.name}</span>
              <button
                style={{ ...styles.gloveToggle, ...(p.keeperEligible ? styles.gloveToggleActive : {}) }}
                onClick={() => toggleKeeperEligible(p.id)}
                title="Toggle keeper-eligible"
              >
                🧤
              </button>
              <button style={styles.iconBtn} onClick={() => removePlayer(p.id)} title="Remove from squad">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {showRestartWarning && (
        <div style={styles.modalWarning}>This will restart the rotation from 0:00 and clear this game's progress so far.</div>
      )}

      {!validation.valid && (
        <div style={styles.modalWarning}>
          {validation.errors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      )}

      <button
        style={{ ...styles.primaryBtn, marginTop: 20, opacity: validation.valid ? 1 : 0.5 }}
        disabled={!validation.valid}
        onClick={onSubmit}
      >
        <Shuffle size={16} /> {submitLabel}
      </button>
    </>
  );
}
