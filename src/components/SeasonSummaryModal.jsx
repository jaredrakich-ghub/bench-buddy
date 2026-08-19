import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
// README > A6-Season (#10c): "has the season been fair" — headline number
// is the average per game, not the total (a total penalises a child who
// missed weekends; the total stays as the secondary line under their
// name). The per-game delete list below isn't part of the README's A6
// section at all — real existing functionality, restyled to sit
// consistently under the new averages rather than dropped.
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

// Total minutes across a season can genuinely pass an hour (the README's
// own example: "2:43:00") — fmtClock (clock.js) deliberately only ever
// formats m:ss, since a single live match never runs that long; this is
// its own small h:mm:ss formatter rather than changing that shared one.
function fmtLongClock(totalMinutes) {
  const totalSec = Math.max(0, Math.round(totalMinutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : m;
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function SeasonSummaryModal({ teamId, numberOf, keeperEligibleIds, onClose }) {
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
  // Average *playing* time per game — outfield + keeper combined, bench
  // doesn't count toward "played". Sorted descending; this drives both
  // row order and the bar scale below.
  const rows = summary
    .map((r) => ({ ...r, avgTotalMin: r.avgOutfieldMin + r.avgGkMin, totalMin: r.outfieldMin + r.gkMin }))
    .sort((a, b) => b.avgTotalMin - a.avgTotalMin);

  const avgValues = rows.map((r) => r.avgTotalMin);
  const maxAvg = avgValues.length ? Math.max(...avgValues) : 0;
  const minAvg = avgValues.length ? Math.min(...avgValues) : 0;
  const gapMin = maxAvg - minAvg;
  // "Bars are scaled from the squad's lowest average, not from zero" — a
  // player sitting exactly at the squad's low end reads as an empty bar,
  // not a mostly-full one, so the actual spread is what's visible.
  const barPct = (avgTotalMin) => (gapMin > 0 ? ((avgTotalMin - minAvg) / gapMin) * 100 : 100);

  const oldestGameDate = games && games.length > 0 ? games[games.length - 1].date : null;

  return (
    <section style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 24px)" }}>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Season</div>
        {games !== null && !error && <span style={styles.mdSubHeaderChip}>{games.length} game{games.length === 1 ? "" : "s"}</span>}
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
          <div style={styles.mdMinutesNote}>
            Average minutes per game. Widest gap across the squad is {Math.round(gapMin)} minute{Math.round(gapMin) === 1 ? "" : "s"}.
          </div>

          <div style={styles.mdMinutesList}>
            {rows.map((r) => {
              const isKeeper = keeperEligibleIds.includes(r.id);
              return (
                <div key={r.id} style={styles.mdSeasonRow}>
                  <span style={{ ...styles.mdMinutesDisc, ...(isKeeper ? styles.mdMinutesDiscKeeper : {}) }}>
                    {numberOf(r.id)}
                  </span>
                  <div style={styles.mdSeasonNameStack}>
                    <span style={styles.mdSeasonName}>{r.name || "?"}</span>
                    <span style={styles.mdSeasonSubline}>
                      {r.gamesPlayed} game{r.gamesPlayed === 1 ? "" : "s"} · {fmtLongClock(r.totalMin)}
                    </span>
                  </div>
                  <div style={styles.mdSeasonBarTrack}>
                    <div style={{ ...styles.mdSeasonBarFill, width: `${barPct(r.avgTotalMin)}%` }} />
                  </div>
                  <span style={styles.mdSeasonAvg}>{Math.round(r.avgTotalMin)}′</span>
                </div>
              );
            })}
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
                  <div key={g.id} style={{ ...styles.mdTeamAcctConfirmCard, marginBottom: 6 }}>
                    <span style={styles.mdTeamAcctConfirmText}>Delete the {dateLabel} game? This can't be undone.</span>
                    <div style={styles.mdTeamAcctConfirmBtnRow}>
                      <button style={styles.mdTeamAcctBtnDanger} onClick={() => handleDelete(g.id)} disabled={deletingId === g.id}>
                        {deletingId === g.id ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        style={styles.mdTeamAcctBtnCancel}
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === g.id}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={g.id} style={styles.mdSeasonGameRow}>
                  <span style={styles.mdSeasonGameLabel}>
                    {dateLabel} <span style={styles.mdSeasonGameMeta}>{playerCount} player{playerCount === 1 ? "" : "s"}</span>
                  </span>
                  <button style={styles.mdTeamAcctIconBtn} onClick={() => setConfirmDeleteId(g.id)} title="Delete this game">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {oldestGameDate && (
            <div style={styles.mdSeasonFooter}>
              Since {new Date(oldestGameDate).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
