import { Plus, Trash2, Shuffle } from "lucide-react";
import { computeIntervals } from "../lib/rotation.js";
import { styles } from "./styles.js";

// Shared form for both first-time setup (inline) and later edits (modal).
// This also doubles as squad management — add, remove, mark available, and
// mark keeper-eligible, plus backup/restore — all in one place, since in
// practice a coach touches all of this together when setting up a game.
//
// This is a genuinely large component because it's a genuinely multi-purpose
// form. If it keeps growing, splitting the squad list and backup panel into
// their own components would be a reasonable next step — not done now to
// avoid over-fragmenting for a modest reduction in size (see the Phase 4
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
  showBackupPanel,
  setShowBackupPanel,
  exportText,
  handleCopyExport,
  copyStatus,
  importText,
  setImportText,
  importConfirming,
  setImportConfirming,
  importStatus,
  runImport,
  showRestartWarning,
  onSubmit,
  submitLabel,
}) {
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
      <div style={styles.intervalPreview}>
        {(() => {
          const { numIntervals, intervalLen } = computeIntervals(gameSettings.gameMinutes || 1, gameSettings.subIntervalMinutes || 1);
          return `≈ ${intervalLen.toFixed(1)} min per interval · ${numIntervals} sub windows this game`;
        })()}
      </div>

      <div style={styles.modeBlock}>
        <span style={styles.settingLabelText}>Rotation mode</span>
        <div style={styles.modeToggleRow}>
          <button
            style={{ ...styles.modeBtn, ...(gameSettings.mode !== "split" ? styles.modeBtnActive : {}) }}
            onClick={() => setGameSettings({ ...gameSettings, mode: "combined" })}
          >
            Combined
          </button>
          <button
            style={{ ...styles.modeBtn, ...(gameSettings.mode === "split" ? styles.modeBtnActive : {}) }}
            onClick={() => setGameSettings({ ...gameSettings, mode: "split" })}
          >
            Split: Outfield + Keepers
          </button>
        </div>
        <div style={styles.modeHint}>
          {gameSettings.mode === "split"
            ? "Keeper duty rotates only among players marked 🧤 below, separately from outfield rotation."
            : "Anyone on the field can be picked for a turn in goal."}
        </div>
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

      <button style={styles.backupToggle} onClick={() => setShowBackupPanel((v) => !v)}>
        {showBackupPanel ? "Hide" : "Backup & restore squad"}
      </button>

      {showBackupPanel && (
        <div style={styles.backupPanel}>
          <div style={styles.backupSubTitle}>Export</div>
          <p style={styles.backupHint}>Copy this text somewhere safe (notes app, email to yourself) to restore your squad later.</p>
          <textarea style={styles.backupTextarea} readOnly value={exportText} onClick={(e) => e.target.select()} />
          <button style={styles.backupBtn} onClick={handleCopyExport}>
            Copy backup text
          </button>
          {copyStatus && <div style={styles.backupStatus}>{copyStatus}</div>}

          <div style={{ ...styles.backupSubTitle, marginTop: 18 }}>Import</div>
          <p style={styles.backupHint}>Paste a previously copied backup below to restore it. This replaces your current squad.</p>
          <textarea
            style={styles.backupTextarea}
            placeholder="Paste backup text here"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportConfirming(false);
            }}
          />
          {!importConfirming ? (
            <button style={styles.backupBtn} disabled={!importText.trim()} onClick={() => setImportConfirming(true)}>
              Restore from backup
            </button>
          ) : (
            <div style={styles.backupConfirmRow}>
              <span style={styles.backupHint}>This replaces your current squad — are you sure?</span>
              <button style={styles.backupConfirmBtn} onClick={runImport}>
                Yes, replace it
              </button>
              <button style={styles.backupCancelBtn} onClick={() => setImportConfirming(false)}>
                Cancel
              </button>
            </div>
          )}
          {importStatus && <div style={styles.backupStatus}>{importStatus}</div>}
        </div>
      )}

      {showRestartWarning && (
        <div style={styles.modalWarning}>This will restart the rotation from 0:00 and clear this game's progress so far.</div>
      )}

      <button
        style={{ ...styles.primaryBtn, marginTop: 20, opacity: availableIds.length < 2 ? 0.5 : 1 }}
        disabled={availableIds.length < 2}
        onClick={onSubmit}
      >
        <Shuffle size={16} /> {submitLabel}
      </button>
    </>
  );
}
