import { useState, useEffect } from "react";

// Debt ledger, Next lane: extracted out of MatchView.jsx (where it was
// previously deliberately kept local — "not shared with
// RotationProgressOverlay's own identical hook... scoped deliberately to
// this one file", per that feature's own build constraint at the time).
// This is a pure code-motion/test-ability pass, not a new feature, so
// that constraint no longer applies — MatchView.jsx and Final60Sheets.jsx
// both need this now. RotationProgressOverlay.jsx still has its own
// separate copy; consolidating that one too is a small, obvious follow-up
// left for later rather than folded into this change.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
