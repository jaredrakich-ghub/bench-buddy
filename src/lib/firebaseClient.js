// Firebase project setup for Bench Buddy. This config is not a secret — it's
// meant to be visible in client-side code (Firebase's actual security lives
// in Firestore security rules, not in hiding these values), so it's fine to
// commit directly rather than route through environment variables.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD0beRPZuAhja8VoPVpoyJ2WhFbY4y34ZA",
  // Custom auth domain (Firebase Hosting -> auth.benchbuddysports.com,
  // CNAME'd at GoDaddy) instead of the default *.firebaseapp.com — real-use
  // feedback: Google's own sign-in consent screen shows this domain
  // verbatim ("Sign in to continue to..."), and the generic Firebase one
  // read as untrustworthy to an average user. Requires
  // auth.benchbuddysports.com to also be listed under Authentication ->
  // Settings -> Authorized domains in the Firebase console, or every
  // sign-in through it gets rejected as an unauthorized domain.
  //
  // Briefly reverted to the default domain to isolate an unrelated iOS
  // sign-in failure (root cause: the popup-vs-redirect sign-in mechanism,
  // not the domain — see auth.js's own comment) — restored now that
  // that's fixed. Popup doesn't have redirect's "does the return trip land
  // in the same storage context" problem, so there's no reason to expect
  // this domain change to interact badly with it the way it seemed to
  // (misleadingly) with redirect.
  authDomain: "auth.benchbuddysports.com",
  projectId: "bench-buddy-ada85",
  storageBucket: "bench-buddy-ada85.firebasestorage.app",
  messagingSenderId: "159916947909",
  appId: "1:159916947909:web:7507a4324f33cee94733ac",
};

const app = initializeApp(firebaseConfig);

// App Check: proves requests are coming from this actual web app, not a
// script hitting Firestore/Auth directly with the (necessarily public)
// config above. reCAPTCHA Enterprise's score-based key is invisible to
// real users — no challenge to solve, just a background risk score
// attached to each request. Only real enforcement point is Firestore
// rules, once turned on in the Firebase console (App Check tab) — nothing
// here rejects a request on its own.
//
// Browser-only: `window` doesn't exist under the Node-based emulator
// integration suite (firebase-tests/, vitest.emulator.config.js), and
// initializeAppCheck needs a real browser (loads reCAPTCHA's own script,
// uses browser storage) — same reasoning as hasIndexedDb below.
if (typeof window !== "undefined") {
  // Local dev only: the reCAPTCHA Enterprise key above is domain-restricted
  // in the Google Cloud console to Bench Buddy's real deployed domain, not
  // localhost — so `npm run dev` can never get a valid App Check token, and
  // once enforcement is switched on for a service in the Firebase console,
  // every request from a local dev server gets rejected (surfaces as a
  // Firestore "Missing or insufficient permissions" error, indistinguishable
  // from a real rules failure). The debug provider is Firebase's own
  // sanctioned way around this: it prints a random token to the console on
  // first run, which then needs registering once in Firebase console → App
  // Check → this web app → "Manage debug tokens" — after that, this same
  // token is reused across restarts (self, not sessionStorage, so it resets
  // on a hard refresh of Vite's page but not on every hot-reload).
  // import.meta.env.DEV is compiled to `false` in a production build, so
  // this branch — and any debug token — never ships to real users.
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("6Lc2kZ0tAAAAAGb_9fvYEVDTwdhu-LGQc3Pvg1Z0"),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);

// Persistent local cache means unsent writes (a sub confirmed, a player marked
// injured) are safe on disk, not just in memory, if the connection drops
// mid-match — the coach doesn't lose anything if the tab gets backgrounded or
// reloaded before it can sync back up. That's a real scenario here, not an
// edge case: a phone in a coach's pocket at a sports field with patchy signal
// is exactly what this app is for. Without this, the existing "you're
// offline — changes will sync once you're back online" message
// (firestoreTeams.js) was a promise the app didn't actually keep across
// anything more than a brief in-memory blip.
//
// persistentMultipleTabManager (rather than the single-tab version) so a
// coach who accidentally has the app open in two tabs on the same phone/
// browser doesn't silently lose persistence in the second one.
//
// Firestore's persistent cache needs IndexedDB, which only exists in a real
// browser — the Firestore emulator test suite (firebase-tests/) imports this
// same `db` but runs under Node.js, where enabling it would throw. Falling
// back to the plain in-memory client there is correct and expected, not a
// missed case: those tests aren't exercising offline behavior anyway.
const hasIndexedDb = typeof indexedDB !== "undefined";
export const db = hasIndexedDb
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : getFirestore(app);
