# Paste this into Claude Code first

> Send this first, then work through `INSTRUCTIONS.md` — one copy-paste block per screen, in
> order, each with every exact value.

Put this whole folder inside the bench-buddy repo as
`docs/design_handoff_bench_buddy_match_day/`, replacing any older copy. Then copy everything
between the two `---` lines below as your first message to Claude Code.

The match screen is already built and live. This round covers the screens around it, plus the
substitution sheets, the cancel-a-change flow and the Save your team sign-in sheet
(blocks 12–16 of `INSTRUCTIONS.md`).

---

The folder `docs/design_handoff_bench_buddy_match_day/` contains a design handoff:

- `README.md` — the spec: every screen's exact colours, type and spacing, plus an implementation
  map naming which existing file each screen belongs in.
- `Bench Buddy Direction A.dc.html` — the design reference. Open it in a browser. It is a
  prototype, NOT code to copy: do not import it, do not port its markup.
- `screens/*.png` — a render of each screen.

I will send you one screen at a time. Each message names its files and its screen in the reference.
Read that screen's README section before writing code; you do not need the rest of the README yet.

Rules for this work:
1. The match screen (`A2-Match-actionbar`) is already built. Do not touch it.
2. Anything in the design file marked **superseded** or sitting under the red "Archive — do not
   build" heading is not to be built. Every screen has exactly one current design.
3. Add new tokens to `src/components/styles.js` **alongside** the existing values, and only
   re-point the styles belonging to the screen you are building. Never find-and-replace a shared
   hex value.
4. Existing tests encode current behaviour and should keep passing. If a design change alters copy a
   test asserts on, update that test deliberately and tell me.
5. One screen per request, in the order I send them. Show me each one before moving on, and give me
   a plan before code on anything larger than a single component.

Wait for my first screen before writing anything.

---

## The one screen with real work behind it

`A5-Minutes` (`#11b`) splits each child's time into **pitch / in goal / bench**. The app currently
tracks a single total per player, so `useMatchState` has to accumulate keeper seconds separately from
outfield seconds. Give that screen its own request — don't let it ride along with a styling change.

Its totals row is an assertion worth keeping as a test: with five on and four off, pitch and bench
should each equal `elapsed × 4`, and goal should equal `elapsed`. If they don't, the rotation has
lost time.

## The substitution sheets have a height budget

On the match screen the pitch is `flex: 1; min-height: 0` inside the phone column, so every pixel
the bottom sheet grows is taken out of the pitch and the bottom row of players is clipped. This bit
the design twice. After any change to the prepare or execute sheet — opening a step, greying a
cancelled one — check the pitch still renders at least 193px tall.

## Why change requests go wrong, and how to phrase them

Claude Code can't see your screen. Anchor every request to a file and a name from the spec.

Weaker: "make the header look right"
Stronger: "In `MatchView.jsx`, the header should be `#FBE3A6` with
`border-radius: 0 0 30px 30px`, `padding: 18px 20px 20px`, and the timer at Baloo 2 800 66px
`#1C3A2E`. See README > Screens > A2-Match-actionbar > Header."

Weaker: "the menu is overloaded"
Stronger: "Trim the cog menu to the four rows in README > A2d-Menu-trimmed: Minutes so far, Squad
change, Game settings, Team & account. No group headers. Move Season data, Manage squad, Switch
team, Account and Sign out to the new Team & account screen. Delete the reset button."

Three habits that help most:
- One screen per request. The spec is organised by screen for that reason.
- Quote the README section name. It stops the model re-inventing values it can read.
- Ask for a plan before code on anything larger than a single component.
