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
  if (availableCount < 2) {
    errors.push("Select at least 2 available players.");
  }

  return { valid: errors.length === 0, errors };
}
