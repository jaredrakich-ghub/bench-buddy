import { useState, useEffect } from "react";
import { styles, tokens } from "./styles.js";
import { NOTE_CHIP_OPTIONS, formatFixture, formatMatchWhen, canAnswer, buildAnswer } from "../lib/availability.js";
import { fetchAvailabilityRequest, submitAnswer } from "../lib/availabilityIo.js";
import LoadingScreen from "./LoadingScreen.jsx";
import headerMascot from "../assets/header-mascot.svg";

// README > 1c — One child (parent, web). A standalone page, no app chrome
// (same "?team=&a=" query-string routing as Match Link's own claim page —
// see App.jsx's own comment). No per-parent identity at all (README >
// Identity: "anyone with the link can answer for any child") — the picker
// step is always a fresh pick, never "remembers" who this device answered
// for last; if the chosen child already has an answer, this pre-fills the
// question card from it (README > Screens > 1c build note: "make it
// obvious the parent can come back and change the answer") rather than
// tracking that some other way.
export default function AvailabilityClaimPage({ teamId, token }) {
  const [request, setRequest] = useState(undefined); // undefined = loading
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [status, setStatus] = useState(null); // "in" | "out" | null (not chosen yet)
  const [noteChips, setNoteChips] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAvailabilityRequest(teamId).then((r) => !cancelled && setRequest(r));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const pickChild = (childId) => {
    const existing = request.answers[childId];
    setSelectedChildId(childId);
    setStatus(existing?.status || null);
    setNoteChips(existing?.noteChips || []);
    setNoteText(existing?.noteText || "");
    setSent(false);
  };

  const toggleChip = (key) => {
    setNoteChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const send = async () => {
    if (!status || busy) return;
    setBusy(true);
    setError("");
    try {
      const existing = request.answers[selectedChildId];
      const answer = buildAnswer({ status, noteChips, noteText: noteText.trim() }, existing?.answeredAt || null);
      await submitAnswer(teamId, selectedChildId, answer, token);
      setRequest((prev) => ({ ...prev, answers: { ...prev.answers, [selectedChildId]: answer } }));
      setSent(true);
    } catch {
      setError("Couldn't send that — check your connection and try again.");
    }
    setBusy(false);
  };

  if (request === undefined) {
    return <LoadingScreen message="Loading…" />;
  }
  if (!request || !canAnswer(request)) {
    return (
      <ClaimMessage
        title="This link isn't active"
        body="It may have been turned off or replaced with a new one. Ask the coach for a fresh link."
      />
    );
  }

  const selectedChild = request.squad.find((p) => p.id === selectedChildId);

  if (!selectedChild) {
    return (
      <div style={styles.mdClaimPage}>
        <div style={styles.mdClaimInner}>
          <div style={styles.mdClaimCrest}>
            <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
          </div>
          <div style={styles.mdClaimTitle}>Tap your child</div>
          <div style={styles.mdClaimBody}>{formatFixture(request.teamName, request.opponent)}</div>
          <div style={{ ...styles.mdAvailSquadChipRow, marginTop: 10, justifyContent: "center" }}>
            {request.squad.map((p) => (
              <button key={p.id} style={styles.mdAvailSquadChip} onClick={() => pickChild(p.id)}>
                <span style={styles.mdAvailSquadChipDisc}>{p.number}</span>
                <span style={styles.mdAvailSquadChipName}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <ClaimMessage
        title="Thanks!"
        body={`${selectedChild.name} is marked as ${status === "in" ? "playing" : "not playing"}. You can come back to this link any time to change it.`}
      >
        <button style={styles.mdAvailGhostBtn} onClick={() => pickChild(selectedChildId)}>
          Change your answer
        </button>
      </ClaimMessage>
    );
  }

  return (
    <div style={styles.mdClaimPage}>
      <div style={styles.mdClaimInner}>
        <button style={styles.mdAvailFixtureDetailBtn} onClick={() => setSelectedChildId(null)}>
          ‹ Not your child? Pick again
        </button>

        <div style={{ ...styles.mdAvailCard, width: "100%", textAlign: "center", marginTop: 12 }}>
          <div style={{ ...styles.mdAvailSquadChipDisc, width: 64, height: 64, fontSize: 26, margin: "0 auto 12px" }}>
            {selectedChild.number}
          </div>
          <div style={styles.mdClaimTitle}>Is {selectedChild.name} playing?</div>
          <div style={styles.mdClaimBody}>
            {formatFixture(request.teamName, request.opponent)} · {formatMatchWhen(request.matchAt)}
            {request.location ? <br /> : null}
            {request.location}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 14 }}>
          <button
            style={{ ...styles.mdAvailPrimaryBtn, ...(status !== "in" ? { background: "#fff", color: tokens.color.deepGreen, boxShadow: "none" } : {}) }}
            onClick={() => setStatus("in")}
          >
            Yes, playing
          </button>
          <button
            style={{ ...styles.mdAvailSecondaryBtn, marginTop: 0, ...(status === "out" ? { background: tokens.color.availOut, color: "#fff" } : {}) }}
            onClick={() => setStatus("out")}
          >
            Can't make it
          </button>
        </div>

        <div style={{ ...styles.mdAvailCard, width: "100%", marginTop: 14 }}>
          <div style={styles.mdAvailCardLabel}>ANYTHING THE COACH SHOULD KNOW?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {NOTE_CHIP_OPTIONS.map((chip) => (
              <button
                key={chip.key}
                style={{
                  padding: "10px 15px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontFamily: tokens.font.body, fontWeight: 800, fontSize: 14,
                  background: noteChips.includes(chip.key) ? tokens.color.headerYellow : tokens.color.availSand,
                  color: noteChips.includes(chip.key) ? tokens.color.deepGreen : tokens.color.mutedText,
                }}
                onClick={() => toggleChip(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <textarea
            style={{ ...styles.mdAvailInput, height: 60, padding: "12px 16px", background: tokens.color.availWell, resize: "vertical" }}
            placeholder="Anything else? (optional)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div style={{ ...styles.mdAvailReplyState, marginTop: 8 }}>Optional. Only the coach sees this.</div>
        </div>

        {error && <div style={styles.modalWarning}>{error}</div>}

        <button
          style={{ ...styles.mdAvailPrimaryBtn, marginTop: 4, background: tokens.color.yellow, color: tokens.color.deepGreen, boxShadow: tokens.shadow.solid(6, tokens.color.yellowShadow) }}
          onClick={send}
          disabled={!status || busy}
        >
          {busy ? "Sending…" : "Send to coach"}
        </button>
      </div>
    </div>
  );
}

function ClaimMessage({ title, body, children }) {
  return (
    <div style={styles.mdClaimPage}>
      <div style={styles.mdClaimInner}>
        <div style={styles.mdClaimCrest}>
          <img src={headerMascot} alt="" style={styles.mdClaimCrestImg} />
        </div>
        <div style={styles.mdClaimTitle}>{title}</div>
        <div style={styles.mdClaimBody}>{body}</div>
        {children}
      </div>
    </div>
  );
}
