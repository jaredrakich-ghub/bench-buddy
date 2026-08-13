import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { fetchGameHistory } from "../lib/gameHistory.js";
import { aggregateSeasonSummary } from "../lib/rotation.js";
import { styles } from "./styles.js";

// Read-only rollup of every archived game for this team — see gameHistory.js
// for where those records come from (one per completed game, written
// automatically when a new game starts after a previous one finished) and
// aggregateSeasonSummary in rotation.js for how they're combined. Fetches
// fresh every time it's opened rather than caching, since this is meant to
// be checked occasionally, not kept live on screen.
//
// Deliberately summary-only: totals and per-game averages, nothing that
// feeds back into how future games are generated. Season-to-season fairness
// carryover was explicitly scoped out when this was designed — see the
// architecture notes — so this is purely a "how has it balanced out so far"
// view, not a second fairness engine.
function describeLoadError(err) {
  if (err?.code === "permission-denied") return "You don't have access to this team's season history.";
  if (err?.code === "unavailable") return "You're offline — season history isn't available right now.";
  return "Couldn't load season history right now.";
}

export default function SeasonSummaryModal({ teamId, onClose }) {
  const [games, setGames] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setGames(null);
    setError(null);
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
          </>
        )}
      </div>
    </div>
  );
}
