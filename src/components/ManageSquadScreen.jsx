import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { styles } from "./styles.js";

// Reached only from Team & account's own "Manage squad" row. Real-use
// feedback: this used to be a pre-expanded section inside Game
// settings/new-team setup, but both of those screens dropped it entirely
// once the new Keepers section covered eligibility and Who's here already
// covered add/availability — all that was left there was squad number,
// name, and delete, none of which are really "set up today's game"
// concerns. This is the one durable home for those now, reachable any
// time, not tied to a specific game — same shape as Team & account's own
// team list above it (persistent data, not a per-game form).
//
// No keeper-eligible toggle here on purpose — that decision now only ever
// lives in the Keepers section (new-team setup / Set up next game / Game
// settings), not duplicated here too.
export default function ManageSquadScreen({ roster, numberOf, setPlayerNumber, renamePlayer, removePlayer, onClose }) {
  // One row's number editable at a time, same convention the old Manage
  // squad rows used (SquadSettingsForm.jsx) — blur or Enter commits,
  // Escape cancels.
  const [editingNumberId, setEditingNumberId] = useState(null);
  // Independent from editingNumberId — a coach could in principle want
  // both open on different rows at once, though in practice this is
  // always one field at a time too.
  const [editingNameId, setEditingNameId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");

  const commitNumber = (id, raw) => {
    const trimmed = raw.trim();
    setPlayerNumber(id, trimmed === "" ? null : Number(trimmed));
    setEditingNumberId(null);
  };

  const startRename = (p) => {
    setEditingNameId(p.id);
    setNameDraft(p.name);
  };

  const commitName = (id) => {
    // Blank stays uncommitted (renamePlayer itself already guards this,
    // same as the team-rename flow above it in Team & account) — just
    // close the field back up rather than reverting the draft, since
    // renamePlayer silently no-ops on blank anyway.
    renamePlayer(id, nameDraft);
    setEditingNameId(null);
  };

  return (
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Manage squad</div>
      </div>

      <div style={{ marginTop: 14 }}>
        {roster.length === 0 ? (
          <div style={styles.emptyState}>No players yet.</div>
        ) : (
          roster.map((p) => {
            const isEditingNumber = editingNumberId === p.id;
            const isEditingName = editingNameId === p.id;
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
                  <button style={styles.mdSetupNumberBadge} onClick={() => setEditingNumberId(p.id)} title="Set squad number">
                    {numberOf(p.id)}
                  </button>
                )}

                {isEditingName ? (
                  <input
                    autoFocus
                    style={styles.mdSetupInput}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => commitName(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName(p.id);
                      if (e.key === "Escape") setEditingNameId(null);
                    }}
                  />
                ) : (
                  <span style={styles.mdSetupRowName}>{p.name}</span>
                )}

                {!isEditingName && (
                  <button style={styles.mdTeamAcctIconBtn} onClick={() => startRename(p)} title="Rename player">
                    <Pencil size={14} />
                  </button>
                )}
                <button style={styles.mdSetupRemoveBtn} onClick={() => removePlayer(p.id)} title="Remove from squad">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
