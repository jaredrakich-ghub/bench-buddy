import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this as a project site at /bench-buddy/, not the
  // domain root, so built asset URLs need that prefix baked in. Doesn't
  // affect `npm run dev` in a way that matters — Vite serves under the same
  // base locally too.
  base: "/bench-buddy/",
  plugins: [react()],
  test: {
    // Pure-function tests only for now (no DOM needed) — keeps this fast
    // and dependency-light. Switch to "jsdom" if/when component tests
    // (e.g. React Testing Library) are added.
    environment: "node",
    // Scoped to src/ so this plain `npm test` run never picks up the
    // Firebase emulator integration tests in firebase-tests/ — those need
    // the emulators running and are run separately via `npm run test:emulator`
    // (see vitest.emulator.config.js).
    include: ["src/**/*.{test,spec}.js"],
  },
});
