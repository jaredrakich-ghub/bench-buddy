/**
 * Timestamp-anchored match clock math, kept separate from React state so it
 * can be reasoned about and tested without an actual timer running.
 *
 * The clock's source of truth is never "how many ticks have fired" — a
 * background tab can be throttled or killed and reloaded, silently losing
 * ticks. Instead, elapsed time is always derived from a real wall-clock
 * timestamp, so it comes back correct the instant the coach looks at it
 * again, however long they were away — as long as the clock was actually
 * *running* while they were gone. A deliberate pause (e.g. a water break)
 * is represented by `startedAtMs: null` and is never auto-caught-up.
 */

// Given the elapsed time recorded at the start of the current running
// segment (`baseElapsedSec`) and when that segment started
// (`startedAtMs`, a Date.now() timestamp, or null if the clock is
// currently paused), returns the correct elapsed time right now — capped
// at `capSec` so a match can never show more time than the game actually
// runs (once reached, the match is over and the clock stops advancing).
export function computeLiveElapsedSec(baseElapsedSec, startedAtMs, capSec) {
  if (startedAtMs == null) {
    return Math.min(baseElapsedSec, capSec);
  }
  const live = baseElapsedSec + (Date.now() - startedAtMs) / 1000;
  return Math.min(Math.max(live, 0), capSec);
}
