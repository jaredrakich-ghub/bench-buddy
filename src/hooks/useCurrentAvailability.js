import { useState, useEffect, useRef } from "react";
import { isRequestStale, canAnswer } from "../lib/availability.js";
import { fetchAvailabilityRequest } from "../lib/availabilityIo.js";

// Extracted from SubRotationPlanner.jsx (real-use feedback: a coach
// finishing a game and tapping "Start new game" kept seeing the PREVIOUS
// game's availability answers presented as live for the one they were
// setting up) so this decision logic — already responsible for one shipped
// bug — is testable on its own, without rendering the whole 880-line
// orchestrator and everything it wires up.
//
// Fetched fresh (not a live subscription) on activeTeamId change — a coach
// composing/checking this isn't watching replies arrive in real time the
// way Match Link's own live sync matters for; a re-fetch on relevant
// moments is enough. AvailabilityScreen.jsx has its own independent live
// subscription for the screen where replies actually need to update in
// place.
//
// Three independent reasons a fetched request stops being "current" for
// every UI purpose here, without ever touching the document itself:
//   - isRequestStale: its own matchAt has already passed.
//   - canAnswer: the coach revoked it (Cancel this link).
//   - dismissedTokenRef: the coach tapped "Start new game"/"Continue Set
//     Up" — see dismiss()'s own comment below for why this exists
//     alongside isRequestStale rather than instead of it.
export function useCurrentAvailability(activeTeamId, isMatchComplete) {
  const [request, setRequest] = useState(null);
  // Token, not a boolean: a genuinely new request (a fresh link for the
  // next fixture) always has a different token and is never affected by a
  // dismissal recorded against the old one.
  const dismissedTokenRef = useRef(null);

  useEffect(() => {
    dismissedTokenRef.current = null;
    if (!activeTeamId) {
      setRequest(null);
      return;
    }
    let cancelled = false;
    fetchAvailabilityRequest(activeTeamId).then((r) => !cancelled && setRequest(r));
    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  // AvailabilityScreen.jsx's own onClose re-fetches through this — a coach
  // who just created/edited/regenerated/cancelled a link there needs the
  // "Set up next game" summary to reflect it immediately, not just on the
  // next team switch (which could be never, in the same session). Leaves
  // dismissedTokenRef untouched on purpose: editing the same already-
  // dismissed request shouldn't un-dismiss it, and a genuinely new token
  // (regenerate) is never affected by an old dismissal anyway.
  const refreshCurrentAvailabilityRequest = () => {
    if (!activeTeamId) return;
    fetchAvailabilityRequest(activeTeamId).then(setRequest);
  };

  // A fresh rotation actually being built (isMatchComplete going false
  // again) means any dismissal from the last game no longer applies —
  // mirrors SubRotationPlanner's own hasOpenedSetupThisGame reset, which
  // fires alongside this for the same reason but stays there since it's a
  // separate, UI-only concern (this hook owns nothing about it).
  useEffect(() => {
    if (!isMatchComplete) dismissedTokenRef.current = null;
  }, [isMatchComplete]);

  const currentAvailabilityRequest =
    request && !isRequestStale(request) && canAnswer(request) && request.token !== dismissedTokenRef.current
      ? request
      : null;

  // isRequestStale's own matchAt comparison assumes real time actually
  // passes matchAt before a match is played through to completion — true
  // for genuine live play, but a coach can reach isMatchComplete without
  // that (jumping straight to the last interval via the quick-select row
  // to preview a plan, rather than playing it out live). Tapping "Start
  // new game"/"Continue Set Up" is the coach explicitly saying this round
  // is over regardless of the clock — belt-and-suspenders alongside
  // isRequestStale, not a replacement for it (matchAt still covers "I
  // never touched this screen again until after the match" without
  // requiring the coach to take any action).
  const dismissCurrentAvailabilityRequest = () => {
    if (currentAvailabilityRequest) dismissedTokenRef.current = currentAvailabilityRequest.token;
  };

  return { currentAvailabilityRequest, dismissCurrentAvailabilityRequest, refreshCurrentAvailabilityRequest };
}
