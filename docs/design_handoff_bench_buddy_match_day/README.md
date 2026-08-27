# Handoff: Bench Buddy match-day redesign (Direction A)

## Overview
Bench Buddy is a match-day app for a volunteer coach of a kids' football team. It plans and runs
substitutions so every child gets fair minutes. This handoff covers the redesign of the in-match
experience: launch, pre-kickoff, live match, the 60-second sub warning, player actions (swap /
keeper / injury), the settings menu, and setup.

The design direction is a "sticker book": cream paper, chunky drop shadows (`0 3-5px 0` solid, not
blurred), kit-shirt player tiles, Baloo 2 display type, and a deep-green action bar pinned to the
thumb zone.

## About the Design Files
The file in this bundle is a **design reference created in HTML** — a prototype showing intended
look and behaviour, not production code to copy. The task is to **recreate these designs in the
target codebase's existing environment** (React Native, Flutter, SwiftUI, web, etc.) using its
established patterns, component library and navigation. If no environment exists yet, choose the
framework that suits a phone-first app and implement there.

The HTML is a single canvas holding many phone-sized screens side by side, each 380x844 with a
`data-screen-label` attribute. Read those labels to identify screens.

## Fidelity
**High fidelity.** Colours, type, spacing, radii and copy are final and should be matched closely.
Layout inside each 380x844 frame is intended for a phone screen; scale spacing proportionally on
larger devices rather than stretching the pitch card.

## Screens / Views

### A0-Launch (`#9a`)
- **Purpose**: cold start; confirms which team you are managing.
- **Layout**: single column, `padding: 40px 28px`. Lockup (crest, wordmark, tagline) in a
  `flex: 1` centred wrapper; button group pinned below it, full width, `gap: 12px`.
- **Components**:
  - Crest: 168x168 circle, `border: 7px solid #2E7D53`, white fill, image `object-fit: cover`
    at `scale(1.5)`, shadow `0 8px 0 rgba(28,58,46,.14)`.
  - Wordmark "Bench Buddy": Baloo 2 800, 52px, `line-height: 1`, `#1C3A2E`, `letter-spacing: -.01em`.
  - Tagline "Fair minutes, easy subs.": Nunito 700, 16px, `#6B7C72`.
  - Primary button "Today's game": height 72, radius 26, `#F5B93B`, shadow `0 5px 0 #C9902A`,
    Baloo 2 800 25px `#1C3A2E`.
  - Secondary "Scorpians · switch team": height 60, radius 24, `#F1E9D2`, Baloo 2 800 20px
    `#123F3D`; the "· switch team" run is Nunito 800 14px `#6B7C72`.

### A2e-Prekickoff (`#7a`)
- **Purpose**: everything is planned, nothing has started.
- Header timer reads `0:00`; all three block segments are inactive; sub-window chips start at
  0-5'; no outgoing (down-arrow) badges on shirts; bench chips carry no up-arrow.
- Action bar: label "Ready to go" / "first sub at 5'", then ONE full-width primary button
  "Start match" (height 70, radius 26, `#F5B93B`, shadow `0 5px 0 #C9902A`, Baloo 2 800 26px)
  with a solid play triangle 22x24.

### A2-Match-actionbar (`#2a`) — the live match, the core screen
- **Purpose**: run the game; see who is on, who is next, how long until the next sub.
- **Layout** (top to bottom): yellow header, sub-window chip row, pitch card (`flex: 1`), bench
  strip, action bar.
- **Header**: `#FBE3A6`, `padding: 18px 20px 20px`, `border-radius: 0 0 30px 30px`.
  - Crest 62px outer (54px window) circle, `border: 4px solid #2E7D53`.
  - Team name "Scorpians": Baloo 2 800 21px `#1C3A2E`.
  - Cog button top right: 54x54 white disc inside a matching `4px solid #2E7D53` ring, so it
    balances the crest on the left; radius 999. Icon is a solid 8-tooth gear, `fill: #1C3A2E`,
    `fill-rule: evenodd` with a punched centre hole (do NOT use a thin outline gear).
  - Timer: Baloo 2 800 66px `#1C3A2E`, `line-height: .95`; caption "of 45 min" Nunito 800 14px `#96772F`.
  - There is **no** progress bar under the timer. An earlier version had a three-block bar; it was
    removed to reclaim vertical space, and the interval chips carry that information instead.
