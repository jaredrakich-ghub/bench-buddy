// Writes a best-effort crash report to Firestore when the app hits an
// unhandled error — see ErrorBoundary.jsx. Before this, a crash only ever
// reached console.error, which nobody's watching; a coach's app breaking
// mid-match was otherwise invisible unless they happened to mention it.
//
// Write-only from the client's side (see firestore.rules) — nobody can read
// these back through the app, including the person who triggered one.
// They're only ever reviewed via the Firebase console, which authenticates
// as the project owner and bypasses these rules entirely.
//
// Deliberately fire-and-forget and defensive throughout: reporting a crash
// must never itself throw or block the fallback UI from rendering,
// especially since this runs at exactly the moment something's already gone
// wrong.
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebaseClient.js";

export function reportCrash(error, info) {
  try {
    addDoc(collection(db, "crashReports"), {
      message: String(error?.message || error || "unknown error").slice(0, 2000),
      stack: String(error?.stack || "").slice(0, 4000),
      componentStack: String(info?.componentStack || "").slice(0, 4000),
      uid: auth.currentUser?.uid || null,
      url: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Reporting the crash failed too (e.g. offline) — nothing more useful
      // to do here. The fallback UI in ErrorBoundary still renders either way.
    });
  } catch {
    // Never let crash reporting itself become a second crash.
  }
}
