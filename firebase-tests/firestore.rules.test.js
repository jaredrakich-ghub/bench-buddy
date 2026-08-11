// Tests the *security rules themselves* (firestore.rules) in isolation,
// using @firebase/rules-unit-testing. This runs against the local Firestore
// emulator only — never the real bench-buddy-ada85 project — via
// `npm run test:emulator` (see vitest.emulator.config.js).
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
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

describe("firestore.rules — teams collection", () => {
  test("a signed-in user can create a team that lists themself as a member", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    await assertSucceeds(setDoc(ref, { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] }));
  });

  test("create is rejected if the creator's uid is not in memberIds", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "teams", "team1");
    await assertFails(setDoc(ref, { name: "Scorpions", ownerId: "alice", memberIds: ["someone-else"] }));
  });

  test("an unauthenticated user cannot create a team", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "teams", "team1");
    await assertFails(setDoc(ref, { name: "Scorpions", ownerId: "x", memberIds: ["x"] }));
  });

  test("a member can read their team", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(getDoc(doc(alice.firestore(), "teams", "team1")));
  });

  test("a non-member cannot read the team", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const bob = testEnv.authenticatedContext("bob");
    await assertFails(getDoc(doc(bob.firestore(), "teams", "team1")));
  });

  test("a non-member cannot update the team", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const bob = testEnv.authenticatedContext("bob");
    await assertFails(updateDoc(doc(bob.firestore(), "teams", "team1"), { name: "Hacked" }));
  });

  test("a member can update and delete the team", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(updateDoc(doc(alice.firestore(), "teams", "team1"), { name: "Scorpions FC" }));
    await assertSucceeds(deleteDoc(doc(alice.firestore(), "teams", "team1")));
  });

  test("a second member (future collaborator) added to memberIds can also read/update", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice", "bob"] });
    const bob = testEnv.authenticatedContext("bob");
    await assertSucceeds(getDoc(doc(bob.firestore(), "teams", "team1")));
    await assertSucceeds(updateDoc(doc(bob.firestore(), "teams", "team1"), { name: "Scorpions FC" }));
  });
});

describe("firestore.rules — matchState subcollection", () => {
  test("a member can read/write matchState", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const alice = testEnv.authenticatedContext("alice");
    const stateRef = doc(alice.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(setDoc(stateRef, { elapsedSeconds: 120 }));
    await assertSucceeds(getDoc(stateRef));
  });

  test("a non-member cannot read/write matchState", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const bob = testEnv.authenticatedContext("bob");
    const stateRef = doc(bob.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(setDoc(stateRef, { elapsedSeconds: 999 }));
    await assertFails(getDoc(stateRef));
  });

  test("an unauthenticated user cannot read/write matchState", async () => {
    await seedTeam("team1", { name: "Scorpions", ownerId: "alice", memberIds: ["alice"] });
    const anon = testEnv.unauthenticatedContext();
    const stateRef = doc(anon.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(getDoc(stateRef));
  });
});
