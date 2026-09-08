import { useState, useEffect } from "react";
import { Share2 } from "lucide-react";
import { styles } from "./styles.js";
import { getSquadNumber } from "../lib/squadNumber.js";
import {
  buildShareMessage, describeReplyState, isRequestClosed,
} from "../lib/availability.js";
import {
  fetchAvailabilityRequest, createOrRegenerateAvailabilityRequest, updateClosingTime, subscribeAvailabilityRequest,
} from "../lib/availabilityIo.js";
import LoadingScreen from "./LoadingScreen.jsx";

// README > 1a — Who's playing? (coach). Full-screen takeover, same shell
// every other cog/setup-adjacent screen uses. Reached from the new prompt/
// summary card SquadSettingsForm.jsx renders near its own "Who's here"
// section (there's no cog-menu row for this — MatchView's cog menu only
// exists once a plan/match is live, and this screen's whole job is asking
// BEFORE that point, same reasoning documented where it's wired in
// SubRotationPlanner.jsx).
//
// No email/date/venue field exists anywhere else in this app (gameSettings
// only ever holds fieldSize/gameMinutes/subIntervalMinutes) — matchAt/
// opponent/location live only on the request itself, entered fresh each
// time a coach composes one. See availability.js's own top comment.
const CLAIM_URL_BASE = "app.benchbuddysports.com/?";

