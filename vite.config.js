import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure-function tests only for now (no DOM needed) — keeps this fast
    // and dependency-light. Switch to "jsdom" if/when component tests
    // (e.g. React Testing Library) are added.
    environment: "node",
  },
});
