import { useState } from "react";
import { Plus } from "lucide-react";
import { styles, tokens } from "./styles.js";

// README > A7-Squad-change (#10d) — "a child arrived late or left early.
// This is the only reason the screen gets opened." Full-screen takeover
// (same mdFullScreenTakeoverOuter/Inner wrapper as every other non-match
// screen), reached from MatchView's cog menu "Who's here" row (renamed
// from "Squad change" to match this screen's own header exactly), which
// used to open the destructive Save & Regenerate flow (SquadSettingsForm)
// instead — that row now points here. Wired to the addArrival/
// removeAvailability hook functions (useMatchState.js), which rebuild only
// the remainder of the plan from right now — the clock and everything
// already played stay untouched, unlike Save & Regenerate.
//
// Tap-to-select before committing isn't in the README's own spec (which
// only describes the two resting card states) — added because a single
// unconfirmed tap felt too easy to fire by accident, especially for
// pulling someone off the pitch mid-game. One player selected at a time;
// the action bar's button always names who and what it's about to do.
//
// "+ Player" (not in the README's own spec either) — a coach adding a
// brand-new kid who was never on the roster at all shouldn't have to
// leave this screen to find Game settings' own +Player just to get them
// onto the sheet, per explicit feedback ("too clunky to have to do this
// in another place"). Creates the roster entry (onAddRosterPlayer) and
// immediately selects them as the arrival candidate — same callout/
// action-bar flow as an existing player toggling back to available, one
// consistent way to commit an arrival rather than a second instant-add
// path. onAddRosterPlayer deliberately doesn't touch availability itself
// — addArrival (below) is what actually threads a new arrival into the
// plan from now on, and it no-ops if the player already reads as
// available.
export default function SquadChangeScreen({
  roster, availableIds, plan, activeInterval, numberOf, onAddArrival, onRemoveAvailability, onAddRosterPlayer, onClose,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // A brand-new roster entry, not just an existing player toggling back —
  // "too clunky" to make a coach leave this screen and go find Game
  // settings' own +Player just to get someone on the sheet at all. Local
  // to this screen (not the app-level newPlayerName/setNewPlayerName pair
  // Setup's own +Player uses) since this is a quick mid-game add, not the
  // pre-game form.
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState("");

  const cur = plan[activeInterval];
  const onFieldIds = cur.onField.map((p) => p.id);

  const selectedPlayer = roster.find((p) => p.id === selectedId) || null;
  const isArrival = selectedPlayer && !availableIds.includes(selectedPlayer.id);
  const isOnPitch = selectedPlayer && onFieldIds.includes(selectedPlayer.id);

  const selectCard = (id) => {
    setConfirmRemove(false);
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const commitAdd = () => {
    onAddArrival(selectedPlayer.id);
    onClose();
  };

  const commitRemove = () => {
    onRemoveAvailability(selectedPlayer.id);
    onClose();
  };

  // Creates the roster entry, then selects them as the arrival candidate —
  // same callout + "Add X to the game" action-bar button an existing,
  // currently-unavailable player gets, so there's one consistent way to
  // actually commit an arrival on this screen rather than a second,
  // separate instant-add path.
  const submitAddPlayer = () => {
    const newId = onAddRosterPlayer(addPlayerName);
    if (!newId) return;
    setAddPlayerName("");
    setShowAddPlayer(false);
    setSelectedId(newId);
  };

  const handleActionBtn = () => {
    if (isArrival) {
      commitAdd();
    } else if (isOnPitch && !confirmRemove) {
      setConfirmRemove(true); // heavier action — confirm before pulling someone off the pitch
    } else {
      commitRemove();
    }
  };

  return (
    // No extra bottom padding needed for the action bar (mdActionBarOuter,
    // shared with the match screen — see below) — block 8, part B made it
    // a normal-flow element, not position:fixed, so it reserves its own
    // space just by existing; nothing can render underneath it.
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Who's here?</div>
        <span style={styles.mdSubHeaderChip}>{availableIds.length} in</span>
      </div>

      {isArrival && (
        <div style={styles.mdArrivalCallout}>
          <span style={styles.mdArrivalCalloutDisc}>{numberOf(selectedPlayer.id)}</span>
          <div style={styles.mdArrivalCalloutText}>
            <span style={styles.mdArrivalCalloutName}>{selectedPlayer.name} just arrived</span>
            <span style={styles.mdArrivalCalloutSub}>Tap Add below to bring them into the rotation.</span>
          </div>
        </div>
      )}

      <div style={styles.mdSquadGrid}>
        {roster.map((player) => {
          const available = availableIds.includes(player.id);
          const onPitch = available && onFieldIds.includes(player.id);
          const selected = player.id === selectedId;
          return (
            <button
              key={player.id}
              style={{
                ...styles.mdSquadCard,
                ...(available ? styles.mdSquadCardAvailable : styles.mdSquadCardUnavailable),
                ...(selected ? styles.mdSquadCardSelected : {}),
              }}
              onClick={() => selectCard(player.id)}
            >
              <span style={{ ...styles.mdSquadCardDisc, ...(available ? {} : styles.mdSquadCardDiscUnavailable) }}>
                {numberOf(player.id)}
              </span>
              <span style={styles.mdSquadCardInfo}>
                <span style={{ ...styles.mdSquadCardName, ...(available ? {} : styles.mdSquadCardNameUnavailable) }}>
                  {player.name}
                </span>
                <span style={{ ...styles.mdSquadCardStatus, ...(available ? {} : styles.mdSquadCardStatusUnavailable) }}>
                  {available ? (onPitch ? "on pitch" : "bench") : "not here"}
                </span>
              </span>
            </button>
          );
        })}
        {showAddPlayer ? (
          <div style={{ ...styles.mdSquadAddRow, gridColumn: "1 / -1" }}>
            <input
              autoFocus
              style={styles.mdSetupInput}
              placeholder="Player name"
              value={addPlayerName}
              onChange={(e) => setAddPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAddPlayer()}
            />
            <button style={styles.mdSetupAddBtn} onClick={submitAddPlayer}>
              Add
            </button>
          </div>
        ) : (
          <button style={styles.mdSquadAddCard} onClick={() => setShowAddPlayer(true)}>
            <Plus size={16} /> Player
          </button>
        )}
      </div>

      {selectedPlayer && (
        // Same normal-flow action-bar shell the match screen uses
        // (mdActionBarOuter/mdActionBar, styles.js) — this screen replaces
        // that bar rather than showing both at once, so reusing it directly
        // rather than inventing a second near-identical shell. Stacked
        // padding variant since this content is a column, not one row
        // (block 8, part B names this screen explicitly).
        <div style={styles.mdActionBarOuter}>
          <div style={{ ...styles.mdActionBar, ...styles.mdActionBarStacked }}>
            {confirmRemove ? (
              <div style={styles.mdTeamAcctConfirmCard}>
                <span style={styles.mdTeamAcctConfirmText}>
                  {selectedPlayer.name} is on the pitch right now — remove them from the game?
                </span>
                <div style={styles.mdTeamAcctConfirmBtnRow}>
                  <button style={styles.mdTeamAcctBtnDanger} onClick={commitRemove}>
                    Yes, remove
                  </button>
                  <button style={styles.mdTeamAcctBtnCancel} onClick={() => setConfirmRemove(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={styles.mdSquadChangeCaption}>
                  {isArrival
                    ? `Adding ${selectedPlayer.name} redraws the plan from now on.`
                    : `Removing ${selectedPlayer.name} redraws the plan from now on.`}
                </div>
                <button
                  style={{ ...styles.mdSquadChangeBtn, ...(isArrival ? {} : styles.mdSquadChangeBtnDanger) }}
                  onClick={handleActionBtn}
                >
                  {isArrival ? `Add ${selectedPlayer.name} to the game` : `Remove ${selectedPlayer.name} from the game`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
