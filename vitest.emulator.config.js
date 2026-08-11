import { defineConfig } from "vite";

// Separate config for the Firebase emulator integration tests, kept apart
// from vite.config.js so a plain `npm test` (fast, no dependencies running)
// never accidentally tries to run these — they require the Auth + Firestore
// emulators to already be up, which `npm run test:emulator` handles via
// `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["firebase-tests/**/*.test.js"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // These tests share one running emulator instance across files, so run
    // files one at a time rather than in parallel workers to avoid one
    // file's data interfering with another's.
    fileParallelism: false,
  },
});