- **Sub-window chips**: horizontal scroll row directly above the pitch card, `gap: 8px`; active chip
  `#1C3A2E` with `#FFF6E5` text, inactive `#F1E9D2` with `#6B7C72`; Nunito 800 14px, radius 999,
  `padding: 8px 14px`. These are always visible during the match — they are the primary read for
  "which window are we in".
- **Pitch card**: radius 28, `background: #2E7D53` plus mowed stripes
  `repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 34px, rgba(0,0,0,.05) 34px 68px)`.
  Markings are a hand-drawn SVG overlay (deliberately wobbly paths, `stroke: rgba(255,255,255,.3)`,
  width 2.4, round caps): halfway line and centre circle at the vertical centre of the card.
  Formation rows are `display: grid; grid-template-columns: 1fr 1fr` with the keeper centred at
  the bottom.
- **Player tile**: 62x58 kit shirt as inline SVG — cream `#FFF6E5` body (keeper `#F5B93B`),
  `stroke: #1C3A2E` width 2.4, wrapped in `filter: drop-shadow(0 4px 0 rgba(0,0,0,.18))`.
  Squad number sits over the shirt: Baloo 2 800 24px `#1C3A2E`, absolutely positioned `top: 24px`,
  centred. Player name below: Nunito 800 15px white.
  - Outgoing badge: 26x22 pill `#E8664A`, white down arrow, `top: 0; right: -2px`.
  - Keeper tag: "GK" pill `#1C3A2E` with `#F5B93B` text, 11px 800, `bottom: 2px; left: -2px`.
- **Bench strip**: `#F1E9D2`, radius 22, `padding: 12px 14px`; label "BENCH" Baloo 2 800 15px
  `#6B7C72`; chips white, radius 999, 30px number disc (`#2E7D53` white text, or `#F5B93B` dark
  text for a keeper-capable player), name Nunito 800 15px, up-arrow marks who is coming on.
- **Action bar**: `#123F3D`, `border-radius: 32px 32px 0 0`, `padding: 16px 16px 22px`,
  `display: flex; align-items: center; gap: 14px`. One row: countdown on the left, one button on the
  right. Countdown Baloo 2 800 **26px** `#F5B93B`, `line-height: 1.1`, single line, no status
  sub-line — "Next sub 2:20" running, "Ready to go" before kickoff, "Clock stopped" paused.
  Button: `margin-left: auto`, `flex: 0 0 auto`, height 66, radius 24, `padding: 0 30px`,
  Baloo 2 800 24px, `gap: 11px`, 20x22 glyph. Three variants only — "Start" and "Resume" yellow
  `#F5B93B` with shadow `0 5px 0 #C9902A` and a play triangle, "Pause" cream `#F1E9D2` with
  `#123F3D` text and two 6x22 bars (`gap: 5px`), no shadow.
  **The action bar has no "Sub done" button.** A swap is committed in the next-sub bottom sheet
  (A2b-Match-final60), which carries its own confirm row; that sheet is the fourth state of this
  area and the only place "Sub done ✓" appears.

### A2f-Paused (`#7b`)
- Timer greys to `rgba(28,58,46,.45)`; a straight "Paused" chip sits beside it (`#1C3A2E` bg,
  `#F5B93B` text, Baloo 2 800 15px, radius 999).
- Action bar reads "Clock stopped" / "sub due in 2:20"; the single clock button now reads
  "Resume" (yellow, primary, play triangle).

### A2b-Match-final60 (`#5a`) — the last 60 seconds
- Full-screen moment: dark scrim `rgba(20,32,28,.55)` over the match, cream sheet slides up from
  the bottom listing the swaps one per row (e.g. "Otis GK → Eli GK"). Names appear only here, at
  maximum prominence. Everything else dims.
- Note this screen's header is tighter (`padding: 10px 20px 8px`) and the pitch padding is
  `2px 16px` so the keeper row still fits — treat the 844px height as a hard constraint.

### A2d-Menu-anchored (`#6b`) — the cog menu
- **Pattern**: anchored popover, not a bottom sheet. The cog stays lit above the scrim
  (`#FBE3A6` fill, `border: 3px solid #F5B93B`, `z-index` above the scrim) and the panel grows
  down out of it: `position: absolute; left: 14; right: 14; top: 158`,
  `border-radius: 28px 10px 28px 28px` (square corner points at the cog),
  `border: 3px solid #F5B93B`, shadow `0 18px 44px rgba(20,32,28,.45)`. No Close button —
  tapping the cog again or outside dismisses. The panel must clear both the timer above and the
  action bar below.
