import { useState } from "react";
import { Pencil, Trash2, Plus, Shirt, User, LogOut, Save } from "lucide-react";
import { styles, tokens } from "./styles.js";
import SaveTeamSheet from "./SaveTeamSheet.jsx";

// README > A8-Team-account (#10e) — "everything that is not match-day."
// Absorbs the old TeamSwitcher modal's team list/switch/rename/delete/add
// logic (kept as-is — this screen restyles it, it doesn't re-model it) and
// adds a "Manage squad" row, reached from here instead of a direct
// cog-menu entry. Season data lives only in the cog menu now (its own
// "Season Minutes" row, MatchView.jsx, real-use feedback moved it out of
// here entirely rather than keeping it reachable both ways).
//
// Reached from the cog menu's existing "Switch team" row rather than a
// dedicated menu row — the README assumes the menu itself gets trimmed to
// make room for a "Team & account" row, but that trim is explicitly out of
// scope for now, so this rides on the entry point that already exists.
//
// "Delete my account" isn't in the README's A8 spec at all (the design's
// own Account group only shows Signed in / Sign out) but it's real,
// working functionality already in TeamSwitcher — kept here, appended
// under Sign out, rather than silently dropped because the mockup didn't
// happen to show it.
//
// Progressive auth: also not in the README's A8 spec, since it predates
// anonymous sign-in entirely. For an anonymous session (isAnonymous),
// this same Account group's Signed in/Sign out pair is replaced by a
// single "Save your team" row instead — see SaveTeamSheet.jsx for what
// tapping it opens. Everything else on this screen is identical either
// way; "Delete my account" still deletes whichever kind of account is
// currently signed in, unchanged.
export default function TeamAccountScreen({
  teams, activeTeamId, onSwitch, onAdd, onRename, onDelete, onClose,
  userEmail, isAnonymous, onSignOut, onDeleteAccount, onShowManageSquad, crestSrc,
  onFieldPlayers, benchIds, nameOf, numberOf,
}) {
  // Progressive auth: an anonymous session's Account group offers "Save
  // your team" instead of Signed in/Sign out — see SaveTeamSheet.jsx for
  // the actual linking flow this opens. Local to this screen (like every
  // other sheet-open flag elsewhere in this app, e.g. MatchView's own
  // resetConfirmOpen) since nothing outside this screen needs to know.
  const [showSaveTeam, setShowSaveTeam] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [addName, setAddName] = useState("");
  // Real-use feedback: creating a team gave no sign anything was
  // happening -- the screen just sat there until the Firestore write came
  // back, which read as a hang on a slow connection. onAdd now resolves to
  // true/false (see addNewTeam in SubRotationPlanner.jsx); this flag drives
  // a "Creating…" state on the button meanwhile, and the input/screen only
  // clear on success -- on failure it stays put, typed name intact, so a
  // retry doesn't mean starting over, and the save-error banner (now
  // visible above every screen) explains what went wrong.
  const [creatingTeam, setCreatingTeam] = useState(false);
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

  const submitAdd = async () => {
    if (!addName.trim() || creatingTeam) return;
    setCreatingTeam(true);
    const ok = await onAdd(addName.trim());
    setCreatingTeam(false);
    if (ok) {
      setAddName("");
      setShowAddInput(false);
    }
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
              disabled={creatingTeam}
              autoFocus
            />
            <button style={styles.mdTeamAcctBtnCancel} disabled={!addName.trim() || creatingTeam} onClick={submitAdd}>
              {creatingTeam ? "Creating…" : "Create"}
            </button>
            <button style={styles.mdTeamAcctBtnCancel} disabled={creatingTeam} onClick={() => setShowAddInput(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button style={styles.mdTeamAcctAddCard} onClick={() => setShowAddInput(true)}>
            <Plus size={16} style={{ marginRight: 6 }} /> Add a team
          </button>
        )}

        {/* Real-use feedback: relocated here from its own row in the
            Account group below — sitting directly under "+ Add a team"
            groups it with the other "protect what you've built" action a
            coach is already looking at, rather than being tucked away in
            Account where they'd have to go looking for it. Renamed "Save
            your team" -> "Save Season Data" at the same time. Same
            onClick/SaveTeamSheet underneath, unanonymous coaches still
            never see this at all (isAnonymous-gated, same as before). */}
        {isAnonymous && (
          // Real-use feedback: the earlier ambient badges (on the cog
          // button itself, and again on the "Team & account" menu row —
          // MatchView.jsx) read as "too much before we've shown value" —
          // visible on every screen of every match, before a coach had
          // even finished a first game. Pulled both, in favor of a single
          // small dot right on this row's own icon tile — the coach has
          // already chosen to navigate into Team & account by the time
          // they'd ever see it, so it reads as "this needs you," not
          // "you're being nagged."
          <button style={{ ...styles.mdPopoverRow, marginTop: 8 }} onClick={() => setShowSaveTeam(true)}>
            <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintYellow, position: "relative" }}>
              <Save size={16} color={tokens.color.deepGreen} />
              <span style={styles.mdTeamAcctActionDot} />
            </span>
            <span style={styles.mdPopoverRowLabel}>Save Season Data</span>
            <span style={styles.mdPopoverRowChevron}>›</span>
          </button>
        )}
      </div>

      <div style={styles.mdPopoverGroup}>
        <div style={styles.mdPopoverGroupHeader}>
          <span style={{ ...styles.mdPopoverGroupDot, background: tokens.color.goldText }} />
          <span style={styles.mdTeamAcctGroupLabel}>Squad</span>
          <span style={styles.mdPopoverGroupRule} />
        </div>
        {/* Season data moved out of here entirely, real-use feedback —
            "take Season Minutes out of the Team & Account menu and put it
            below Minutes Today in the main menu." See MatchView.jsx's own
            cog menu, "Season Minutes" row. */}
        <button style={styles.mdPopoverRow} onClick={onShowManageSquad}>
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
        {isAnonymous ? (
          // The actual action moved to "Save Season Data" under "+ Add a
          // team" above — this is purely informational now (same
          // no-op-button pattern "Signed in" already uses below), so the
          // Account group doesn't just skip straight to Delete my account
          // with nothing explaining the anonymous state at all. Real-use
          // framing, not "not signed in" — the coach hasn't done anything
          // wrong; their team already works exactly as it should on this
          // device.
          <button style={styles.mdPopoverRow} onClick={() => {}}>
            <span style={{ ...styles.mdPopoverRowIconTile, ...styles.mdTintNeutral }}>
              <User size={16} color={tokens.color.mutedText} />
            </span>
            <span style={styles.mdPopoverRowLabel}>Playing as a guest</span>
          </button>
        ) : (
          <>
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
          </>
        )}

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

      {showSaveTeam && (
        <SaveTeamSheet
          onFieldPlayers={onFieldPlayers}
          benchIds={benchIds}
          nameOf={nameOf}
          numberOf={numberOf}
          onClose={() => setShowSaveTeam(false)}
        />
      )}
    </section>
  );
}
