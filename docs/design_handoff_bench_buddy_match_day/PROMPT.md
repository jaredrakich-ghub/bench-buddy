# Paste this into Claude Code first

> **If you want ready-made, per-screen requests, open `INSTRUCTIONS.md` instead.** It has one
> copy-paste block per screen with every exact value, in the order to send them. This file is the
> shorter orientation version.

Put this whole folder inside the bench-buddy repo as
`docs/design_handoff_bench_buddy_match_day/`, replacing any older copy. Then copy everything
between the two `---` lines below as your first message to Claude Code.

The match screen is already built and live. This round covers the six screens around it.

---

The folder `docs/design_handoff_bench_buddy_match_day/` contains an updated design handoff:

- `README.md` — the spec: every screen, exact colours, type, spacing, plus an implementation map
  naming which existing file each screen belongs in.
- `Bench Buddy Direction A.dc.html` — the HTML design reference. Open it in a browser. It is a
  prototype, NOT code to copy: do not import it, do not port its markup.
- `screens/*.png` — a render of each screen.

Read `README.md` in full before writing any code, including "Implementation map" and
"Screen order for implementation".

Rules for this work:
1. The match screen (`A2-Match-actionbar`) is already built. Do not touch it.
2. Two screens in the file are explicitly marked **superseded / do not build** — the old cog menu
   (`#6b`) and the single-bar Minutes (`#10b`) — and there is an archive block at the bottom of the
   design file under a red "Archive — do not build" heading. Skip all of them. Every screen has
   exactly one current design.
3. Add the README's Design Token constants to `src/components/styles.js` **alongside** the existing
   values, and only re-point the styles belonging to the screens you are building. Do not
   find-and-replace shared hex values.
4. Existing tests encode current behaviour and should keep passing. If a design change alters copy a
   test asserts on, update that test deliberately and tell me.
5. One screen per request, in the README's stated order. Show me each one before moving on.

Start with the smallest: trim the cog menu to four rows per `A2d-Menu-trimmed`, and delete the reset
button from the app. Tell me your plan before writing code.

---

## The one screen with real work behind it

`A5-Minutes` (`#11b`) splits each child's time into **pitch / in goal / bench**. The app currently
tracks a single total per player, so `useMatchState` has to accumulate keeper seconds separately from
outfield seconds. Give that screen its own request — don't let it ride along with a styling change.

Its totals row is an assertion worth keeping as a test: with five on and four off, pitch and bench
should each equal `elapsed × 4`, and goal should equal `elapsed`. If they don't, the rotation has
lost time.

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
