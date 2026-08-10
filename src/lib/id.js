// Generates a unique id for a new player. Uses the browser's built-in
// crypto.randomUUID() when available — a real, collision-resistant UUID,
// not a dependency, just a standard Web API — which matters if player data
// ever needs to sync across devices/a backend, where two browsers landing
// on the same short random id becomes a real (if currently unlikely) risk
// with the old Math.random()-based approach.
//
// Falls back to a timestamp-mixed random string for environments where
// crypto.randomUUID isn't available — notably, it requires a "secure
// context" (HTTPS or localhost), so this matters if the app were ever
// served over plain HTTP on a non-localhost origin.
export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
