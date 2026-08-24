// Validates the game-setup form before a rotation is generated. Kept as a
// pure function (data in, result out) so it's testable without React, and
// so the exact same checks apply whether the coach is setting up a game for
// the first time or editing settings for one already in progress.
//
// The HTML `min`/`step` attributes on the number inputs are a helpful
// nudge, but aren't reliable on their own — these fields aren't inside a
// <form>, so a coach can still type 0 or a negative number. Left
// unvalidated, subIntervalMinutes <= 0 in particular causes an infinite
// loop in generatePlan (numIntervals becomes Infinity), which would hang
// the tab — this is the one genuinely dangerous case, not just a cosmetic
// one.
export function validateGameSettings(settings, availableCount) {
  const errors = [];
  const { fieldSize, gameMinutes, subIntervalMinutes, keeperShiftMinutes } = settings;

  if (!Number.isFinite(fieldSize) || fieldSize < 2) {
    errors.push("Players on field must be at least 2.");
  }
  if (!Number.isFinite(gameMinutes) || gameMinutes <= 0) {
    errors.push("Game length must be greater than 0 minutes.");
  }
  if (!Number.isFinite(subIntervalMinutes) || subIntervalMinutes <= 0) {
    errors.push("Sub interval must be greater than 0 minutes.");
  }
  // keeperShiftMinutes is optional (blank = "same as sub interval"), so only
  // validate it when the coach has actually put something in the field.
  if (keeperShiftMinutes !== undefined && keeperShiftMinutes !== "" && keeperShiftMinutes !== null) {
    if (!Number.isFinite(keeperShiftMinutes) || keeperShiftMinutes < 0) {
      errors.push("Keeper shift must be 0 or greater.");
    }
  }
  // The real minimum is however many fill the field — a bench isn't
  // required. Real-use feedback: a squad with no subs at all is a real,
  // supported case (see fixedRotation.js's own "puts nobody on the bench
  // when the squad exactly fills the field" test), used to manage a fair
  // keeper rotation among a fixed set of outfielders with nobody ever
  // subbed off. If fieldSize itself isn't valid, that's already flagged
  // above, so just fall back to the bare "need someone to play" floor
  // here rather than compounding a confusing message.
  const minAvailable = Number.isFinite(fieldSize) && fieldSize >= 2 ? fieldSize : 2;
  if (availableCount < minAvailable) {
    errors.push(`Select at least ${minAvailable} available players to fill the field.`);
  }

  return { valid: errors.length === 0, errors };
}
