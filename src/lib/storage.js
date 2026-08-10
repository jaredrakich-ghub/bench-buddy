/**
 * Drop-in replacement for the `window.storage` API that Claude.ai provides
 * inside its "artifacts" sandbox.
 *
 * The SubRotationPlanner component was originally built to run inside
 * Claude.ai, where `window.storage.get/set/delete/list` are injected by the
 * host page and persist data server-side, tied to your account. Outside
 * that sandbox (i.e. here, in a normal browser tab), `window.storage`
 * simply doesn't exist.
 *
 * Rather than touch the component, this file recreates the same method
 * shapes using the browser's built-in `localStorage`, and attaches itself
 * to `window.storage` as a side effect of being imported. Data now lives
 * in the browser it's opened in (not synced across devices) — see the
 * README for what that trade-off means in practice.
 *
 * Matches the documented shape:
 *   get(key, shared?)    -> { key, value, shared } | throws if missing
 *   set(key, value, shared?) -> { key, value, shared }
 *   delete(key, shared?) -> { key, deleted, shared }
 *   list(prefix?, shared?)   -> { keys, prefix, shared }
 */

const NAMESPACE = "sub-tracker";

function storageKey(key, shared) {
  return `${NAMESPACE}:${shared ? "shared" : "personal"}:${key}`;
}

async function get(key, shared = false) {
  const raw = window.localStorage.getItem(storageKey(key, shared));
  if (raw === null) {
    // Matches the real API: reading a key that was never set throws,
    // rather than returning null. The component already expects this
    // and handles it with a try/catch on first load.
    throw new Error(`storage: no value for key "${key}"`);
  }
  return { key, value: raw, shared };
}

async function set(key, value, shared = false) {
  window.localStorage.setItem(storageKey(key, shared), value);
  return { key, value, shared };
}

async function del(key, shared = false) {
  window.localStorage.removeItem(storageKey(key, shared));
  return { key, deleted: true, shared };
}

async function list(prefix = "", shared = false) {
  const nsPrefix = `${NAMESPACE}:${shared ? "shared" : "personal"}:${prefix}`;
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const fullKey = window.localStorage.key(i);
    if (fullKey && fullKey.startsWith(nsPrefix)) {
      keys.push(fullKey.slice(`${NAMESPACE}:${shared ? "shared" : "personal"}:`.length));
    }
  }
  return { keys, prefix, shared };
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = { get, set, delete: del, list };
}
