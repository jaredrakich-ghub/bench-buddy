import { useState } from "react";
import { Pencil, Trash2, Plus, BarChart2, Shirt, User, LogOut } from "lucide-react";
import { styles, tokens } from "./styles.js";

// README > A8-Team-account (#10e) — "everything that is not match-day."
// Absorbs the old TeamSwitcher modal's team list/switch/rename/delete/add
// logic (kept as-is — this screen restyles it, it doesn't re-model it) and
// adds two rows that used to be direct cog-menu entries (Season data,
// Manage squad), now reached from here instead.
//
// Reached from the cog menu's existing "Switch team" row rather than a
// dedicated menu row — the README assumes the menu itself gets trimmed to
// make room for a "Team & account" row, but that trim is explicitly out of
// scope for now, so this rides on the entry point that already exists.
// "Season data"/"Manage squad" stay as their own direct cog-menu rows too
// (untouched) — reachable two ways until, if ever, the trim happens.
//
// "Delete my account" isn't in the README's A8 spec at all (the design's
// own Account group only shows Signed in / Sign out) but it's real,
// working functionality already in TeamSwitcher — kept here, appended
// under Sign out, rather than silently dropped because the mockup didn't
// happen to show it.
export default function TeamAccountScreen({
  teams, activeTeamId, onSwitch, onAdd, onRename, onDelete, onClose,
  userEmail, onSignOut, onDeleteAccount, onShowSeason, onShowSettings, crestSrc,
}) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [addName, setAddName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await onDeleteAccount();
      // No further UI to update on success — deleting the Firebase Auth
      // user fires onAuthChange(null), which AuthGate picks up and swaps
      // straight to the sign-in screen, unmounting this screen along with it.
    } catch (err) {
      setDeletingAccount(false);
      setDeleteAccountError(
        err?.code === "auth/popup-closed-by-user"
          ? "Sign-in was cancelled — your account was not deleted."
          : "Couldn't delete your account — check your connection and try again."
      );
    }
  };

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
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Team & account</div>
      </div>

      <div style={styles.mdPopoverGroup}>
        <div style={styles.mdPopoverGroupHeader}>
          <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.pitchGreen }} />
          <span style={styles.mdTeamAcctGroupLabel}>Your teams</span>
          <span style={styles.mdPopoverGroupRule} />
        </div>

        <div style={styles.mdTeamAcctList}>
          {teams.map((team) => {
            const isActive = team.id === activeTeamId;

            if (renamingId === team.id) {
              return (
                <div key={team.id} style={styles.mdTeamAcctCard}>
                  <div style={styles.mdTeamAcctInlineRow}>
                    <input
                      style={styles.mdTeamAcctInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(team.id)}
                      autoFocus
                    />
                    <button style={styles.mdTeamAcctBtnCancel} onClick={() => saveRename(team.id)}>
                      Save
                    </button>
                    <button style={styles.mdTeamAcctBtnCancel} onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            if (confirmDeleteId === team.id) {
              return (
                <div key={team.id} style={styles.mdTeamAcctConfirmCard}>
                  <span style={styles.mdTeamAcctConfirmText}>
                    Delete "{team.name}"? This removes their squad and game history.
                  </span>
                  <div style={styles.mdTeamAcctConfirmBtnRow}>
                    <button style={styles.mdTeamAcctBtnDanger} onClick={() => onDelete(team.id)}>
                      Yes, delete
                    </button>
                    <button style={styles.mdTeamAcctBtnCancel} onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={team.id}
                style={{ ...styles.mdTeamAcctCard, ...(isActive ? styles.mdTeamAcctCardActive : {}) }}
              >
                <button
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "transparent", border: "none", padding: 0, cursor: isActive ? "default" : "pointer", textAlign: "left", font: "inherit" }}
                  onClick={() => !isActive && onSwitch(team.id)}
                >
                  <div style={styles.mdTeamAcctCrest}>
                    {isActive ? (
                      crestSrc && <img src={crestSrc} alt="" style={styles.mdTeamAcctCrestImg} />
                    ) : (
                      <span style={styles.mdTeamAcctInitialDisc}>{team.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div style={styles.mdTeamAcctInfo}>
                    <div style={styles.mdTeamAcctName}>
                      {team.name}
                      {isActive && <span style={styles.mdTeamAcctTickDisc}>✓</span>}
                    </div>
                    <div style={styles.mdTeamAcctSubline}>{team.roster.length} players</div>
                  </div>
                </button>
                {!isActive && <span style={styles.mdPopoverRowChevron}>›</span>}
                <button style={styles.mdTeamAcctIconBtn} onClick={() => startRename(team)} title="Rename team">
                  <Pencil size={14} />
                </button>
                <button
                  style={styles.mdTeamAcctIconBtn}
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
          <div style={styles.mdTeamAcctInlineRow}>
            <input
              style={styles.mdTeamAcctInput}
              placeholder="Team name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              autoFocus
            />
            <button style={styles.mdTeamAcctBtnCancel} disabled={!addName.trim()} onClick={submitAdd}>
              Create
            </button>
            <button style={styles.mdTeamAcctBtnCancel} onClick={() => setShowAddInput(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button style={styles.mdTeamAcctAddCard} onClick={() => setShowAddInput(true)}>
            <Plus size={16} style={{ marginRight: 6 }} /> Add a team
          </button>
        )}
      </div>

      <div style={styles.mdPopoverGroup}>
        <div style={styles.mdPopoverGroupHeader}>
          <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.goldText }} />
          <span style={styles.mdTeamAcctGroupLabel}>Records</span>
          <span style={styles.mdPopoverGroupRule} />
        </div>
        <button style={styles.mdPopoverRow} onClick={onShowSeason}>
          <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintGreen }}>
            <BarChart2 size={16} color={tokens.color.pitchGreen} />
          </span>
          <span style={styles.mdPopoverRowLabel}>Season data</span>
          <span style={styles.mdPopoverRowChevron}>›</span>
        </button>
        <button style={styles.mdPopoverRow} onClick={onShowSettings}>
          <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintYellow }}>
            <Shirt size={16} color={tokens.color.deepGreen} />
          </span>
          <span style={styles.mdPopoverRowLabel}>Manage squad</span>
          <span style={styles.mdPopoverRowChevron}>›</span>
        </button>
      </div>

      <div style={styles.mdPopoverGroup}>
        <div style={styles.mdPopoverGroupHeader}>
          <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.chevron }} />
          <span style={styles.mdTeamAcctGroupLabel}>Account</span>
          <span style={styles.mdPopoverGroupRule} />
        </div>
        <button style={styles.mdPopoverRow} onClick={() => {}}>
          <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
            <User size={16} color={tokens.color.mutedText} />
          </span>
          <span style={styles.mdPopoverRowLabel}>Signed in</span>
          {userEmail && <span style={styles.mdPopoverRowValue}>{userEmail}</span>}
        </button>
        <button style={styles.mdPopoverRow} onClick={onSignOut}>
          <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
            <LogOut size={16} color={tokens.color.mutedText} />
          </span>
          <span style={styles.mdPopoverRowLabel}>Sign out</span>
        </button>

        {/* Not in the README's A8 spec — real existing functionality kept,
            not dropped. See the file-level comment above. */}
        {confirmDeleteAccount ? (
          <div style={{ ...styles.mdTeamAcctConfirmCard, marginTop: 8 }}>
            <span style={styles.mdTeamAcctConfirmText}>
              Delete your account? This permanently removes{" "}
              {teams.length === 1 ? "your team" : `all ${teams.length} of your teams`}, every squad, and all game
              history. This can't be undone.
            </span>
            <div style={styles.mdTeamAcctConfirmBtnRow}>
              <button style={styles.mdTeamAcctBtnDanger} onClick={handleDeleteAccount} disabled={deletingAccount}>
                {deletingAccount ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                style={styles.mdTeamAcctBtnCancel}
                onClick={() => setConfirmDeleteAccount(false)}
                disabled={deletingAccount}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            style={{ ...styles.mdPopoverRow, marginTop: 8 }}
            onClick={() => setConfirmDeleteAccount(true)}
          >
            <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintRed }}>
              <Trash2 size={16} color={tokens.color.injuryRed} />
            </span>
            <span style={{ ...styles.mdPopoverRowLabel, color: tokens.color.injuryRed }}>Delete my account</span>
          </button>
        )}
        {deleteAccountError && <div style={styles.modalWarning}>{deleteAccountError}</div>}
      </div>

      {/* Same footer text/version the cog menu already shows, for
          consistency across screens — the mockup's "v1.2" is placeholder
          copy from the design file, not this app's real version. */}
      <div style={styles.mdPopoverFooter}>
        Bench Buddy <span style={styles.mdPopoverFooterVersion}>v0.1.0</span>
      </div>
    </section>
  );
}
