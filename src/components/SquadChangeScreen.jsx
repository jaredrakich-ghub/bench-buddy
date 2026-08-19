import { useState } from "react";
import { styles, tokens } from "./styles.js";

// README > A7-Squad-change (#10d) — "a child arrived late or left early.
// This is the only reason the screen gets opened." Full-screen takeover
// (same mdFullScreenTakeoverOuter/Inner wrapper as every other non-match
// screen), reached from MatchView's cog menu "Squad change" row, which
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
export default function SquadChangeScreen({
  roster, availableIds, plan, activeInterval, numberOf, onAddArrival, onRemoveAvailability, onClose,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
    // paddingBottom reserves room for the fixed action bar (mdActionBarOuter,
    // shared with the match screen — see below) so the last row of the
    // squad grid never sits underneath it, same reasoning as `main`'s own
    // paddingBottom in styles.js.
    <section style={{ paddingBottom: selectedPlayer ? "calc(130px + env(safe-area-inset-bottom, 0px))" : 0 }}>
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
      </div>

      {selectedPlayer && (
        // Same fixed bottom shell the match screen's own action bar uses
        // (mdActionBarOuter/mdActionBar, styles.js) — this screen replaces
        // that bar rather than showing both at once, so reusing it directly
        // rather than inventing a second near-identical fixed shell.
        <div style={styles.mdActionBarOuter}>
          <div style={styles.mdActionBar}>
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
