// Tests the Availability-link additions to firestore.rules. Same
// emulator-only setup as firestore.rules.test.js/matchLink.rules.test.js —
// see firestore.rules.test.js's own header comment.
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

async function seedAvailability(teamId, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "teams", teamId, "availability", "current"), data);
  });
}

const validTeam = (overrides = {}) => ({ name: "Tigers FC", roster: [], settings: {}, ownerId: "coach-uid", memberIds: ["coach-uid"], ...overrides });

const SQUAD = [
  { id: "c1", name: "Alex", number: 1 },
  { id: "c2", name: "Ben", number: 2 },
];

const validRequest = (overrides = {}) => ({
  createdAt: Date.now() - 10_000,
  createdBy: "coach-uid",
  closingAt: Date.now() + 3_600_000,
  reopenedAt: null,
  revokedAt: null,
  token: "share-tok",
  squad: SQUAD,
  answers: {},
  ...overrides,
});

describe("firestore.rules — availability subcollection: coach access", () => {
  test("a team member can create, read, and update the availability request", async () => {
    await seedTeam("team1", validTeam());
    const coach = testEnv.authenticatedContext("coach-uid");
    const ref = doc(coach.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(setDoc(ref, validRequest()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { closingAt: Date.now() + 7_200_000 }));
  });

  test("a non-member cannot create an availability request for a team they don't belong to", async () => {
    await seedTeam("team1", validTeam());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "availability", "current");
    await assertFails(setDoc(ref, validRequest()));
  });

  test("a malformed request (missing required fields) is rejected even from the coach", async () => {
    await seedTeam("team1", validTeam());
    const coach = testEnv.authenticatedContext("coach-uid");
    const ref = doc(coach.firestore(), "teams", "team1", "availability", "current");
    await assertFails(setDoc(ref, { createdAt: Date.now() })); // missing squad/answers/token/etc
  });
});

describe("firestore.rules — availability subcollection: the public read", () => {
  test("any authenticated caller can read the request, not just a team member", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(getDoc(ref));
  });

  test("a signed-out caller still cannot read it", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest());
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "teams", "team1", "availability", "current");
    await assertFails(getDoc(ref));
  });
});

describe("firestore.rules — availability subcollection: the public answer write", () => {
  test("presenting the real token lets a stranger answer for any child", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest());
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(updateDoc(ref, {
      "answers.c1": { status: "in", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "share-tok",
    }));
  });

  test("is rejected with a guessed or wrong token", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "availability", "current");
    await assertFails(updateDoc(ref, {
      "answers.c1": { status: "in", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "wrong-guess",
    }));
  });

  test("a second parent can answer for a DIFFERENT child with the same token — concurrent answers are the accepted design", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest({ answers: { c1: { status: "in", noteChips: [], noteText: "", answeredAt: 1, changedAt: 1 } } }));
    const otherParent = testEnv.authenticatedContext("other-parent-uid");
    const ref = doc(otherParent.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(updateDoc(ref, {
      "answers.c2": { status: "out", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "share-tok",
    }));
  });

  test("re-answering (changing an existing answer) succeeds with the real token — last write wins", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest({ answers: { c1: { status: "in", noteChips: [], noteText: "", answeredAt: 1, changedAt: 1 } } }));
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(updateDoc(ref, {
      "answers.c1": { status: "out", noteChips: ["late"], noteText: "Family thing", answeredAt: 1, changedAt: Date.now() },
      lastAnsweredViaToken: "share-tok",
    }));
  });

  test("still accepted after the closing time has passed — closing time never gates an answer", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest({ closingAt: Date.now() - 60_000 }));
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "availability", "current");
    await assertSucceeds(updateDoc(ref, {
      "answers.c1": { status: "in", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "share-tok",
    }));
  });

  test("is rejected once the request is revoked, even with the real token", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest({ revokedAt: Date.now() - 1000 }));
    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "availability", "current");
    await assertFails(updateDoc(ref, {
      "answers.c1": { status: "in", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "share-tok",
    }));
  });

  test("a public write cannot touch any field outside answers/lastAnsweredViaToken", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest());
    const stranger = testEnv.authenticatedContext("stranger-uid");
    const ref = doc(stranger.firestore(), "teams", "team1", "availability", "current");
    await assertFails(updateDoc(ref, { revokedAt: Date.now(), lastAnsweredViaToken: "share-tok" }));
    await assertFails(updateDoc(ref, { squad: [], lastAnsweredViaToken: "share-tok" }));
  });

  test("regenerating the token invalidates a stale public write attempt", async () => {
    await seedTeam("team1", validTeam());
    await seedAvailability("team1", validRequest({ token: "old-tok" }));
    const coach = testEnv.authenticatedContext("coach-uid");
    await setDoc(doc(coach.firestore(), "teams", "team1", "availability", "current"), validRequest({ token: "new-tok" }));

    const parent = testEnv.authenticatedContext("parent-uid");
    const ref = doc(parent.firestore(), "teams", "team1", "availability", "current");
    await assertFails(updateDoc(ref, {
      "answers.c1": { status: "in", noteChips: [], noteText: "", answeredAt: Date.now(), changedAt: Date.now() },
      lastAnsweredViaToken: "old-tok",
    }));
  });
});