function toDatetimeLocalValue(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export default function AvailabilityScreen({ teamId, coachUid, teamName, roster, onClose }) {
  const [request, setRequest] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingClosing, setEditingClosing] = useState(false);

  const [opponent, setOpponent] = useState("");
  const [matchAt, setMatchAt] = useState("");
  const [location, setLocation] = useState("");
  const [closingAt, setClosingAt] = useState("");
  const [closingEdit, setClosingEdit] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAvailabilityRequest(teamId).then((r) => !cancelled && setRequest(r));
    const unsubscribe = subscribeAvailabilityRequest(teamId, (r) => !cancelled && setRequest(r));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [teamId]);

  const runAction = async (fn) => {
    setError("");
    try {
      await fn();
    } catch {
      setError("Changes aren't saving right now — check your connection and try again.");
    }
  };

  const createRequest = () =>
    runAction(async () => {
      const matchAtMs = fromDatetimeLocalValue(matchAt);
      const closingAtMs = fromDatetimeLocalValue(closingAt);
      if (!matchAtMs || !closingAtMs) {
        setError("Set the match time and a closing time first.");
        return;
      }
      const squad = roster.map((p) => ({ id: p.id, name: p.name, number: getSquadNumber(p, roster) }));
      await createOrRegenerateAvailabilityRequest(teamId, coachUid, {
        teamName, closingAt: closingAtMs, matchAt: matchAtMs, opponent: opponent.trim(), location: location.trim(), squad,
      });
    });

  const regenerate = () =>
    runAction(() => {
      const squad = roster.map((p) => ({ id: p.id, name: p.name, number: getSquadNumber(p, roster) }));
      return createOrRegenerateAvailabilityRequest(teamId, coachUid, {
        teamName, closingAt: request.closingAt, matchAt: request.matchAt, opponent: request.opponent, location: request.location, squad,
      });
    });

  const saveClosingEdit = () =>
    runAction(async () => {
      const newClosingAtMs = fromDatetimeLocalValue(closingEdit);
      if (!newClosingAtMs) return;
      await updateClosingTime(teamId, request, newClosingAtMs);
      setEditingClosing(false);
    });

  const claimUrl = request
    ? `${CLAIM_URL_BASE}team=${encodeURIComponent(teamId)}&a=${encodeURIComponent(request.token)}`
    : "";
  const fullClaimUrl = `https://${claimUrl}`;
  const message = request
    ? buildShareMessage({ teamName, opponent: request.opponent, matchAt: request.matchAt, location: request.location })
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullClaimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link — copy it from the box above instead.");
    }
  };
  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`${message}\n\n${fullClaimUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (request === undefined) {
    return <LoadingScreen message="Loading…" />;
  }

  return (
    <section>
      <div style={styles.mdSubHeader}>
        <button style={styles.mdSubHeaderBack} onClick={onClose} title="Back">
          ‹
        </button>
        <div style={styles.mdSubHeaderTitle}>Who's playing?</div>
      </div>

      {error && <div style={styles.modalWarning}>{error}</div>}

      {!request ? (
        <div style={styles.mdAvailCard}>
          <div style={styles.mdAvailFixture}>Ask the group</div>
          <div style={{ ...styles.mdAvailFixtureDetail, marginBottom: 14 }}>
            Post one link into the team chat. Parents tap it, answer for their own child, and it's already filled in
            when you set up the game.
          </div>
          <div style={styles.mdAvailForm}>
            <span style={styles.mdAvailLabel}>OPPONENT (OPTIONAL)</span>
            <input style={styles.mdAvailInput} placeholder="Rovers" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
            <span style={styles.mdAvailLabel}>MATCH TIME</span>
            <input
              type="datetime-local"
              style={styles.mdAvailInput}
              value={matchAt}
              onChange={(e) => setMatchAt(e.target.value)}
            />
            <span style={styles.mdAvailLabel}>LOCATION (OPTIONAL)</span>
            <input style={styles.mdAvailInput} placeholder="Hillcrest Park" value={location} onChange={(e) => setLocation(e.target.value)} />
            <span style={styles.mdAvailLabel}>CLOSES</span>
            <input
              type="datetime-local"
              style={styles.mdAvailInput}
              value={closingAt}
              onChange={(e) => setClosingAt(e.target.value)}
            />
          </div>
          <button style={{ ...styles.mdAvailPrimaryBtn, marginTop: 16 }} onClick={createRequest}>
            Create the link
          </button>
        </div>
      ) : (
        <>
          <div style={styles.mdAvailCard}>
            <div style={styles.mdAvailFixture}>{request.opponent ? `${teamName} v ${request.opponent}` : teamName}</div>
            <div style={styles.mdAvailFixtureDetail}>
              {new Date(request.matchAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
              {" · "}
              {new Date(request.matchAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              {request.location ? ` · ${request.location}` : ""}
            </div>
          </div>

          <div style={styles.mdAvailCard}>
            <div style={styles.mdAvailCardLabel}>WHAT THE GROUP SEES</div>
            <div style={styles.mdAvailPreviewWell}>
              {message}
              <span style={styles.mdAvailPreviewUrl}>{claimUrl}</span>
            </div>
            {editingClosing ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="datetime-local"
                  style={styles.mdAvailInput}
                  value={closingEdit}
                  onChange={(e) => setClosingEdit(e.target.value)}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...styles.mdAvailSecondaryBtn, marginTop: 0, flex: 1 }} onClick={() => setEditingClosing(false)}>
                    Cancel
                  </button>
                  <button style={{ ...styles.mdAvailPrimaryBtn, height: 56, fontSize: 18, flex: 1 }} onClick={saveClosingEdit}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={styles.mdAvailFixtureDetailBtn}
                onClick={() => {
                  setClosingEdit(toDatetimeLocalValue(request.closingAt));
                  setEditingClosing(true);
                }}
              >
                <span style={styles.mdAvailClosesLine}>
                  {isRequestClosed(request)
                    ? "Closed — the coach has been told, answers still accepted. Tap to reopen."
                    : `Closes ${new Date(request.closingAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}. Tap to change.`}
                </span>
              </button>
            )}
          </div>

          <div style={styles.mdAvailCard}>
            <div style={styles.mdAvailCardLabel}>SQUAD · {request.squad.length}</div>
            <div style={styles.mdAvailSquadChipRow}>
              {request.squad.map((p) => (
                <span key={p.id} style={styles.mdAvailSquadChip}>
                  <span style={styles.mdAvailSquadChipDisc}>{p.number}</span>
                  <span style={styles.mdAvailSquadChipName}>{p.name}</span>
                </span>
              ))}
            </div>
            <div style={styles.mdAvailReplyState}>{describeReplyState(request.squad, request.answers)}</div>
          </div>

          <button style={styles.mdAvailPrimaryBtn} onClick={shareToWhatsApp}>
            <Share2 size={18} /> Share to WhatsApp
          </button>
          <button style={styles.mdAvailSecondaryBtn} onClick={copyLink}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button style={styles.mdAvailGhostBtn} onClick={regenerate}>
            Get a new link
          </button>
        </>
      )}
    </section>
  );
}
