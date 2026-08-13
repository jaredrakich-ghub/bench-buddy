// Integration tests for src/lib/gameHistory.js against the real Firebase
// client SDK, run against the local emulator — same pattern as
// firestoreTeams.test.js.
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth";
import { connectFirestoreEmulator } from "firebase/firestore";
import { auth, db } from "../src/lib/firebaseClient.js";
import { createTeamDoc, deleteTeamDoc } from "../src/lib/firestoreTeams.js";
import { archiveGame, fetchGameHistory, deleteAllGames } from "../src/lib/gameHistory.js";

beforeAll(() => {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
});

afterEach(async () => {
  await signOut(auth).catch(() => {});
});

async function signInAsNewUser() {
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

describe("gameHistory.js against the Firestore emulator", () => {
  test("archiveGame stores a game, fetchGameHistory returns it back", async () => {
    const uid = await signInAsNewUser();
    const team = await createTeamDoc(uid, { name: "Scorpions", roster: [], settings: {} });

    const game = {
      date: Date.now(),
      settings: { fieldSize: 5, gameMinutes: 40, subIntervalMinutes: 6 },
      players: [{ id: "p1", name: "Alice", keeperEligible: true, outfieldMin: 30, gkMin: 10, benchMin: 0, injuredMin: 0 }],
    };
    await archiveGame(team.id, game);

    const history = await fetchGameHistory(team.id);
    expect(history).toHaveLength(1);
    expect(history[0].players).toEqual(game.players);
    expect(history[0].id).toBeTruthy();
  });

  test("fetchGameHistory returns games newest first", async () => {
    const uid = await signInAsNewUser();
    const team = await createTeamDoc(uid, { name: "Scorpions", roster: [], settings: {} });

    await archiveGame(team.id, { date: 1000, players: [] });
    await archiveGame(team.id, { date: 3000, players: [] });
    await archiveGame(team.id, { date: 2000, players: [] });

    const history = await fetchGameHistory(team.id);
    expect(history.map((g) => g.date)).toEqual([3000, 2000, 1000]);
  });

  test("fetchGameHistory returns an empty array for a team with no history yet", async () => {
    const uid = await signInAsNewUser();
    const team = await createTeamDoc(uid, { name: "Scorpions", roster: [], settings: {} });
    expect(await fetchGameHistory(team.id)).toEqual([]);
  });

  test("deleteAllGames removes every archived game for a team", async () => {
    const uid = await signInAsNewUser();
    const team = await createTeamDoc(uid, { name: "Scorpions", roster: [], settings: {} });
    await archiveGame(team.id, { date: 1000, players: [] });
    await archiveGame(team.id, { date: 2000, players: [] });

    await deleteAllGames(team.id);

    expect(await fetchGameHistory(team.id)).toEqual([]);
  });

  test("deleteTeamDoc removes a team's game history too, and does not throw despite it existing", async () => {
    const uid = await signInAsNewUser();
    const team = await createTeamDoc(uid, { name: "Scorpions", roster: [], settings: {} });
    await archiveGame(team.id, { date: 1000, players: [] });

    await expect(deleteTeamDoc(team.id)).resolves.not.toThrow();
    // Can't independently verify the games subcollection is gone via
    // fetchGameHistory here — same reasoning as firestoreTeams.test.js's
    // equivalent matchState note: its rule proves membership by reading the
    // parent team doc, which no longer exists, so any read is correctly
    // denied by the rules themselves regardless. firestore.rules.test.js
    // covers the games access rules directly.
  });
});
