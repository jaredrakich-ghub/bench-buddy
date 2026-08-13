// Integration tests for the *actual app module* src/lib/firestoreTeams.js,
// run against the local Auth + Firestore emulators instead of mocks — this
// is what actually caught (or would have caught) things like the duplicate
// "My Team" bug, since it exercises the real Firebase client SDK calls.
//
// Connects the app's real `auth`/`db` singletons to the emulators. This is
// safe because this file only runs via `npm run test:emulator`
// (firebase emulators:exec, project "demo-bench-buddy-test") and never
// otherwise — the real bench-buddy-ada85 project is never touched.
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { auth, db } from "../src/lib/firebaseClient.js";
import {
  fetchTeams,
  createTeamDoc,
  updateTeamDoc,
  deleteTeamDoc,
  fetchMatchState,
  saveMatchState,
} from "../src/lib/firestoreTeams.js";

beforeAll(() => {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
});

afterEach(async () => {
  await signOut(auth).catch(() => {});
});

// Each test signs in as a fresh anonymous user, which gets a brand-new random
// uid from the Auth emulator — that gives every test a clean, isolated slice
// of Firestore data (queries are scoped by uid) without needing a manual
// clearFirestore() step between tests.
async function signInAsNewUser() {
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

describe("firestoreTeams.js against the Firestore emulator", () => {
  test("fetchTeams returns an empty array for a brand new user", async () => {
    const uid = await signInAsNewUser();
    expect(await fetchTeams(uid)).toEqual([]);
  });

  test("createTeamDoc creates a team scoped to the signed-in user", async () => {
    const uid = await signInAsNewUser();
    const created = await createTeamDoc(uid, {
      name: "Scorpions",
      roster: [{ id: "p1", name: "Jack", keeperEligible: true }],
      settings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Scorpions");
    expect(created.ownerId).toBe(uid);
    expect(created.memberIds).toEqual([uid]);

    const teams = await fetchTeams(uid);
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe("Scorpions");
  });

  test("createTeamDoc called twice creates two separate teams (documents the duplicate-team risk)", async () => {
    // This mirrors what React StrictMode's double-invoked effect used to do
    // before the useRef guard was added in SubRotationPlanner.jsx: two
    // concurrent "no teams yet, create a default one" calls produce two
    // teams. The guard lives in the component, not in this module, so this
    // module-level call correctly still allows it — this test documents
    // that the fix has to stay at the call-site.
    const uid = await signInAsNewUser();
    await createTeamDoc(uid, { name: "My Team", roster: [], settings: {} });
    await createTeamDoc(uid, { name: "My Team", roster: [], settings: {} });
    const teams = await fetchTeams(uid);
    expect(teams).toHaveLength(2);
  });

  test("updateTeamDoc persists a rename", async () => {
    const uid = await signInAsNewUser();
    const created = await createTeamDoc(uid, { name: "My Team", roster: [], settings: {} });
    await updateTeamDoc(created.id, { name: "Renamed Team" });
    const teams = await fetchTeams(uid);
    expect(teams[0].name).toBe("Renamed Team");
  });

  test("saveMatchState / fetchMatchState round-trip, and fetchMatchState is null before any save", async () => {
    const uid = await signInAsNewUser();
    const created = await createTeamDoc(uid, { name: "My Team", roster: [], settings: {} });

    expect(await fetchMatchState(created.id)).toBeNull();

    await saveMatchState(created.id, { plan: [], activeInterval: 0, elapsedSeconds: 300, onFieldIds: ["p1"] });
    expect(await fetchMatchState(created.id)).toEqual({ plan: [], activeInterval: 0, elapsedSeconds: 300, onFieldIds: ["p1"] });
  });

  test("deleteTeamDoc removes the team (and does not throw despite an existing matchState)", async () => {
    const uid = await signInAsNewUser();
    const created = await createTeamDoc(uid, { name: "My Team", roster: [], settings: {} });
    await saveMatchState(created.id, { plan: [], activeInterval: 0, elapsedSeconds: 10 });

    // Must not throw — this is exactly what broke before matchState was
    // deleted ahead of the team doc (see the comment in firestoreTeams.js).
    await expect(deleteTeamDoc(created.id)).resolves.not.toThrow();

    expect(await fetchTeams(uid)).toEqual([]);

    // Note: we can't independently verify the matchState subdoc is gone via
    // fetchMatchState here — its security rule proves membership by reading
    // the parent team doc, which no longer exists once the team is deleted,
    // so any read attempt (even for a former member) is correctly denied by
    // the rules themselves. That's fine: the real app never reads matchState
    // for a team it just deleted, and firestore.rules.test.js covers the
    // matchState access rules directly.
  });

  test("fetchTeams only returns teams the signed-in user is a member of", async () => {
    const uidA = await signInAsNewUser();
    await createTeamDoc(uidA, { name: "Alice's Team", roster: [], settings: {} });
    expect(await fetchTeams(uidA)).toHaveLength(1);

    // A different signed-in user querying their own (empty) uid sees none of
    // A's teams — matches the only query shape the app ever actually makes
    // (always the current user's own uid).
    await signOut(auth);
    const uidB = await signInAsNewUser();
    expect(await fetchTeams(uidB)).toEqual([]);
  });
});
