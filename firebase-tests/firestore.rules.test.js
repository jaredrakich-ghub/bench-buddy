// Tests the *security rules themselves* (firestore.rules) in isolation,
// using @firebase/rules-unit-testing. This runs against the local Firestore
// emulator only — never the real bench-buddy-ada85 project — via
// `npm run test:emulator` (see vitest.emulator.config.js).
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

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

  // Launch-audit finding: nothing used to stop a member editing memberIds
  // itself — not reachable through today's UI, but real via a direct
  // Firestore call. A member may only ever add or remove their OWN uid.
  test("a member cannot remove another member from memberIds", async () => {
    await seedTeam("team1", validTeam({ memberIds: ["alice", "bob"] }));
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(updateDoc(doc(alice.firestore(), "teams", "team1"), { memberIds: ["alice"] }));
  });

  test("a member can remove themself from memberIds (leaving)", async () => {
    await seedTeam("team1", validTeam({ memberIds: ["alice", "bob"] }));
    const bob = testEnv.authenticatedContext("bob");
    await assertSucceeds(updateDoc(doc(bob.firestore(), "teams", "team1"), { memberIds: ["alice"] }));
  });

  test("a member cannot add an arbitrary stranger to memberIds", async () => {
    await seedTeam("team1", validTeam());
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(updateDoc(doc(alice.firestore(), "teams", "team1"), { memberIds: ["alice", "stranger"] }));
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
  // Matches crashReports.js's own real write shape exactly — the rule now
  // enforces this, so a fixture that doesn't match it isn't testing the
  // real thing.
  const validReport = (overrides = {}) => ({
    message: "boom",
    stack: "at foo (bar.js:1:1)",
    componentStack: "in Foo",
    uid: "alice",
    url: "https://app.benchbuddysports.com/",
    userAgent: "Mozilla/5.0",
    createdAt: serverTimestamp(),
    ...overrides,
  });

  test("a signed-in user can file a real-shaped crash report", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const ref = doc(alice.firestore(), "crashReports", "report1");
    await assertSucceeds(setDoc(ref, validReport()));
  });

  test("an unauthenticated user can also file a crash report (e.g. a crash before sign-in)", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertSucceeds(setDoc(ref, validReport({ uid: null })));
  });

  // Launch-audit finding: this collection used to accept `if true` — any
  // shape, any size, from anyone. These are the tests for the fix.
  test("rejects a message longer than the client's own 2000-char cap", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertFails(setDoc(ref, validReport({ message: "x".repeat(2001) })));
  });

  test("rejects a stack longer than the client's own 4000-char cap", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertFails(setDoc(ref, validReport({ stack: "x".repeat(4001) })));
  });

  test("rejects a document with an extra field the client never sends", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertFails(setDoc(ref, validReport({ somethingElse: "x" })));
  });

  test("rejects a document missing a required field", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    const { userAgent: _userAgent, ...withoutUserAgent } = validReport();
    await assertFails(setDoc(ref, withoutUserAgent));
  });

  test("rejects a forged createdAt instead of the real serverTimestamp() sentinel", async () => {
    const anon = testEnv.unauthenticatedContext();
    const ref = doc(anon.firestore(), "crashReports", "report1");
    await assertFails(setDoc(ref, validReport({ createdAt: new Date("2020-01-01") })));
  });

  test("nobody can read, update, or delete a crash report through the app — not even its author", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "crashReports", "report1"), validReport());
    });
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(getDoc(doc(alice.firestore(), "crashReports", "report1")));
    await assertFails(updateDoc(doc(alice.firestore(), "crashReports", "report1"), { message: "edited" }));
    await assertFails(deleteDoc(doc(alice.firestore(), "crashReports", "report1")));
  });
});

// Launch-audit finding #3 — minimal usage instrumentation (analytics.js).
// Same shape/rigor as crashReports above: a closed event-name list rather
// than an open string, since that's the exact lesson crashReports' own
// rule just learned.
describe("firestore.rules — events collection (analytics)", () => {
  const validEvent = (overrides = {}) => ({
    name: "team_created",
    uid: "alice",
    teamId: "team1",
    createdAt: serverTimestamp(),
    ...overrides,
  });

  test("a signed-in user can log a real event", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(setDoc(doc(alice.firestore(), "events", "event1"), validEvent()));
  });

  test("an event with no teamId yet is fine (account_created, before any team exists)", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertSucceeds(setDoc(doc(alice.firestore(), "events", "event1"), validEvent({ name: "account_created", teamId: null })));
  });

  test("a signed-out caller cannot log an event", async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(setDoc(doc(anon.firestore(), "events", "event1"), validEvent()));
  });

  test("rejects an event name outside the known list", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(setDoc(doc(alice.firestore(), "events", "event1"), validEvent({ name: "something_made_up" })));
  });

  test("rejects an extra field", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(setDoc(doc(alice.firestore(), "events", "event1"), validEvent({ extra: "x" })));
  });

  test("nobody can read, update, or delete an event through the app", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "events", "event1"), validEvent());
    });
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(getDoc(doc(alice.firestore(), "events", "event1")));
    await assertFails(updateDoc(doc(alice.firestore(), "events", "event1"), { name: "edited" }));
    await assertFails(deleteDoc(doc(alice.firestore(), "events", "event1")));
  });
});
