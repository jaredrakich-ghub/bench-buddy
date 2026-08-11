import { useState } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { styles } from "./styles.js";

// "My Teams" modal: switch between teams, rename or delete one, or add a
// new one. Mirrors the app's existing modal/confirm-row patterns (same
// styles used for the backup-restore confirmation) rather than introducing
// a new interaction style.
export default function TeamSwitcher({ teams, activeTeamId, onSwitch, onAdd, onRename, onDelete, onClose, userEmail, onSignOut }) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [addName, setAddName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startRename = (team) => {
    setConfirmDeleteId(null);
    setRenamingId(team.id);
    setRenameValue(team.name);
  };

  const saveRename = (id) => {
    onRename(id, renameValue);
    setRenamingId(null);
  };

  const submitAdd = () => {
    if (!addName.trim()) return;
    onAdd(addName.trim());
    setAddName("");
    setShowAddInput(false);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>My Teams</h3>
          <button style={styles.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.teamList}>
          {teams.map((team) => {
            const isActive = team.id === activeTeamId;

            if (renamingId === team.id) {
              return (
                <div key={team.id} style={styles.teamRow}>
                  <input
                    style={styles.input}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(team.id)}
                    autoFocus
                  />
                  <button style={styles.backupBtn} onClick={() => saveRename(team.id)}>
                    Save
                  </button>
                  <button style={styles.backupCancelBtn} onClick={() => setRenamingId(null)}>
                    Cancel
                  </button>
                </div>
              );
            }

            if (confirmDeleteId === team.id) {
              return (
                <div key={team.id} style={styles.backupConfirmRow}>
                  <span style={styles.backupHint}>Delete "{team.name}"? This removes their squad and game history.</span>
                  <button style={styles.backupConfirmBtn} onClick={() => onDelete(team.id)}>
                    Yes, delete
                  </button>
                  <button style={styles.backupCancelBtn} onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </button>
                </div>
              );
            }

            return (
              <div key={team.id} style={styles.teamRow}>
                <button
                  style={{ ...styles.teamRowBtn, ...(isActive ? styles.teamRowBtnActive : {}) }}
                  onClick={() => !isActive && onSwitch(team.id)}
                >
                  <span>
                    {isActive ? "✓ " : ""}
                    {team.name}
                  </span>
                  <span style={styles.teamRowMeta}>{team.roster.length} players</span>
                </button>
                <button style={styles.iconBtn} onClick={() => startRename(team)} title="Rename team">
                  <Pencil size={14} />
                </button>
                <button
                  style={styles.iconBtn}
                  onClick={() => setConfirmDeleteId(team.id)}
                  disabled={teams.length <= 1}
                  title={teams.length <= 1 ? "Can't delete your only team" : "Delete team"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {showAddInput ? (
          <div style={styles.addRow}>
            <input
              style={styles.input}
              placeholder="Team name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              autoFocus
            />
            <button style={styles.primaryBtn} disabled={!addName.trim()} onClick={submitAdd}>
              Create
            </button>
            <button style={styles.backupCancelBtn} onClick={() => setShowAddInput(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button style={styles.primaryBtn} onClick={() => setShowAddInput(true)}>
            <Plus size={16} /> Add Team
          </button>
        )}

        <button style={styles.backupToggle} onClick={onSignOut}>
          Sign out {userEmail ? `(${userEmail})` : ""}
        </button>
      </div>
    </div>
  );
}
