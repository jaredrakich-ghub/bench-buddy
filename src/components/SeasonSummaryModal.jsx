import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { fetchGameHistory, deleteGame } from "../lib/gameHistory.js";
import { aggregateSeasonSummary } from "../lib/rotation.js";
import { styles } from "./styles.js";

// Rollup of every archived game for this team — see gameHistory.js for
// where those records come from (one per completed game, written
// automatically when a new game starts after a previous one finished) and
// aggregateSeasonSummary in rotation.js for how they're combined. Fetches
// fresh every time it's opened rather than caching, since this is meant to
// be checked occasionally, not kept live on screen.
//
// The averages table is summary-only: totals and per-game averages, nothing
// that feeds back into how future games are generated. Season-to-season
// fairness carryover was explicitly scoped out when this was designed — see
// the architecture notes — so this is purely a "how has it balanced out so
// far" view, not a second fairness engine. The per-game list below it is the
// one write path this modal has — deleting a mis-recorded or test game — and
// deletes locally from state on success rather than re-fetching, since a
// coach removing one entry has no reason to wait on a second round trip to
// see it gone.
function describeLoadError(err) {
  if (err?.code === "permission-denied") return "You don't have access to this team's season history.";
  if (err?.code === "unavailable") return "You're offline — season history isn't available right now.";
  return "Couldn't load season history right now.";
}

function describeDeleteError(err) {
  if (err?.code === "permission-denied") return "You don't have permission to delete this game.";
  if (err?.code === "unavailable") return "You're offline — try deleting this game again once you're back online.";
  return "Couldn't delete that game — try again.";
}

export default function SeasonSummaryModal({ teamId, onClose }) {
  const [games, setGames] = useState(null); // null = still loading
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
    setConfirmDeleteId(null);
    setDeleteError(null);
    fetchGameHistory(teamId)
      .then((result) => {
        if (!cancelled) setGames(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeLoadError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const handleDelete = async (gameId) => {
    setDeletingId(gameId);
    setDeleteError(null);
    try {
      await deleteGame(teamId, gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch (err) {
      setDeleteError(describeDeleteError(err));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const summary = games ? aggregateSeasonSummary(games) : [];
  const anyInjured = summary.some((r) => r.injuredMin > 0);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Season Summary</h3>
          <button style={styles.modalCloseBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {games === null && !error && <p style={styles.backupHint}>Loading season history…</p>}
        {error && <div style={styles.modalWarning}>{error}</div>}

        {games !== null && !error && games.length === 0 && (
          <p style={styles.backupHint}>
            No games recorded yet — a game is saved to season history automatically once you start a new one after
            finishing a previous one.
          </p>
        )}

        {games !== null && !error && games.length > 0 && (
          <>
            <p style={styles.backupHint}>
              Averages across the {games.length} game{games.length === 1 ? "" : "s"} played so far. A player who
              missed a game just isn't counted for it — their average is only ever across games they actually played.
            </p>
            <div style={styles.summaryTable}>
              <div style={{ ...styles.summaryRow, ...styles.summaryHeadRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
                <span style={styles.summaryName}>Player</span>
                <span>Games</span>
                <span>Avg Outfield</span>
                <span>Avg Keeper</span>
                {anyInjured && <span>Avg Injured</span>}
              </div>
              {summary
                .slice()
                .sort((a, b) => b.avgOutfieldMin + b.avgGkMin - (a.avgOutfieldMin + a.avgGkMin))
                .map((r) => (
                  <div key={r.id} style={{ ...styles.summaryRow, ...(anyInjured ? styles.summaryRow5 : {}) }}>
                    <span style={styles.summaryName}>{r.name || "?"}</span>
                    <span>{r.gamesPlayed}</span>
                    <span>{Math.round(r.avgOutfieldMin)}</span>
                    <span>{Math.round(r.avgGkMin)}</span>
                    {anyInjured && <span>{Math.round(r.injuredMin / r.gamesPlayed)}</span>}
                  </div>
                ))}
            </div>

            <p style={{ ...styles.backupHint, marginTop: 14 }}>
              Individual games — newest first. Removing one only affects the averages above.
            </p>
            {deleteError && <div style={styles.modalWarning}>{deleteError}</div>}
            <div>
              {games.map((g) => {
                const dateLabel = g.date ? new Date(g.date).toLocaleDateString() : "Unknown date";
                const playerCount = g.players?.length ?? 0;

                if (confirmDeleteId === g.id) {
                  return (
                    <div key={g.id} style={styles.backupConfirmRow}>
                      <span style={styles.backupHint}>
                        Delete the {dateLabel} game? This can't be undone.
                      </span>
                      <button style={styles.backupConfirmBtn} onClick={() => handleDelete(g.id)} disabled={deletingId === g.id}>
                        {deletingId === g.id ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button style={styles.backupCancelBtn} onClick={() => setConfirmDeleteId(null)} disabled={deletingId === g.id}>
                        Cancel
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={g.id} style={styles.teamRow}>
                    <span style={{ flex: 1 }}>
                      {dateLabel} <span style={styles.teamRowMeta}>{playerCount} player{playerCount === 1 ? "" : "s"}</span>
                    </span>
                    <button style={styles.iconBtn} onClick={() => setConfirmDeleteId(g.id)} title="Delete this game">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
