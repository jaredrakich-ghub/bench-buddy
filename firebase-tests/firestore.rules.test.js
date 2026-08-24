// Tests the *security rules themselves* (firestore.rules) in isolation,
// using @firebase/rules-unit-testing. This runs against the local Firestore
// emulator only — never the real bench-buddy-ada85 project — via
// `npm run test:emulator` (see vitest.emulator.config.js).
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-bench-buddy-test",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Helper: write a team document straight to the emulator, bypassing rules,
// so tests can set up fixture data without that setup itself being subject
// to the rules under test.
async function seedTeam(teamId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "teams", teamId), data);
  });
}

// A minimal, shape-valid team — most tests below only care about
// permissions (who can do what), not content, so this is the baseline they
// build on rather than each hand-rolling every required field.
const validTeam = (overrides = {}) => ({ name: "Scorpions", roster: [], settings: {}, ownerId: "alice", memberIds: ["alice"], ...overrides });

describe("firestore.rules — teams collection", () => {
  test("a signed-in user can create a team that lists themself as a member", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    await assertSucceeds(setDoc(ref, validTeam()));
  });

  test("create is rejected if the creator's uid is not in memberIds", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    await assertFails(setDoc(ref, validTeam({ memberIds: ["someone-else"] })));
  });

  test("an unauthenticated user cannot create a team", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "teams", "team1");
    await assertFails(setDoc(ref, validTeam({ ownerId: "x", memberIds: ["x"] })));
  });

  test("create is rejected if roster or settings is missing entirely", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    const { roster, ...noRoster } = validTeam();
    await assertFails(setDoc(ref, noRoster));
  });

  test("create is rejected if memberIds is empty", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    await assertFails(setDoc(ref, validTeam({ memberIds: [] })));
  });

  test("a member can read their team", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(getDoc(doc(alice.firestore(), "teams", "team1")));
  });

  test("a non-member cannot read the team", async () => {
    await seedTeam("team1", validTeam());
    const bob = testEnv.authenticatedContext("bob");
    await assertFails(getDoc(doc(bob.firestore(), "teams", "team1")));
  });

  test("a non-member cannot update the team", async () => {
    await seedTeam("team1", validTeam());
    const bob = testEnv.authenticatedContext("bob");
    await assertFails(updateDoc(doc(bob.firestore(), "teams", "team1"), { name: "Hacked" }));
  });

  test("a member can update and delete the team", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(updateDoc(doc(alice.firestore(), "teams", "team1"), { name: "Scorpions FC" }));
    await assertSucceeds(deleteDoc(doc(alice.firestore(), "teams", "team1")));
  });

  test("a second member (future collaborator) added to memberIds can also read/update", async () => {
    await seedTeam("team1", validTeam({ memberIds: ["alice", "bob"] }));
    const bob = testEnv.authenticatedContext("bob");
    await assertSucceeds(getDoc(doc(bob.firestore(), "teams", "team1")));
    await assertSucceeds(updateDoc(doc(bob.firestore(), "teams", "team1"), { name: "Scorpions FC" }));
  });
});

describe("firestore.rules — matchState subcollection", () => {
  test("a member can read/write matchState", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    const stateRef = doc(alice.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(setDoc(stateRef, { plan: [], activeInterval: 0 }));
    await assertSucceeds(getDoc(stateRef));
  });

  test("a non-member cannot read/write matchState", async () => {
    await seedTeam("team1", validTeam());
    const bob = testEnv.authenticatedContext("bob");
    const stateRef = doc(bob.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(setDoc(stateRef, { plan: [], activeInterval: 0 }));
    await assertFails(getDoc(stateRef));
  });

  test("an unauthenticated user cannot read/write matchState", async () => {
    await seedTeam("team1", validTeam());
    const anon = testEnv.unauthenticatedContext();
    const stateRef = doc(anon.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(getDoc(stateRef));
  });

  test("a member's write is rejected if plan or activeInterval is missing", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    const stateRef = doc(alice.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(setDoc(stateRef, { activeInterval: 0 })); // no plan
    await assertFails(setDoc(stateRef, { plan: [] })); // no activeInterval
  });
});

describe("firestore.rules — games subcollection (season history)", () => {
  test("a member can read/write an archived game", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    const gameRef = doc(alice.firestore(), "teams", "team1", "games", "game1");
    await assertSucceeds(setDoc(gameRef, { date: Date.now(), players: [{ id: "p1", outfieldMin: 30 }] }));
    await assertSucceeds(getDoc(gameRef));
  });

  test("a non-member cannot read or write an archived game", async () => {
    await seedTeam("team1", validTeam());
    const bob = testEnv.authenticatedContext("bob");
    const gameRef = doc(bob.firestore(), "teams", "team1", "games", "game1");
    await assertFails(setDoc(gameRef, { date: Date.now(), players: [] }));
    await assertFails(getDoc(gameRef));
  });

  test("content shape is not enforced — deliberately permissive so new per-player fields don't need a rules change", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    const gameRef = doc(alice.firestore(), "teams", "team1", "games", "game1");
    // No "date" or "players" at all — still succeeds, since only membership is checked here.
    await assertSucceeds(setDoc(gameRef, { anything: "goes" }));
  });
});

describe("firestore.rules — crashReports collection", () => {
  test("a signed-in user can file a crash report", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "crashReports", "report1");
    await assertSucceeds(setDoc(ref, { message: "boom", uid: "alice" }));
  });

  test("an unauthenticated user can also file a crash report (e.g. a crash before sign-in)", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertSucceeds(setDoc(ref, { message: "boom", uid: null }));
  });

  test("nobody can read, update, or delete a crash report through the app — not even its author", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "crashReports", "report1"), { message: "boom" });
    });
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(getDoc(doc(alice.firestore(), "crashReports", "report1")));
    await assertFails(updateDoc(doc(alice.firestore(), "crashReports", "report1"), { message: "edited" }));
    await assertFails(deleteDoc(doc(alice.firestore(), "crashReports", "report1")));
  });
});
