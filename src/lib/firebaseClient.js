// Firebase project setup for Bench Buddy. This config is not a secret — it's
// meant to be visible in client-side code (Firebase's actual security lives
// in Firestore security rules, not in hiding these values), so it's fine to
// commit directly rather than route through environment variables.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
