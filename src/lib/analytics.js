// Minimal usage instrumentation — launch-audit finding #3: before this,
// there was no way to tell whether anyone was actually using the app once
// the marketing site started sending real strangers to it. Not an
// analytics stack — no SDK, no dashboard, just Firestore writes read
// straight from the Firebase console (query by `name`, or export to
// BigQuery later if that's ever actually needed). Same shape and same
// fire-and-forget/defensive style as crashReports.js, deliberately —
// one small write-only collection, not a new pattern to learn.
//
// EVENT_NAMES is deliberately a closed, small list — firestore.rules
// whitelists these exact strings (see isValidAnalyticsEvent), the same
// "don't accept arbitrary open-ended data" lesson crashReports.js's own
// rule just learned. Add a new event by adding it here AND in the rule,
// not just here.
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebaseClient.js";

export const EVENT_NAMES = {
  ACCOUNT_CREATED: "account_created",
  TEAM_CREATED: "team_created",
  ROTATION_BUILT: "rotation_built",
  MATCH_LINK_CLAIMED: "match_link_claimed",
  AVAILABILITY_ANSWERED: "availability_answered",
};

// teamId is optional — account_created fires before any team exists yet.
export function logEvent(name, { teamId } = {}) {
  try {
    addDoc(collection(db, "events"), {
      name,
      uid: auth.currentUser?.uid || null,
      teamId: teamId || null,
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Losing an analytics event is never worth surfacing to the user —
      // same reasoning as crashReports.js's own silent catch.
    });
  } catch {
    // Never let instrumentation itself become a real error.
  }
}
