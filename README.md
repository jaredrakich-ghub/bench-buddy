# Bench Buddy

A sideline substitution rotation planner for 5-a-side youth football —
fair playing time, fair goalkeeper time, a live match timer, and manual
overrides for injuries and swaps.

Live at **<https://benchbuddysports.com/>**.

This started as a single component built as a Claude.ai "artifact." It's
since grown into a real account-backed app — Google sign-in, Firestore
sync across devices, multiple teams per account — but the core rotation
algorithm is still the same idea it started as: a set of plain,
UI-independent functions that decide who's fair to play, bench, or keep
next.

## How it's put together

- **The rules** (`src/lib/rotation.js`, plus `clock.js`, `formation.js`,
  `teams.js`, `validation.js`) — the fairness algorithm and its supporting
  logic. Plain functions, no React or Firebase involved, each with its own
  test file.
- **The screens** (`src/components/`) — React components for sign-in, team
  setup, and the live match view.
- **App state** (`src/hooks/`) — two hooks: `useTeamRegistry` (which teams
  exist, which is active) and `useMatchState` (the plan, clock, and
  injuries for whichever match is currently running).
- **Firebase** (`src/lib/firebaseClient.js`, `auth.js`, `firestoreTeams.js`,
  `crashReports.js`) — Google sign-in and a Firestore database. There's no
  separate backend server for the app itself; the browser talks to Firebase
  directly, and `firestore.rules` is what keeps one account's data private
  from another.
- **Cloud Functions** (`functions/`) — the one place there *is* a small
  server-side piece: Match Link's "ask for an email first" flow needs an
  actual email sent (`sendMatchLinkClaimEmail`, triggered off a Firestore
  write, sending via Resend's API). Its own `package.json`/dependencies are
  separate from the root app — Cloud Functions run in their own Node
  process, not the browser bundle.

```
sub-tracker/
├── firestore.rules          Database security rules (deployed separately — see below)
├── firebase.json / .firebaserc   Local emulator config
├── functions/                Cloud Functions (deployed separately — see below)
├── src/
│   ├── main.jsx               Boots React
│   ├── App.jsx                 Top-level wiring (sign-in gate → the app)
│   ├── components/             Screens
│   ├── hooks/                  App state
│   └── lib/                    The rules, plus Firebase/storage plumbing
└── firebase-tests/            Integration tests against the Firestore emulator
```

## Running it locally

You'll need [Node.js](https://nodejs.org) 22 or later.

```bash
npm install     # downloads dependencies into node_modules
npm run dev     # starts a local dev server, usually at http://localhost:5173
```

Open the URL it prints. Changes to any file under `src/` reload the page
automatically. This talks to the real Firebase project — Google sign-in
works normally.

## Testing

```bash
npm test              # pure-logic tests (fast, no dependencies running)
npm run test:emulator # Firestore rules + data-layer tests, against a local emulator
```

The emulator suite spins up a temporary, local-only Firestore + Auth
instance (a `demo-` prefixed project — see `.firebaserc`) and never touches
the real database. Both suites run automatically in CI on every push.

## Building for real deployment

```bash
npm run build     # outputs a production-ready static site into dist/
npm run preview   # lets you check the production build locally
```

The `dist/` folder is a plain static site — no server-side code involved.

## Deployment

Pushing to `main` automatically builds and deploys the app to GitHub Pages
(see `.github/workflows/deploy.yml`) — both test suites have to pass first.

**`firestore.rules` deploys automatically too**, in its own job (`deploy-rules`
in that same workflow) right after those same test suites pass — so the
deployed rules can never drift out of sync with what's committed. It's
authenticated via a service account key stored as the `FIREBASE_SERVICE_ACCOUNT`
repository secret (Settings > Secrets and variables > Actions).

**So does `functions/`**, in its own job (`deploy-functions`), same service
account. Cloud Functions deploys need a much broader set of IAM roles than
a plain rules deploy — that same service account currently carries all of:
Firebase Rules Admin, Firebase Viewer, Secret Manager Secret Accessor,
Secret Manager Viewer, Service Account User, and Service Usage Consumer.
Each was added one at a time, from the specific permission error the
previous attempt actually hit (via GCP Console > IAM & Admin > IAM > find
the service account > edit > Add another role) — the exact set above is
what it took to get a green deploy, not a principled minimum worked out in
advance.

A manual deploy is still occasionally useful (checking a local edit before
pushing, or if CI itself is down):

```bash
npx firebase login
npx firebase deploy --only firestore:rules --project bench-buddy-ada85
npx firebase deploy --only functions --project bench-buddy-ada85
```

The `--project` flag matters — `.firebaserc`'s default project is the
emulator-only `demo-bench-buddy-test`, not the real one.

`functions/` also needs its own `RESEND_API_KEY` secret, set once (not
part of CI — it doesn't change on every deploy):

```bash
npx firebase functions:secrets:set RESEND_API_KEY --project bench-buddy-ada85
```

## Credits

The header mascot (`src/assets/header-mascot.svg`) is Vecteezy's
["AI Reimagine" vector re-render](https://www.vecteezy.com/vector-art/49165452-soccer-player-with-ball-flat-style-element-illustration-on-white-background-free-vector)
of the same free illustration used before (previously shipped as a JPG),
used under Vecteezy's free license, which requires attribution.