- **Rows** (white, radius 16, `padding: 3px 12px 3px 8px`, shadow `0 3px 0 rgba(28,58,46,.10)`):
  33x33 tinted icon tile (radius 12), label Baloo 2 800 19px, optional value chip
  (`#F1E9D2`, radius 999, Nunito 800 13px `#6B7C72`), chevron `#C9C4B6`.
- **Groups** (header = coloured dot + Baloo 2 800 16px label + `#EDE3CB` rule):
  - *This game*: Minutes so far (12:40), Squad change (7 in), Game settings (5 a side · sub 5')
  - *Team*: Season data, Manage squad (9 players), Switch team (Scorpians)
  - *App*: Account (sam@), Sign out
  - Footer: "Bench Buddy v1.2", Nunito/Baloo 800 14px and 12px, `#6B7C72`, centred.
- Icon tints: yellow `#FBE3A6`, green `#CBE8D6`, neutral `#F1E9D2`, red `#FAD3C8`.
  Manage squad uses a green/white striped jersey (`#2E7D53` stripes, white ground, dark outline).

### A2g-Player-tap (`#8a`)
- Tapping a shirt dims the screen and lifts that shirt above the scrim; a popover grows from it
  (`border-radius: 28px 10px 28px 28px`, `border: 3px solid #F5B93B`).
- Header: player name Baloo 2 800 22px + "#6 · 12:40 played" Nunito 800 13px `#6B7C72`.
- Three actions, each with a consequence line in Nunito 700 12px `#6B7C72`:
  1. **Swap player** — "Eli comes on" (green tile, ⇄)
  2. **Make keeper** — "Jack moves out" (yellow tile, drawn glove)
  3. **Mark injured** — "Off, clock stops for him" (red tile `#FAD3C8`, medical cross `#C4482A`)

### A2h-Injured (`#8b`)
- The player leaves the pitch, the incoming player takes the shirt, and the injured player sits in
  the bench strip as a red chip: `#FBEDE9` fill, `border: 2px solid #E8A899`, number disc
  `#C4482A`, name `#8A4634`, plus a 20px `#C4482A` badge (white cross, `border: 2px solid #FFF6E5`)
  on the top-right corner — the same read as an injury flag on a football-game card.
- Action bar status becomes "1 to swap · 1 out". The injured player's minutes stop accruing.

### A2i-Back-from-injury (`#8c`)
- Tapping the red chip lifts the bench strip above a scrim and opens a popover with its square
  corner pointing at the chip (`border-radius: 28px 28px 10px 28px`, `border: 3px solid #C4482A`).
- Content: cross badge + "Otis is out" + "off at 12:40 · not counting minutes"; buttons
  "Back to bench" (`#2E7D53`, shadow `0 4px 0 #1F5A3B`, cream text) and "Still out" (`#F1E9D2`).

### A2d-Menu-trimmed (`#10a`) — supersedes A2d-Menu-anchored
The menu previously carried eight rows in three labelled groups. It is now **four rows, no group
headers**, holding only what a coach touches during a game:

1. Minutes so far — value chip `12:40`
2. Squad change — value chip `7 in`
3. Game settings — value chip `5 a side · sub 5′`
4. — 3px `#EDE3CB` rule, `margin: 3px 6px` —
5. Team & account — 40px crest thumbnail as its icon (radius 12, `2px solid #2E7D53`), value chip `Scorpians`

Footer "Bench Buddy v1.2" stays. Panel geometry: `top: 150` (was 158), `left/right: 14`,
`padding: 12px`, `gap: 7px`, `border-radius: 28px 10px 28px 28px`, `border: 3px solid #F5B93B`.
Rows are radius 18, `padding: 9px 13px 9px 9px`, 34px icon tiles. Labels and value chips both carry
`white-space: nowrap` so all four rows come out the same height (53px) — the chip copy is long
enough to wrap otherwise.

**Removed from the menu**: Season data, Manage squad, Switch team, Account, Sign out — all now on
A8-Team-account (`#10e`), reached through row 5. Also **remove the reset button entirely**; it has no
place in the new information architecture and should come out of the app rather than be relocated.

The cog stays lit above the scrim as before, now at its 54px ringed size.

### A5-Minutes (`#10b`)
- **Purpose**: mid-game check on who is owed minutes.
- **Sub-header** (shared by `#10b`, `#10c`, `#10d`, `#10e`): `#FBE3A6`, `padding: 16px 18px 18px`,
  `border-radius: 0 0 30px 30px`, `display: flex; gap: 12px`. Back control 44x44 white, radius 16,
  Baloo 2 800 26px `‹`. Title Baloo 2 800 27px `#1C3A2E`. Right-hand context chip `#1C3A2E` with
  `#F5B93B` text, Nunito 800 14px, radius 999, `padding: 6px 13px`.
- **Note card**: `#F1E9D2`, radius 18, `padding: 11px 14px`, Nunito 700 13.5px `#3E5148`.
  Copy: "Nobody has been on the whole game and nobody is still waiting. Kai and Eli come on at 15′."
- **Rows**: white, radius 18, `padding: 9px 13px 9px 9px`, `gap: 11px`, shadow `0 3px 0 rgba(28,58,46,.10)`.
  34px number disc (`#2E7D53` / cream text; keeper `#F5B93B` / dark text), name in a fixed 64px
  column Nunito 800 15.5px, optional GK pill, bar `flex: 1` height 10 radius 999 track `#F1E9D2`
  fill `#2E7D53` (keeper `#F5B93B`), time right-aligned in a 46px column Baloo 2 800 18px.
- **Sort**: descending by minutes played.
- **Bar scale**: relative to the squad's current maximum, not the game length.
- **Not-yet-played rows**: `opacity: .75`, empty track, and the time column reads "on at 15′"
  (Nunito 800 12.5px `#6B7C72`) rather than 0:00.
- Data shown is mid-game at 12:40 with 5 on the pitch, so the nine values sum to 63:20.

### A5-Minutes (`#11b`) — build this one
Supersedes `#10b`. The screen exists to **audit the rotation**, so it splits each child's time three
ways — pitch, in goal, bench — rather than showing one total.
- **Purpose**: check the automation has shared all three kinds of time fairly.
- **Sub-header** (shared by `#11b`, `#10c`, `#10d`, `#10e`): `#FBE3A6`, `padding: 16px 18px 18px`,
  `border-radius: 0 0 30px 30px`, `display: flex; gap: 12px`. Back control 44x44 white, radius 16,
  Baloo 2 800 26px `‹`. Title Baloo 2 800 27px `#1C3A2E`. Right-hand context chip `#1C3A2E` with
  `#F5B93B` text, Nunito 800 14px, radius 999, `padding: 6px 13px`, showing elapsed time.
- **Note card**: `#F1E9D2`, radius 18, `padding: 11px 14px`, Nunito 700 13.5px `#3E5148`.
  Copy: "Pitch time is within 7:30 and evens out by 25′. Otis has kept all game — his shift ends at 20′."
- **Column heads**: `padding: 0 12px 2px 51px` (aligns past the number disc), Nunito 800 11.5px,
  `letter-spacing: .03em`, right-aligned: PITCH `#2E7D53`, GOAL `#96772F`, BENCH `#8C8677`.
  Pitch is `flex: 1`; goal and bench are fixed 52px columns.
- **Rows**: white, radius 18, `padding: 10px 12px 10px 9px`, `gap: 9px`,
  shadow `0 3px 0 rgba(28,58,46,.10)`. 32px number disc (`#2E7D53` / cream text; keeper-capable
  `#F5B93B` / dark text), name Nunito 800 15px `flex: 1`, then three values in Baloo 2 800 17px,
  right-aligned, coloured to match their column head.
- **Zero reads as an em dash** `—` in `#C9C4B6`, never 0:00. Keeps the columns quiet so the numbers
  that exist carry the meaning.
- **Totals row** at the foot (`padding: 6px 12px 0 51px`, Baloo 2 800 15px, same three colours).
  This is the audit: with 5 on and 4 off, pitch and bench should each equal `elapsed × 4` — 50:40 at
  12:40 — and goal should equal the elapsed time exactly. A mismatch means the rotation has lost
  time and is a bug, not a rounding artefact.
- **Row order**: by pitch time descending, keeper first.

### A5b-Minutes-split-bar (`#11a`) — optional, later
Same three numbers as a single stacked bar per child, one row each: name line (28px disc, name,
inline times) over an 11px stacked bar, `background: #F1E9D2`, segments `#2E7D53` pitch /
`#F5B93B` goal / `#DCD3BB` bench, card radius 18 `padding: 9px 12px`. A three-key legend sits above
the list (11px swatches, radius 3, Nunito 800 12.5px).

**Every bar is the same length** — the whole elapsed game — because every child has been at the match
the same time. Equal bars with different fills is what makes the rows comparable; scaling each bar to
its own playing time would hide the thing being checked.

Not required for the first release. If both ship, `#11b` is the default and `#11a` is a view toggle.
Costs ~66px a row against 46px, so it fills the screen with nine children and leaves no room for the
note card or totals.

### A5-Minutes-single-bar (`#10b`) — superseded, do not build
First pass: one bar per child showing total minutes only. Replaced by `#11b`, which splits the same
time into pitch / goal / bench. Kept in the design file for reference.

### A6-Season (`#10c`)
- **Purpose**: has the season been fair.
- Same sub-header; context chip "6 games". Note card: "Average minutes per game. Widest gap across
  the squad is 3 minutes."
- **Rows**: as A5-Minutes but `padding: 10px 13px 10px 9px`, and the name cell is a two-line stack —
  name Nunito 800 15.5px over "6 games · 2:43:00" Nunito 700 12px `#6B7C72`.
  Bar is a fixed 96px column; average is a 48px column, Baloo 2 800 18px.
- **The headline number is the average per game, not the total.** Totals penalise a child who missed
  weekends; the total stays as the secondary line.
- Bars are scaled from the squad's lowest average, not from zero, so a small spread stays visible.
  The note card states the gap numerically as a check on that.
- Footer "Since 12 April", Nunito 700 12.5px `#6B7C72`, centred, pushed down with `margin-top: auto`.

### A7-Squad-change (`#10d`)
- **Purpose**: a child arrived late or left early. This is the only reason the screen gets opened.
- Title is "Who's here?"; context chip "7 in".
- **Arrival callout** (only when someone has just become available): `#CBE8D6`, radius 18,
  `padding: 12px 14px`, 34px number disc, "Kai just arrived" Baloo 2 800 19px over
  "tap to add him to the rotation" Nunito 700 12.5px `#3E5148`.
- **Squad grid**: `grid-template-columns: 1fr 1fr`, `gap: 9px`. Available = white card radius 18
  `padding: 10px 11px`, 32px disc, name Nunito 800 15px over a status line Nunito 700 11.5px
  `#6B7C72` reading "on pitch" or "bench". Unavailable = `#F1E9D2` card, no shadow, disc `#DCD3BB`
  with `#8C8677` text, name `#8C8677`, status "not here" `#A39C8A`.
- **Action bar**: `#123F3D`, radius `32px 32px 0 0`, `padding: 14px 16px 20px`. Caption
  "Adding Kai redraws the 15′ window and after." Nunito 800 13.5px `#8FB5AB`, then a full-width
  button naming the person: "Add Kai to the game" (height 66, radius 24, `#F5B93B`,
  shadow `0 5px 0 #C9902A`, Baloo 2 800 24px). Generic "Update plan" copy is wrong here.
- Removing a player who is currently on the pitch is a heavier action — the status line is the
  warning, and it should confirm before removing them.

### A8-Team-account (`#10e`) — new screen, absorbs Switch team and Account
- **Purpose**: everything that is not match-day. Reached from menu row 5.
- Group headers **do** appear here (10px dot + Baloo 2 800 16px `#3E5148` + `#EDE3CB` rule):
  - *Your teams*: current team card, other team cards, "Add a team"
  - *Records*: Season data (`6 games`), Manage squad (`9 players`)
  - *Account*: Signed in (`sam@`), Sign out
- **Team card**: white, radius 20, `padding: 11px 14px 11px 11px`, 46px crest. The **current** team
  additionally carries `border: 3px solid #2E7D53` and a 28px `#2E7D53` tick disc with cream `✓`.
  Other teams show a `#F1E9D2` initial disc and a chevron. Sub-line "9 players · 6 games"
  Nunito 700 12.5px.
- **Add a team**: radius 20, `padding: 13px`, `border: 3px dashed #DCD3BB`, centred
  "＋ Add a team" Baloo 2 800 18px `#6B7C72`. No fill, no shadow — it is not a record yet.
- Footer "Bench Buddy v1.2" centred, `margin-top: auto`.

### A9-Signin (`#10f`)
- **Purpose**: first run only. Magic-link, no password.
- Same lockup as A0-Launch one step down: crest 132px with `6px solid #2E7D53`, wordmark Baloo 2
  800 42px, tagline Nunito 700 15.5px `#6B7C72`, all in a `flex: 1` centred wrapper.
- **Email field**: white, height 64, radius 22, shadow `0 3px 0 rgba(28,58,46,.10)`,
  `padding: 0 18px`, placeholder Nunito 700 17px `#A8B3AC`.
- **Button**: "Send me a link", height 70, radius 26, `#F5B93B`, shadow `0 5px 0 #C9902A`,
  Baloo 2 800 25px.
- **Reassurance line**: "No password. We email you a link that signs you in and keeps you in."
  Nunito 700 13.5px `#6B7C72`, centred. Staying signed in is the real anxiety — say so.
- `v1.2` Nunito 700 12px `#A39C8A` at the bottom.

### A3 / A4-Setup (`#3a`, `#4a`, `#4b`)
- Pre-match plan: squad chips ("Who's here?", greyed = not playing), three tap-to-edit number
  tiles (on pitch / minutes / sub every), "In goal today" (tap a name to include, tap again for
  crown = starts in goal), and Breaks with a live interval strip.
- Editing a tile flips it dark with − / + either side of the number; no keyboard, whole numbers
  only (5-minute steps for game length, 1 for players and sub length). Changing a tile redraws the
  interval strip and its caption.

## Interactions & Behavior
- **Timer**: counts up to the game length; drives the block bar, the active sub-window chip and
  the "Next sub" countdown. Pausing stops all of them.
- **Sub flow**: at T-60s the final-60 sheet takes over the screen; "Sub done" confirms, clears the
  outgoing badges, moves players between pitch and bench, and arms the next window.
- **Anchored surfaces**: every menu/popover animates out of the control that opened it, scaling
  from the shared corner (~180-220ms, ease-out). The origin control stays lit above the scrim.
  Dismiss on outside tap.
- **Injury**: Mark injured removes the player from the pitch, stops their minute accrual, and adds
  them to the bench with the cross badge. Tapping them offers an immediate return to the bench
  queue for the next window.
- **Keeper**: Make keeper swaps the gloves; the new keeper's shirt turns `#F5B93B` and takes the
  GK tag.

## State Management
- `match`: status (`ready | running | paused | final60 | ended`), `elapsedSeconds`,
  `lengthMinutes`, `blocks` (count + boundaries), `subEveryMinutes`.
- `squad`: per player `{ id, name, number, keeperCapable, availableToday }`.
- `onPitch` / `bench` / `injured`: player ids; `keeperId`.
- `minutes`: per player accumulated seconds, paused when the clock stops or the player is injured.
- `pendingSwaps`: pairs shown in the final-60 sheet, committed by "Sub done".
- `ui`: which anchored surface is open and which element it is anchored to.

## Design Tokens
Colours
- Cream paper `#FFF6E5`; deeper cream `#F1E9D2`; rule `#EDE3CB`; canvas `#EDEAE2`
- Header yellow `#FBE3A6`; primary yellow `#F5B93B`; yellow shadow `#C9902A`; gold text `#96772F`
- Pitch green `#2E7D53`; deep green `#1C3A2E`; action bar `#123F3D`; green shadow `#1F5A3B`
- Mint tile `#CBE8D6`; muted text `#6B7C72`; on-dark muted `#8FB5AB`; chevron `#C9C4B6`
- Alert red `#E8664A`; injury red `#C4482A`; injury tint `#FBEDE9` / `#FAD3C8`; injury border `#E8A899`; injury text `#8A4634`
- Scrim `rgba(20,32,28,.55)`

Typography
- Display: Baloo 2 800 — 66px timer, 52px wordmark, 26/25px primary buttons, 24px countdown,
  22px popover titles, 21px team name, 19px menu rows, 16px group headers
- Body: Nunito — 800 for labels/chips/names (13-15px), 700 for captions (12-13px)
- Minimum text size on a phone screen: 12px, and only for captions

Spacing / shape
- Screen padding 14-20px; card gaps 8-12px; screen rhythm 12px between stacked cards
- Radii: 38 phone shell, 32 action bar top, 28 pitch/popover, 26/24 buttons, 22 bench strip,
  20/18/16 rows, 14 icon buttons, 12 icon tiles, 999 chips
- Shadows are solid, not blurred: `0 3px 0`, `0 4px 0`, `0 5px 0`; overlays use
  `0 18px 44px rgba(20,32,28,.45)`
- Anchored popovers replace one corner radius with 10px, pointing at their origin control

Texture
- Cream surfaces carry a tiled football pattern: 170x170 tile, two balls (r 19 and r 12) drawn as a
  `rgba(28,58,46,.06)` disc with cream pentagon patches. Subtle — it must never compete with text.

## Assets
- `uploads/Bench Buddy Logo.jpg` — the crest illustration (1920x1920, no text). Supplied by the
  team; use the real asset, not a redraw.
- All icons are inline SVG defined in the design file: solid gear, striped jersey, kit shirt,
  medical cross, goalkeeper glove, bar-chart, swap arrows, play triangle, pause bars.
- Fonts: Baloo 2 and Nunito (Google Fonts).


## Implementation map (existing repo: jaredrakich-ghub/bench-buddy @ main)
The app already has every behaviour these designs describe — this is a **restyle plus a few new
states**, not a rebuild. Read these files before starting; keep the logic, replace the presentation.

| Design screen | Implement in | Notes |
| --- | --- | --- |
| A2-Match-actionbar, A2e-Prekickoff, A2f-Paused | `src/components/MatchView.jsx` | Already owns the header, clock, pitch board (formation + bench + injured), interval navigation and the Start/Pause control. Ready and Paused are existing states that need the new visual treatment, not new screens. |
| A2g-Player-tap | `src/components/MatchView.jsx` (token menu) | The menu already offers Swap, Make keeper (`menuCanMakeKeeper`, gated on `keeperEligibleIds` and not the current keeper) and Mark injured, and offers only "Back in" for an injured player. Restyle it as the anchored popover; keep the gating and the confirmation toast ("✓ Bob is now keeper"). |
| A2h-Injured, A2i-Back-from-injury | `src/components/MatchView.jsx` + `src/components/SubRotationPlanner.jsx` | `injuredThisGame`, `onInjury` (`handleInjury`) and `onBringBack` (`bringBack`) already exist; `styles.tokenInjured` currently uses a danger ring. Replace with the red chip + white-cross badge, and move the injured group into the bench strip instead of a separate `injuredCol`. |
| A2b-Match-final60 | `src/components/MatchView.jsx` (last-minute warning window) | The warning already names who is coming off/on and the keeper handover. Promote it to the full-screen cream sheet over a scrim. |
| A2d-Menu-anchored | new anchored menu in `MatchView`, linking to existing modals | Minutes so far → `SummaryModal.jsx`; Season data → `SeasonSummaryModal.jsx`; Manage squad / Game settings → `SquadSettingsForm.jsx`; Switch team → `TeamSwitcher.jsx`. |
| A2d-Menu-trimmed (`#10a`) | new anchored menu in `MatchView` | Four rows only. Season data, Manage squad, Switch team, Account and Sign out move out to the new Team & account screen. **Delete the reset button** rather than rehoming it. |
| A5-Minutes (`#11b`) | `src/components/SummaryModal.jsx` | **Three columns: pitch / goal / bench**, not one total. Needs per-player time split by role, so `useMatchState` must accumulate keeper seconds separately from outfield seconds. Totals row is an assertion: pitch and bench each equal `elapsed × (squad on − 1)`, goal equals elapsed. Dash for zero. `#10b` and `#11a` are not to be built. |
| A6-Season (`#10c`) | `src/components/SeasonSummaryModal.jsx` | Switch the headline number from total to **average per game**; keep the total as the secondary line. Uses `src/lib/gameHistory.js`. |
| A7-Squad-change (`#10d`) | `src/components/SquadSettingsForm.jsx` (availability) + `MatchView` | Mid-game availability toggle. Needs the arrival callout and a person-named action button; recalculates upcoming windows via `recommendSubIntervals`. |
| A8-Team-account (`#10e`) | new screen; absorbs `TeamSwitcher.jsx` and links to `SeasonSummaryModal` / `SquadSettingsForm` | The one place non-match-day settings live. `TeamSwitcher`'s list becomes the *Your teams* group. |
| A9-Signin (`#10f`) | `src/components/SignIn.jsx` | Magic-link only — no password field. Keep whatever auth the repo already uses; this is presentation. |
| A2d-Menu-anchored (`#6b`) | — | **Superseded** by `#10a`. Kept in the design file for reference only; do not build it. |
| A3 / A4-Setup | `src/components/SquadSettingsForm.jsx` | Keeper eligibility (🧤 toggle) and starting keeper (▶) already exist, as do the fairness warnings — the design's crown/tap-twice interaction maps onto them. Keep `keeperShiftMinutes` and the interval preview line. |
| A0-Launch | `src/components/LoadingScreen.jsx` / `SignIn.jsx` / `AuthGate.jsx` | The wordmark lockup belongs here. Crest asset: repo already ships `src/assets/header-mascot.jpg`. |

Styling lives in one place: `src/components/styles.js` (~29KB of style objects, including
`token`, `tokenInjured`, `nextKeeperBadge`, `benchInjuredRow`, `injuredCol`, `summaryRow`).
Introduce the tokens listed below as named constants there and re-point the existing style objects
at them rather than scattering hex values through components.

State already exists and should not be re-modelled:
- `src/hooks/useMatchState.js` — clock, plan, intervals, injuries, keeper shifts
- `src/lib/rotation.js`, `src/lib/fixedRotation.js`, `src/lib/formation.js` — fairness and
  formation maths (`computeFairnessSpread`, `recommendSubIntervals`, `keeperShiftIntervalsFor`)
- `src/lib/clock.js`, `src/lib/gameHistory.js`, `src/lib/storage.js`
- Tests exist beside each component (`MatchView.test.jsx` etc.) and encode the current behaviour —
  they should keep passing through the restyle. Where a test asserts on copy the design changes
  (e.g. "Mark injured" wording), update the test deliberately, not incidentally.

### Genuinely new in this design
1. **Pre-kickoff state** as a distinct visual: 0:00, no outgoing badges, one wide
   "Start match" button.
2. **One clock button** in the action bar (Start / Pause / Resume on the same row as the countdown)
   rather than a pair of buttons in their own row.
3. **Anchored surfaces**: the cog menu and the player menu both grow from the control that opened
   them, with the origin control lit above the scrim.
4. **Kit-shirt tokens** replacing circular/square tokens, with badges on the shoulder and hem.
5. **Injured players in the bench strip** as red cross chips rather than a separate column.
6. **Launch lockup** with the app wordmark.
7. **A four-row cog menu** plus a Team & account screen to hold what it shed — and the reset button
   deleted.
8. **Average-per-game as the season headline**, replacing total minutes.
9. **A mid-game arrival flow** with a named action button.
10. **Minutes split by role** — pitch, goal and bench tracked and shown separately, so the coach can
    audit the rotation rather than take its word for it. This is the only item that needs new state.

## Screen order for implementation
Hand these off one at a time, in this order. Each one is a self-contained request.
1. `#10a` menu trim + reset removal — smallest change, unblocks the rest of the nav.
2. `#10e` Team & account — the menu's rows need somewhere to land.
3. `#11b` Minutes — the three-way split. Needs keeper seconds tracked separately, so it is the one
   screen here with real state work behind it.
4. `#10c` Season · 5. `#10d` Squad change · 6. `#10f` Sign in.
   `#11a` (stacked-bar Minutes) is optional and comes after all of the above, if at all.

## Screenshots
`screens/` contains a 2x PNG of each screen, current as of this bundle:
01 launch · 02 pre-kickoff · 03 match · 04 paused · 05 final 60 seconds · 06 cog menu (trimmed) ·
07 player tap · 08 injured · 09 back from injury · 10 setup · 11 setup with keeper row open ·
12 minutes (three-way split) · 13 season · 14 squad change · 15 team & account · 16 sign in.

Where a PNG and the README ever disagree, **the README and the HTML file are correct**.

## Files
- `INSTRUCTIONS.md` — **start here.** One ready-to-paste request per screen, in send order, with
  every exact value.
- `PROMPT.md` — the shorter orientation message, plus guidance on phrasing change requests.
- The design file and screenshots below are the reference the two files above point at. The message to paste into Claude Code, plus guidance on phrasing
  change requests so they land.
- `Bench Buddy Direction A.dc.html` — the full design canvas. Screens are top to bottom in the
  file; find each by its `data-screen-label`:
  `A0-Launch`, `A2e-Prekickoff`, `A2f-Paused`, `A2-Match-actionbar`, `A2b-Match-final60`,
  `A2d-Menu-anchored`, `A2g-Player-tap`, `A2h-Injured`, `A2i-Back-from-injury`,
  `A3-Setup`, `A4-Setup-collapsed`, `A4-Setup-expanded`,
  `A2d-Menu-trimmed`, `A5-Minutes`, `A6-Season`, `A7-Squad-change`, `A8-Team-account`, `A9-Signin`,
  `A5b-Minutes-split-bar`, `A5c-Minutes-split-columns`,
  plus the archive screens `A-Match`, `A-Setup`, `A-Minutes`, `A-Season`, `A-Teams` at the very
  bottom under a red "Archive — do not build" heading. **Ignore the archive.** Every one of those
  five has a current replacement: Minutes → `A5-Minutes`, Season → `A6-Season`,
  Teams → `A8-Team-account`, Match → `A2-Match-actionbar`, Setup → `A3-Setup`.
  There is exactly **one** current design for each screen.
- Annotations sit beside each screen in the canvas explaining intent — worth reading before
  implementing.

## Not yet designed
Full-time and match summary, and the Squad change confirmation for removing a child who is
currently on the pitch.
