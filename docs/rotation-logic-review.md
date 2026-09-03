# Bench Buddy rotation logic — peer review guide

This is a map for reviewing the substitution/rotation engine, not a
replacement for reading the code — the source files are unusually
heavily commented (every non-obvious decision explains *why*, often
citing the real bug or real game that motivated it), so start there for
any specific function. This doc exists to orient you first: the domain
problem, how the two engines fit together, and — most useful for a
review — a specific list of open trade-offs worth a second opinion on.

## The problem

Bench Buddy builds a substitution schedule for a kids' small-sided
football team (5/7/9-a-side): given a squad, a game length, a
sub-interval length, and (optionally) a keeper rotation, produce a plan
— for every interval, who's on the field, who's on the bench, and who's
in goal — that's fair: everyone gets close to equal outfield minutes,
close to equal bench turns, and (when more than one player can keep
goal) reasonably even keeper time too.

Two hard constraints shape everything:
- **Bench→keeper**: a player should only ever become keeper right after
  coming off the bench, never straight from an uninterrupted outfield
  stint — otherwise an unrelated swap could hand goalkeeping duty to
  someone who was never in line for it.
- **A keeper shift, once started, should run its full planned length** —
  not get cut short by an unrelated bench rotation.

## Two engines, on purpose

- **Path A — `src/lib/rotation.js`** (`generatePlan`). A live, per-interval
  heuristic: "who's owed a turn most right now," recomputed as the game
  actually unfolds. Handles every **mid-game** rebuild — injuries,
  bring-backs, manual swaps — via `carryState` (real minutes/turns played
  so far). Deliberately left alone through the Path B work below; this
  review is entirely about Path B.
- **Path B — `src/lib/fixedRotation.js`** (`generateFixedPlan`). What
  `useMatchState.js`'s `startPlanning()` actually calls for every
  **fresh** game. Built as pure arithmetic where possible instead of a
  live heuristic, specifically so fairness could be *proven*, not just
  hoped for — see the file's own top-of-file comment for the fuller
  history of why this exists alongside Path A rather than replacing it.

Path B's own pipeline (`buildFairSchedule`):
1. `buildKeeperAwareSchedule` — decide bench turns and keeper duty
   together, one interval at a time (the newest piece — see "Recent
   history" below).
2. `repairKeeperBalance` — a pure role-swap pass evening out keeper duty
   among eligible players specifically.
3. `repairOutfieldBalance` — closes any remaining outfield-minutes gap
   via safe outfield↔bench swaps.

`calculateFairness` (same file) is the one shared measurement used
throughout — reports the min/max/range of outfield, bench, and keeper
minutes a plan actually produced, and rates outfield/bench range as
ideal (≤1 interval)/acceptable (≤2)/poor (>2). Keeper range is reported
but deliberately not rated the same way — see "Open questions" below.

## Recent history (the thing most worth a second opinion on)

A real coach reported severe keeper-time unevenness with a keeper shift
longer than one sub-interval (3 eligible keepers, 15-min shifts, 45-min
game) — worst case, one eligible player got 7-9 of 9 sub-intervals,
another got 0.

Root cause: `buildBenchSchedule` (bench turns) and `assignKeepers` (who's
keeper) ran as two fully separate passes with no shared state — the
bench schedule had no idea a player was mid-shift, so it could (and did)
rotate the current keeper to the bench before their shift was up.

`buildKeeperAwareSchedule` (new, parallel machinery — the original
`buildBenchSchedule`/`assignKeepers`/`buildFixedPlan` are untouched,
still used by `continueFixedPlan`) fixes this by deciding both together:
a keeper's whole block is locked in the moment they're picked (excluded
from the bench pool for its full length), and picking who *starts* each
new block still prefers an arriving player over a lower-loaded
non-arriving one, to keep bench→keeper holding at every boundary.

Two earlier attempts at this were built, tested, and **reverted** before
this one — both looked reasonable on paper and made the worst case
*worse* under an actual sweep (one pushed a single player to keeper for
literally the whole game). Worth knowing going in: this problem has
already eaten two wrong turns, so a fix that looks clean by inspection
is exactly the kind of thing worth stress-testing rather than trusting.

## How claims here were actually validated

Every fairness claim in this codebase is backed by a sweep test, not
just reasoning about the code — either a permanent one in
`fixedRotation.fairness.test.js`/`fixedRotation.test.js`, or a temporary,
uncommitted Node script (build → run against real parameter
combinations → read the actual numbers → delete the script) for a
specific bug investigation. `fixedRotation.fairness.test.js` itself has
a `[diagnostic, not a pass/fail gate]`-labeled test whose job is
literally to report — not hide — the current worst case for a known,
still-open shortfall (see below). If you're evaluating a fairness claim
in this codebase, the sweep test backing it is the thing to check first.

## Open questions worth a second opinion on

1. **The bench-turn queueing inside `buildKeeperAwareSchedule` is greedy
   ("fewest bench turns so far wins each spot"), not the closed-form
   modular arithmetic `buildBenchSchedule` uses.** It's validated
   empirically (sweep test), not proven. Is there a cleaner scheme that
   keeps a real ±1 guarantee even with a *different* player excluded
   from the pool at different intervals? (`buildBenchSchedule`'s own
   comment explains why the original scheme's proof doesn't extend here
   directly.)
2. **"Prefer an arriving player, fall back to load-based pick" is a
   judgment call**, not a hard rule — it trades a small amount of keeper
   fairness for preserving bench→keeper. Is that the right trade-off?
   Worth knowing: dropping it entirely was tried, passed its own new
   test with a perfect result, and broke the bench→keeper guarantee for
   the *default* single-interval-shift case — so it's not free to relax.
3. **The all-keeper-eligible outfield-range gap remains open** (see the
   `[diagnostic]` test in `fixedRotation.fairness.test.js`) — some
   squad/field-size combinations land at outfield range 3-6 where
   `computeIntervalTargets` shows a smaller range is theoretically
   achievable. Not the same bug as the one just fixed, and not
   specifically targeted by it. `computeIntervalTargets`'s own comment
   documents a real configuration where its target is *provably*
   unachievable (not just unhit) — worth checking that reasoning too.
4. **Path A and Path B independently define "who's owed a turn most."**
   `rotation.js`'s `benchPriorityCompare` and Path B's various
   least-loaded tie-breaks aren't the same code, just meant to agree in
   spirit. Is there real drift risk here worth unifying, or is keeping
   them independent (per the module comment's own stated reasoning —
   Path A stays a live heuristic, Path B stays proof-oriented arithmetic)
   the right call long-term?

## Where to start reading

- `src/lib/fixedRotation.js` — start at the top-of-file comment, then
  `buildKeeperAwareSchedule` (the newest piece), then
  `repairKeeperBalance`/`repairOutfieldBalance`.
- `src/lib/fixedRotation.fairness.test.js` — the sweep tests themselves;
  the assertions and their comments explain what's actually guaranteed
  vs. empirically observed.
- `src/lib/rotation.js` — Path A, for comparison/context; not in scope
  for changes here but useful for judging question 4 above.
- `src/lib/fairness.js` — the small, separate piece that turns a plan's
  numbers into the UI's fairness badge (not part of the scheduling logic
  itself, but downstream of it).
