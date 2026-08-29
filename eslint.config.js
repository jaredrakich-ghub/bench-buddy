import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Added after a real production crash (Minified React error #310) traced
// back to two new hooks landing after an early `return <LoadingScreen/>`
// — a Rules of Hooks violation that shipped because nothing was checking
// for it. eslint-plugin-react-hooks' own recommended config is exactly
// built to catch that class of mistake before it ships, so that's the
// one non-negotiable piece here. js.configs.recommended rides along for
// the same reason (undefined variables, unreachable code, etc.) — real
// bugs a linter catches for free, not style opinions. eslint-plugin-react
// itself is only here so plain no-unused-vars actually understands JSX
// (`<Foo />` counting as using the `Foo` import) — without it, every
// component imported and only ever used in JSX reads as "unused",
// which is noise, not signal.
//
// Deliberately NOT pulling in a style/formatting rule set (no
// eslint-config-prettier, no import-order, no max-len) — this exists to
// catch mistakes, not to relitigate this codebase's existing conventions
// (inline-style objects, comment density, etc.) against a generic
// preset it was never written against.
export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          args: "after-used",
          // `const { keeperEligible, ...rest } = player;` (real pattern in
          // this codebase, e.g. the firestore.rules tests' own
          // `const { roster, ...noRoster } = validTeam();`) genuinely
          // means to discard `keeperEligible`/`roster` — that's the whole
          // point of the destructure, not an accidental unused variable.
          ignoreRestSiblings: true,
        },
      ],
      // The new JSX transform (this project's own Vite/React setup)
      // never needs React itself in scope just to write JSX — this rule
      // predates that transform and would otherwise demand an import
      // this codebase deliberately doesn't make in most files.
      "react/react-in-jsx-scope": "off",
      // No PropTypes anywhere in this codebase (plain JS, not TypeScript,
      // and props aren't runtime-validated) — enabling this would demand
      // adding them project-wide for a check this project never opted into.
      "react/prop-types": "off",
      // This codebase's own copy voice runs on contractions and
      // possessives ("Who's here", "the coach's own pick") — a real,
      // deliberate style choice throughout every screen, not something
      // worth escaping into HTML entities just to satisfy a linter.
      "react/no-unescaped-entities": "off",
      // Two spots already carried `// eslint-disable-next-line no-console`
      // in anticipation of this — a deliberate crash-diagnostic log
      // (ErrorBoundary.jsx) and a diagnostic test printout
      // (fixedRotation.fairness.test.js). Warn, not error: a stray
      // debugging console.log left behind is exactly the kind of thing
      // worth a nudge, without blocking a build over it outright.
      "no-console": "warn",
    },
  },
  {
    // Test files run under Vitest's own injected globals (describe/it/
    // expect/vi/...) — without these, every test file would falsely
    // flag them as undefined.
    files: ["**/*.test.{js,jsx}", "vitest.emulator.config.js"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.vitest },
    },
  },
  {
    // design_handoff_bench_buddy_match_day/ is a reference/mockup
    // artifact sitting in the working tree (untracked — not part of this
    // app's own source, generated-looking minified names throughout) —
    // not something this project maintains or ships, so it's not this
    // linter's job to grade it.
    // public/sw.js: a raw service worker, served as-is (Vite's convention
    // for public/) — runs in the service-worker global scope (self,
    // caches, clients), not the browser/Node globals this config's other
    // rules assume, so it's not this linter's job either.
    ignores: ["dist/**", "node_modules/**", "docs/design_handoff_bench_buddy_match_day/**", "public/**"],
  },
];
