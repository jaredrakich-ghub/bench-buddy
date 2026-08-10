# Sub Tracker

A sideline substitution rotation planner for 5-a-side youth football —
fair playing time, fair goalkeeper time, a live match timer, and manual
overrides for injuries and swaps.

This project wraps the original component (built as a Claude.ai
"artifact") in a standard Vite + React setup so it can live in GitHub,
run locally, and be deployed anywhere.

## Project structure

```
sub-tracker/
├── index.html              Entry HTML page Vite serves
├── package.json             Dependencies + npm scripts
├── vite.config.js           Build tool config
├── src/
│   ├── main.jsx              Boots React, loads the storage shim first
│   ├── App.jsx                Renders the SubRotationPlanner component
│   ├── index.css              Minimal global reset (component styles itself inline)
│   ├── components/
│   │   └── SubRotationPlanner.jsx   The app itself — unchanged from the original
│   └── lib/
│       └── storage.js         Replaces window.storage with a localStorage version
```

## What actually changed from the original file

**Nothing in the app's logic or UI.** The only adaptation was storage.

The component was written to run inside Claude.ai, which injects a
`window.storage` object for saving data server-side, tied to your
account. Outside that environment `window.storage` doesn't exist, so
`src/lib/storage.js` recreates the same methods (`get`, `set`, `delete`,
`list`) using the browser's built-in `localStorage` instead, and attaches
itself to `window.storage` automatically.

**The trade-off:** data now lives in whichever browser you open the app
in, rather than syncing to an account across devices. On the sideline,
that means using the same phone/browser each week. If you outgrow that
later, you could point `src/lib/storage.js` at a real backend (e.g. a
tiny cloud database) without touching the component at all — the whole
point of the shim is that the app doesn't know or care where its data
actually lives.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (the LTS version is fine).

```bash
npm install     # downloads dependencies into node_modules
npm run dev     # starts a local dev server, usually at http://localhost:5173
```

Open the URL it prints. Changes to any file under `src/` reload the page
automatically.

## Building for real deployment

```bash
npm run build     # outputs a production-ready static site into dist/
npm run preview   # lets you check the production build locally
```

The `dist/` folder is a plain static site — it can be hosted on Vercel,
Netlify, GitHub Pages, or any static host, since there's no server-side
code involved.

## Putting this in GitHub

From inside this folder:

```bash
git init
git add .
git commit -m "Initial commit: Sub Tracker"
```

Then create an empty repository on GitHub (no README/license, since you
already have files), and follow GitHub's instructions to push an
existing repo, which will look like:

```bash
git remote add origin https://github.com/<your-username>/sub-tracker.git
git branch -M main
git push -u origin main
```

## Working on it with Claude Code

Open this folder in Claude Code (or point it at the cloned repo). Since
this is now a normal Vite project, you can ask Claude Code for things
like:

- "Run the dev server and take a screenshot"
- "Add a new field to the game settings form"
- "Set up GitHub Actions to deploy this to GitHub Pages on every push"
- "Add automated tests for the rotation algorithm"

The rotation logic itself lives near the top of
`src/components/SubRotationPlanner.jsx` (the `generatePlan` function) —
that's the core algorithm if you ever want Claude Code to explain or
extend it.
