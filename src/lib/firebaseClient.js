// Firebase project setup for Bench Buddy. This config is not a secret — it's
// meant to be visible in client-side code (Firebase's actual security lives
// in Firestore security rules, not in hiding these values), so it's fine to
// commit directly rather than route through environment variables.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD0beRPZuAhja8VoPVpoyJ2WhFbY4y34ZA",
  authDomain: "bench-buddy-ada85.firebaseapp.com",
  projectId: "bench-buddy-ada85",
  storageBucket: "bench-buddy-ada85.firebasestorage.app",
  messagingSenderId: "159916947909",
  appId: "1:159916947909:web:7507a4324f33cee94733ac",
};

const app = initializeApp(firebaseConfig);

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
