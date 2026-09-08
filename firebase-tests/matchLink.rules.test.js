// Tests the Match Link additions to firestore.rules — matchHandover itself,
// plus how an active claim holder's access to matchState differs from a
// regular team member's. Same emulator-only setup as
// firestore.rules.test.js; see that file's own header comment.
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

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

async function seedTeam(teamId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "teams", teamId), data);
  });
}

async function seedHandover(teamId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "teams", teamId, "matchHandover", "current"), data);
  });
}

async function seedMatchState(teamId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "teams", teamId, "matchState", "current"), data);
  });
}

const validTeam = (overrides = {}) => ({ name: "Tigers FC", roster: [], settings: {}, ownerId: "coach-uid", memberIds: ["coach-uid"], ...overrides });

// A genuinely active handover, claimed by "parent-uid" — the fixture most
// tests below start from. Individual tests override just the field that
// makes them interesting (revokedAt, expiresAt, claim itself).
const activeHandover = (overrides = {}) => ({
  level: "subs",
  createdAt: Date.now() - 10_000,
  createdBy: "coach-uid",
  stopsAtFullTime: true,
  expiresAt: Date.now() + 3_600_000,
  revokedAt: null,
  requireEmailClaim: true,
  claimToken: "tok-123",
  claim: {
    email: "parent@example.com",
    claimedAt: Date.now() - 5_000,
    claimedByUid: "parent-uid",
    deviceBoundAt: Date.now() - 5_000,
    revokedAt: null,
  },
  ...overrides,
});

describe("firestore.rules — matchHandover subcollection", () => {
  test("a team member can create and read the handover doc", async () => {
    await seedTeam("team1", validTeam());
    const coach = testEnv.authenticatedContext("coach-uid");
    const ref = doc(coach.firestore(), "teams", "team1", "matchHandover", "current");
    await assertSucceeds(setDoc(ref, activeHandover()));
    await assertSucceeds(getDoc(ref));
  });

  test("a non-member, non-holder cannot read the handover doc", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "matchHandover", "current");
    await assertFails(getDoc(ref));
  });

  test("the active holder can read the handover doc even though they are not a team member", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover());
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "matchHandover", "current");
    await assertSucceeds(getDoc(ref));
  });

  test("the active holder cannot write the handover doc — claiming is not wired up yet (Step 2)", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover());
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "matchHandover", "current");
    await assertFails(updateDoc(ref, { revokedAt: Date.now() }));
  });

  test("a non-member cannot create a handover for a team they don't belong to", async () => {
    await seedTeam("team1", validTeam());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "matchHandover", "current");
    await assertFails(setDoc(ref, activeHandover({ claim: null })));
  });
});

describe("firestore.rules — matchState access for an active holder", () => {
  test("an active holder can read and write non-clock fields", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover());
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const parent = testEnv.authenticatedContext("parent-uid");
    const stateRef = doc(parent.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(getDoc(stateRef));
    await assertSucceeds(updateDoc(stateRef, { activeInterval: 1 }));
  });

  // The real-use correction this model is built around: level is display-
  // only, so a "subs" level holder owns the clock too, exactly like "full"
  // does — there is no split state where the parent has subs and the coach
  // still has the clock.
  test("a 'subs' level holder can control the clock too — level does not gate it", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover({ level: "subs" }));
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const parent = testEnv.authenticatedContext("parent-uid");
    const stateRef = doc(parent.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(updateDoc(stateRef, { timerRunning: true }));
  });

  test("the coach's own clock write is rejected while a handover is active", async () => {
    // The real-use correction this whole model is built around: handing
    // over moves clock ownership away from the coach too, not just grants
    // the parent a copy of it.
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover());
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const coach = testEnv.authenticatedContext("coach-uid");
    const stateRef = doc(coach.firestore(), "teams", "team1", "matchState", "current");
    // The coach can still make a sub...
    await assertSucceeds(updateDoc(stateRef, { activeInterval: 1 }));
    // ...but not touch the clock, while the handover is active.
    await assertFails(updateDoc(stateRef, { timerRunning: true }));
  });

  test("the coach regains the clock once the handover is revoked", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover({ revokedAt: Date.now() - 1000 }));
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const coach = testEnv.authenticatedContext("coach-uid");
    const stateRef = doc(coach.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(updateDoc(stateRef, { timerRunning: true }));
  });

  test("a revoked holder cannot write matchState at all, clock or otherwise", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover({ revokedAt: Date.now() - 1000 }));
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const parent = testEnv.authenticatedContext("parent-uid");
    const stateRef = doc(parent.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(updateDoc(stateRef, { activeInterval: 1 }));
    await assertFails(updateDoc(stateRef, { timerRunning: true }));
  });

  test("an expired holder cannot write matchState", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover({ expiresAt: Date.now() - 1000 }));
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const parent = testEnv.authenticatedContext("parent-uid");
    const stateRef = doc(parent.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(updateDoc(stateRef, { activeInterval: 1 }));
  });

  test("someone who has not claimed the link at all cannot write matchState", async () => {
    await seedTeam("team1", validTeam());
    await seedHandover("team1", activeHandover({ claim: null }));
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const stranger = testEnv.authenticatedContext("someone-else-uid");
    const stateRef = doc(stranger.firestore(), "teams", "team1", "matchState", "current");
    await assertFails(updateDoc(stateRef, { activeInterval: 1 }));
  });

  test("a team with no handover at all works exactly as before — regular members only", async () => {
    await seedTeam("team1", validTeam());
    await seedMatchState("team1", { plan: [], activeInterval: 0, baseElapsedSec: 0, runStartedAt: null, timerRunning: false });
    const coach = testEnv.authenticatedContext("coach-uid");
    const stateRef = doc(coach.firestore(), "teams", "team1", "matchState", "current");
    await assertSucceeds(updateDoc(stateRef, { timerRunning: true }));
    const stranger = testEnv.authenticatedContext("stranger-uid");
    await assertFails(getDoc(doc(stranger.firestore(), "teams", "team1", "matchState", "current")));
  });
});
