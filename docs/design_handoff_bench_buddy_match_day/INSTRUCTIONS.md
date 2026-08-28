# Exact instructions, one screen at a time

Each numbered block below is a **complete message to paste into Claude Code**. Send one, let it
finish, check the result, then send the next. Do not send two at once.

Every block names the file to change and the exact values, in the same shape as the match-screen
request that worked.

Before you start, paste block 0.

---

## 0. Orientation (send this first, once)

```
The folder docs/design_handoff_bench_buddy_match_day/ contains an updated design handoff:
README.md (the spec), Bench Buddy Direction A.dc.html (an HTML design reference — open it in a
browser; do NOT import or port its markup), and screens/*.png (a render per screen).

Read README.md in full, including "Design tokens" and "Implementation map". Then tell me which
files you would touch for each screen listed there. Do not write any code yet.

Two standing rules for all the work that follows:
1. Add the README's token constants to src/components/styles.js ALONGSIDE the existing values, and
   only re-point the style objects belonging to the screen I ask for. Never find-and-replace a
   shared hex value.
2. The live match screen (A2-Match-actionbar) is already built and correct. Treat its header, timer,
   interval chips, action bar and cog as the reference every other match state must match.
3. Block 8 at the end of this document supersedes the header and action-bar geometry given in
   blocks 2-7. Where they disagree, block 8 wins. Read it before you start so you do not build the
   old edge-to-edge chrome and then have to undo it.
4. Block 9 covers the "Set up next game" screen. It supersedes anything earlier about that screen's
   row icons, sub-interval copy, warning banner and primary button.
5. Block 10 adds the building-rotation overlay, the fairness mark and the mid-match fairness toast.
   Build it after block 9 — it hangs off the same primary button.
6. Block 11 replaces block 10C's mid-match toast visual. Where they disagree, block 11 wins.
7. Block 12 replaces the checking → Rotation ready transition in block 10A. Where they disagree,
   block 12 wins.
8. Block 14 replaces the final-60 bottom sheet entirely: one sheet becomes two. Where any earlier
   block describes that sheet, block 14 wins.
```

---

## 1. Trim the cog menu, delete the reset button

`src/components/MatchView.jsx`

```
Rebuild the cog menu per README > A2d-Menu-trimmed (screens/06-menu.png).

It is an anchored popover that grows down out of the cog — not a bottom sheet. Panel: position
absolute, top 150, left/right 14, background #FFF6E5, border-radius 28px 10px 28px 28px,
border 3px solid #F5B93B, box-shadow 0 18px 44px rgba(20,32,28,.45), padding 12px, flex column,
gap 7px. Scrim rgba(20,32,28,.55) over the whole screen. The cog stays lit above the scrim. No
Close button — tapping the scrim dismisses.

Exactly four rows, no group headers:
1. "Minutes so far"  — value chip "12:40"
2. "Squad change"    — value chip "7 in"
3. "Game settings"   — value chip "5 a side · sub 5′"
   then a 3px #EDE3CB rule, margin 3px 6px
4. "Team & account"  — value chip with the current team name, icon is the team crest thumbnail
   (34px, border-radius 12, 2px solid #2E7D53)

Row style: background #fff, border-radius 18, padding 9px 13px 9px 9px, gap 11px,
box-shadow 0 3px 0 rgba(28,58,46,.10). Label Baloo 2 800 19px #1C3A2E. Value chip background
#F1E9D2, border-radius 999, padding 4px 10px, Nunito 800 13px #6B7C72. Chevron › Baloo 2 800 22px
#C9C4B6. Put white-space: nowrap on both the label and the chip so all four rows are the same
height. Footer under the rows: "Bench Buddy" Baloo 2 800 14px #6B7C72 next to "v1.2" Nunito 700 12px.

Move Season data, Manage squad, Switch team, Account and Sign out OUT of this menu — they belong to
the new Team & account screen (block 2). Delete the reset button from the app entirely; it is not
being rehomed.
```

---

## 2. New Team & account screen

new screen; absorbs `src/components/TeamSwitcher.jsx`

```
Build the Team & account screen per README > A8-Team-account (screens/15-team-account.png). It is
reached from menu row 4 and holds everything that is not match-day.

Shared sub-header used by this and every other non-match screen: background #FBE3A6,
padding 16px 18px 18px, border-radius 0 0 30px 30px, flex row, gap 12px, align center. Back control
44x44 white, border-radius 16, Baloo 2 800 26px "‹". Title Baloo 2 800 27px #1C3A2E.

Three groups, each headed by a 10px dot + Baloo 2 800 16px #3E5148 label + a flex:1 3px #EDE3CB rule:
- "Your teams" (dot #2E7D53): the team cards, then "＋ Add a team"
- "Records" (dot #F5B93B): "Season data" (chip "6 games"), "Manage squad" (chip "9 players")
- "Account" (dot #C9C4B6): "Signed in" (chip with the email), "Sign out"

Team card: background #fff, border-radius 20, padding 11px 14px 11px 11px, 46px round crest,
name Baloo 2 800 20px over "9 players · 6 games" Nunito 700 12.5px #6B7C72. The CURRENT team also
gets border 3px solid #2E7D53 and a 28px #2E7D53 disc with a cream ✓ on the right. Other teams get a
#F1E9D2 initial disc and a › chevron instead.

"Add a team": border-radius 20, padding 13px, border 3px dashed #DCD3BB, no fill, no shadow, centred
"＋ Add a team" Baloo 2 800 18px #6B7C72.

Records and Account rows use the same row style as the cog menu (block 1). Footer "Bench Buddy v1.2"
centred at the bottom with margin-top auto.
```

---

## 3. Minutes today — three-way split (the one with real state work)

`src/components/SummaryModal.jsx` + `src/hooks/useMatchState.js`

```
Rebuild the Minutes screen per README > A5-Minutes (#11b, screens/12-minutes-split.png).

This screen exists to AUDIT the rotation, so each child's time is split three ways — pitch, in goal,
bench — instead of one total. The app currently tracks a single total per player, so useMatchState
must accumulate keeper seconds separately from outfield seconds. Do that first and show me the state
change before the UI.

Shared yellow sub-header (as block 2), title "Minutes today", right-hand context chip showing
elapsed time: background #1C3A2E, colour #F5B93B, Nunito 800 14px, border-radius 999,
padding 6px 13px.

Note card: background #F1E9D2, border-radius 18, padding 11px 14px, Nunito 700 13.5px #3E5148.
Copy: "Pitch time is within 7:30 and evens out by 25′. Otis has kept all game — his shift ends at 20′."

Column heads, padding 0 12px 2px 51px, Nunito 800 11.5px, letter-spacing .03em, right-aligned:
PITCH #2E7D53 (flex:1), GOAL #96772F (52px), BENCH #8C8677 (52px).

Rows: background #fff, border-radius 18, padding 10px 12px 10px 9px, gap 9px,
box-shadow 0 3px 0 rgba(28,58,46,.10). 32px number disc — #2E7D53 with cream text, or #F5B93B with
#1C3A2E text for keeper-capable players. Name Nunito 800 15px, flex:1. Then the three values in
Baloo 2 800 17px, right-aligned, each coloured to match its column head.

A zero renders as an em dash "—" in #C9C4B6, never 0:00.

Totals row at the foot, padding 6px 12px 0 51px, Baloo 2 800 15px, same three colours. This is the
audit: with 5 on and 4 off, pitch and bench should each equal elapsed × 4, and goal should equal
elapsed exactly. Add that as a unit test — a mismatch means the rotation lost time and is a bug.

Sort rows by pitch time descending, keeper first.
```

---

## 4. Season so far — average, not total

`src/components/SeasonSummaryModal.jsx`

```
Rebuild the Season screen per README > A6-Season (screens/13-season.png).

Change the headline number from total minutes to AVERAGE MINUTES PER GAME. Totals punish a child who
missed weekends; the average is the fairness number. Keep the total as a secondary line.

Shared yellow sub-header, title "Season so far", context chip "6 games".
Note card copy: "Average minutes per game. Widest gap across the squad is 3 minutes."

Rows: same card style as block 3 but padding 10px 13px 10px 9px. 34px number disc, then a two-line
name cell — name Nunito 800 15.5px over "6 games · 2:43:00" Nunito 700 12px #6B7C72. Then a fixed
96px bar (height 10, border-radius 999, track #F1E9D2, fill #2E7D53, keeper #F5B93B), then the
average in a 48px column, Baloo 2 800 18px, right-aligned.

Scale the bars from the squad's LOWEST average rather than from zero, so a three-minute spread stays
visible. The note card states the gap numerically as a check on that.

Footer "Since 12 April", Nunito 700 12.5px #6B7C72, centred, pushed down with margin-top auto.
```

---

## 5. Squad change — built around the late arrival

`src/components/SquadSettingsForm.jsx` + `MatchView`

```
Build the mid-game squad change screen per README > A7-Squad-change (screens/14-squad-change.png).

Nobody opens this screen to browse the squad — they open it because a child turned up late or went
home. Design for that.

Shared yellow sub-header, title "Who's here?", context chip "7 in".

Arrival callout, shown only when someone has just become available: background #CBE8D6,
border-radius 18, padding 12px 14px, 34px number disc, "Kai just arrived" Baloo 2 800 19px over
"tap to add him to the rotation" Nunito 700 12.5px #3E5148.

Squad grid: grid-template-columns 1fr 1fr, gap 9px.
- Available: background #fff, border-radius 18, padding 10px 11px,
  box-shadow 0 3px 0 rgba(28,58,46,.10), 32px disc, name Nunito 800 15px over a status line
  Nunito 700 11.5px #6B7C72 reading "on pitch" or "bench".
- Not available: background #F1E9D2, no shadow, disc #DCD3BB with #8C8677 text, name #8C8677,
  status "not here" in #A39C8A.

Action bar: background #123F3D, border-radius 32px 32px 0 0, padding 14px 16px 20px. Caption
"Adding Kai redraws the 15′ window and after." Nunito 800 13.5px #8FB5AB. Then a full-width button
that NAMES the person — "Add Kai to the game" — height 66, border-radius 24, background #F5B93B,
box-shadow 0 5px 0 #C9902A, Baloo 2 800 24px #1C3A2E. Generic "Update plan" copy is wrong here.

Recalculate the upcoming windows through recommendSubIntervals when the squad changes. Removing a
child who is currently on the pitch is a heavier action — confirm before doing it.
```

---

## 6. Sign in — magic link, no password

`src/components/SignIn.jsx`

```
Rebuild sign in per README > A9-Signin (screens/16-signin.png). Magic link only — remove any
password field, confirm field and forgotten-password flow. Keep whatever auth the repo already uses;
this is presentation.

Screen: background #FFF6E5, padding 40px 28px, flex column, align center.

Centred lockup in a flex:1 wrapper: 132px round crest with border 6px solid #2E7D53 and
box-shadow 0 8px 0 rgba(28,58,46,.14); "Bench Buddy" Baloo 2 800 42px #1C3A2E, letter-spacing -.01em,
margin-top 22; tagline "Fair minutes, easy subs." Nunito 700 15.5px #6B7C72.

Then, full width: an email field — background #fff, height 64, border-radius 22,
box-shadow 0 3px 0 rgba(28,58,46,.10), padding 0 18px, placeholder "you@email.com" Nunito 700 17px
#A8B3AC. Below it the button "Send me a link" — height 70, border-radius 26, background #F5B93B,
box-shadow 0 5px 0 #C9902A, Baloo 2 800 25px #1C3A2E.

Under the button: "No password. We email you a link that signs you in and keeps you in."
Nunito 700 13.5px #6B7C72, centred. Staying signed in is the real anxiety, so say it.

"v1.2" Nunito 700 12px #A39C8A at the very bottom.
```

---

## 7. Bring the remaining match states in line with the live match screen

`src/components/MatchView.jsx`

```
The live match screen is correct. Four other match states still render the SUPERSEDED action bar and
must be brought in line with it. Their PNGs in screens/ (07-player-tap, 08-injured,
09-back-from-injury) may lag — the live match screen is the reference, not the images.

For every match state, copy the live match screen's action bar exactly: background #123F3D,
display flex, align-items center, gap 14, and ONE row containing the countdown on the left and ONE
button on the right. (Its margin, padding and corner radius are specified in block 8 — use those,
not the old edge-to-edge values.) No full-width button row
underneath. No status sub-line under the countdown.

Countdown: a single line, Baloo 2 800 26px #F5B93B, line-height 1.1 — "Next sub 2:20" while running,
"Ready to go" before kickoff, "Clock stopped" when paused.

The button: margin-left auto, flex 0 0 auto, height 66, border-radius 24, padding 0 30px,
Baloo 2 800 24px, gap 11, glyph 20x22. There are exactly three variants:
- "Start"  — yellow #F5B93B, box-shadow 0 5px 0 #C9902A, #1C3A2E text, play triangle
- "Pause"  — cream #F1E9D2, #123F3D text, two 6x22 bars with gap 5, no shadow
- "Resume" — same as Start, label "Resume"

**There is no "Sub done" button in the action bar.** Remove it from every match state. A swap is
committed in the next-sub bottom sheet (A2b-Match-final60), which has its own confirm row — that
sheet is the fourth state of the bar area and the only place "Sub done ✓" exists.

Also, in every one of these states: there is NO three-block progress bar under the timer (the
interval chips above the pitch carry that), and the cog is 54px, border-radius 50%,
border 4px solid #2E7D53, with a 27px solid 8-tooth gear icon.

Also, in every one of these states: there is NO three-block progress bar under the timer (interval
chips above the pitch carry that), and the cog is 54px, border-radius 50%, border 4px solid #2E7D53,
with a 27px solid 8-tooth gear icon.

Do all four states in one pass, then show me each one. They are tight at 844px, so if the keeper tile
no longer fits, reduce the header and pitch padding rather than shrinking the tiles.
```

---

## 8. Screen chrome, and the tap sheet

`src/components/MatchView.jsx` + the shared screen shell

Four separate changes. B and C are the ones that fix real bugs; A and D are visual.

```
Four changes to the match screens. Do them in this order and show me each one.

--- A. Inset the yellow header ---

The header currently runs edge to edge and is squared off at the top. Make it a card like every
other surface. On EVERY screen that uses it (all match states and the shared sub-header on the
non-match screens):

  margin: 14px 16px 0; background: #FBE3A6; padding: 18px 20px 20px; border-radius: 28px;

Delete the old "border-radius: 0 0 30px 30px". Cream paper should show above it and down both
sides, matching the 16px gutter the pitch, bench and chips already use.

--- B. The action bar is a floating dock, never fixed ---

The bar must not be position: fixed, and content must never scroll underneath it. It is the last
child in the screen's flex column, in normal flow:

  margin: 12px 16px 16px; padding: 16px; background: #123F3D; border-radius: 28px;

For the two bars that stack their content in a column (squad change, final-60), use padding
14px 16px instead. Delete the old "border-radius: 32px 32px 0 0" everywhere.

If a screen ever needs to scroll, the scroll container ends ABOVE the bar — do not make the bar
fixed and pad the content beneath it. Nothing may pass under it.

--- C. Tapping a player opens a bottom sheet, not an anchored popover ---

The tap options are currently a card anchored near the tapped shirt. On a tall phone that card gets
pushed off the bottom of the screen. Replace it with a bottom sheet, which cannot go out of view and
sits in the thumb's reach.

Sheet shell, used by BOTH the player-tap sheet and the injury sheet:

  position: absolute; left: 0; right: 0; bottom: 0; z-index: 6; background: #FFF6E5;
  border-radius: 32px 32px 0 0; box-shadow: 0 -16px 44px rgba(20,32,28,.42);
  padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 10px;
  border-top: 3px solid #F5B93B   (player tap)   /   3px solid #C4482A   (injury)

Grab handle, first child: 44x5, border-radius 999, background #DCD2B6, margin 0 auto 2px.
Scrim rgba(20,32,28,.55) over the rest of the screen. Tapping the scrim dismisses. No Close button.

Player-tap sheet header row (gap 11, padding 0 4px 2px): the player's 40x38 shirt glyph with his
number at 16px, his name in Baloo 2 800 26px #1C3A2E, then "12:40 played" pushed right with
margin-left auto in Nunito 800 13px #6B7C72. The tapped shirt on the pitch STAYS LIT above the
scrim — that is what tells the coach who this is about, and the name in the header confirms it.

Three full-width option rows:
  row: display flex; align-items center; gap 13; background #fff; border-radius 22;
       padding 13px 15px; box-shadow 0 3px 0 rgba(28,58,46,.10)
  icon tile: 44x44, border-radius 16, centred
  title: Baloo 2 800 20px #1C3A2E, line-height 1.1
  subtitle: Nunito 700 12.5px #6B7C72

  1. "Swap player"  / "Eli comes on"              tile #CBE8D6, glyph ⇄ #2E7D53
  2. "Make keeper"  / "Jack moves out"            tile #FBE3A6, glove glyph #1C3A2E
  3. "Mark injured" / "Off, clock stops for him"  tile #FAD3C8, cross glyph #C4482A

Injury sheet (tapping the red bench chip) uses the same shell: a 38px #C4482A disc with a white
cross, "Otis is out" Baloo 2 800 23px over "off at 12:40 · not counting minutes" Nunito 700 12.5px,
then a button row, gap 10, both height 60, border-radius 22:
  "Back to bench" flex 1.3, background #2E7D53, box-shadow 0 4px 0 #1F5A3B, #FFF6E5 text
  "Still out"     flex 1,   background #F1E9D2, #123F3D text
Both Baloo 2 800 20px.

LAYOUT RULE, and this is the part that broke when I built it — when a sheet is open:
  - add padding-bottom to the screen's flex column equal to the sheet's height (180px for the
    injury sheet), so the column reserves the space instead of letting the sheet cover content;
  - give the pitch min-height: 0 (and overflow: hidden) so flex:1 can actually shrink into that
    reserved space — without it the pitch keeps its content height and overflows under the sheet;
  - hide the action bar on that state, because the sheet covers it completely anyway;
  - the element being acted on must end up ABOVE the sheet, never behind it. For the injury sheet
    that means the bench row; for the player-tap sheet it is the shirt on the pitch, which is
    already clear.

Keep the cog menu as an anchored popover (block 1). It hangs off a fixed element at the top of the
screen, so it has no room problem, and a sheet for four rows would be heavy.

--- D. Injured players sit at the right-hand end of the bench ---

In the bench row, order the chips: available players first, then a divider, then anyone injured.

  divider: width 2, height 28, border-radius 1, background #DCD2B6, margin 0 2px
  the chip group gets align-items: center

So the bench reads "BENCH  [3 Rocco]  |  [6 Otis ✚]" — two zones, not one list. Available on the
left where the coach looks first, out on the right.
```

---

## How a swap gets committed

The action bar has exactly four states: **Start**, **Pause**, **Resume**, and the **next-sub bottom
sheet** (A2b-Match-final60). "Sub done ✓" is not one of them — it exists only inside that sheet, as
its confirm action. The action bar itself never shows it.

---

## 9. Set up next game — icons, copy, and the restart confirm

`src/components/SetupView.jsx` (the "Set up next game" screen)

Four changes to the screen you already have. Nothing here touches the keeper-changes expanded state.
Design reference: screen 4a in `Bench Buddy Direction A.dc.html`, and 4c for the confirm.

```
Four changes to the "Set up next game" screen. Keep everything I don't mention. Do NOT change the
expanded keeper-changes card — leave that exactly as it is.

--- A. Replace the four emoji row icons with drawn icons ---

The rows currently use emoji (glove, arrows, coffee cup, two people). Replace all four with inline
SVG in the same style as the rest of the app: a 44x44 tile, border-radius 16, flex 0 0 auto,
centred, holding a stroked glyph — fill none, stroke-linecap round, stroke-linejoin round.

Row 1 "First in goal"  tile #FBE3A6, glyph stroke #1C3A2E, stroke-width 1.9, 22x22, viewBox 0 0 24 24
  <path d="M7 12V5.6a1.6 1.6 0 0 1 3.2 0V11"></path>
  <path d="M10.2 11V4.4a1.6 1.6 0 0 1 3.2 0V11"></path>
  <path d="M13.4 11V6a1.6 1.6 0 0 1 3.2 0v7"></path>
  <path d="M16.6 10.4a1.6 1.6 0 0 1 3.2 0V15a6 6 0 0 1-6 6h-2.2a5 5 0 0 1-3.6-1.5L4 15.4a1.7 1.7 0 0 1 2.4-2.4L7 13.6"></path>
  (this is the same goalkeeper-glove path already used in the player-tap sheet — reuse it, don't redraw)

Row 2 "Keeper changes"  tile #CBE8D6, glyph stroke #2E7D53, stroke-width 2, 22x22, viewBox 0 0 24 24
  <path d="M20 8.5H5"></path>
  <path d="M8.6 5 5 8.5l3.6 3.5"></path>
  <path d="M4 15.5h15"></path>
  <path d="M15.4 12l3.6 3.5-3.6 3.5"></path>
  Two straight arrows pointing opposite ways, 7 units apart. Do not use curved/circular arrows —
  they fuse into a blob at 44px.

Row 3 "Breaks"  tile #F1E9D2, glyph stroke #123F3D, stroke-width 2, 21x21, viewBox 0 0 24 24
  <path d="M9 5v14"></path>
  <path d="M15 5v14"></path>

Row 4 "Manage squad"  tile #D6E5E0, glyph stroke #123F3D, stroke-width 1.9, 23x23, viewBox 0 0 24 24
  <circle cx="9" cy="8" r="3.1"></circle>
  <path d="M3.4 19.4a5.8 5.8 0 0 1 11.2 0"></path>
  <circle cx="17.2" cy="9.4" r="2.4"></circle>
  <path d="M17 14.2a4.6 4.6 0 0 1 3.7 3.4"></path>

Deliberately no red or pink tile in this row set — red is reserved for injury across the app.

The row itself: display flex, align-items center, gap 13, background #fff, border-radius 22,
padding 13px 15px, box-shadow 0 3px 0 rgba(28,58,46,.08). Label in Baloo 2 800 19px #1C3A2E, value
pushed right with margin-left auto in Nunito 800 15px #6B7C72, then a "›" at 18px #C9C4B6.

--- B. Cut the sub-interval message down to a label and let the chips do the talking ---

Right now that block reads "For today's 7 available players — tap a fairer sub interval, or keep
what you've got:" over five identical chips that all show a tick. Two lines of prose to say what the
chips already say. Replace the whole block with:

  a label, Nunito 800 14px #3E5148: "Even splits for 7 players"   (7 = today's available count)
  then the chip row underneath: margin-top 9, display flex, gap 7, flex-wrap wrap

Chips show the interval with a minute mark — 4' 5' 6' 7' 8' — not a bare number, and the BEST FIT
is filled so the coach has something to aim at:

  best fit:  background #2E7D53, box-shadow 0 3px 0 #1C5B3A, border-radius 999, padding 7px 15px,
             13px white tick, label Baloo 2 800 17px #fff
  others:    background #fff, border-radius 999, padding 7px 13px,
             12px #2E7D53 tick, label Baloo 2 800 17px #1C3A2E

The chips sit directly on the cream page — do NOT put them inside a tinted card. Two reasons: white
chips on #F1E9D2 lose their contrast, and the five chips only fit on one line if they have the full
348px content width. If they ever wrap, reduce the chip padding, never remove flex-wrap.

Keep the line above it as is: "2.0 min per interval · 10 sub windows".

--- C. Delete the red warning banner; confirm only when a game is in progress ---

Remove the pink/red "This will restart the rotation from 0:00 and clear this game's progress so far."
banner from the screen completely. It warns on every visit, including the visits where there is
nothing to lose, and what it says is wrong — minutes already played are NOT cleared.

Instead: when the primary button is tapped, check whether a game is currently in progress.

  No game in progress  -> build the rotation immediately, no confirmation, no interruption.
  Game in progress     -> open a confirm bottom sheet, using the SAME sheet shell as the
                          player-tap and injury sheets:

  scrim: position absolute, inset 0, background rgba(20,32,28,.55), z-index 5
  sheet: position absolute, left 0, right 0, bottom 0, z-index 6, background #FFF6E5,
         border-radius 32px 32px 0 0, box-shadow 0 -16px 44px rgba(20,32,28,.42),
         border-top 3px solid #F5B93B, padding 12px 16px 22px,
         display flex, flex-direction column, gap 12
  grab handle first child: 44x5, border-radius 999, background #DCD2B6, margin 0 auto 2px

  Amber top border, not red. Red is injury; this is caution.

  Header row (gap 11, padding 0 4px): a 40px circle, background #F5B93B, holding a 20x20 rotate
  glyph (stroke #1C3A2E, stroke-width 2.1, viewBox 0 0 24 24):
    <path d="M20 5.5v5h-5"></path>
    <path d="M19.5 10.2A8 8 0 1 0 12 20"></path>
  then "Today's game is running" in Baloo 2 800 23px #1C3A2E, line-height 1.1.

  Body, Nunito 700 14.5px #3E5148, line-height 1.45, text-wrap pretty, padding 0 4px:
    "A new rotation plans from 0:00. The 12:40 already played stays on each child's minutes — only
    the plan from here changes."
  Substitute the real elapsed time for 12:40. This sentence is the correction to the old banner —
  it must say minutes are kept, because they are.

  Button row, display flex, gap 10, both height 60, border-radius 22, Baloo 2 800 20px:
    "Build new rotation"  flex 1.35, background #2E7D53, box-shadow 0 4px 0 #1F5A3B, text #FFF6E5
    "Keep current"        flex 1,    background #F1E9D2, text #123F3D

  Tapping the scrim dismisses, same as the other sheets. No X button.

  Sheet layout rule, same as block 8C: give the screen's flex column padding-bottom equal to the
  sheet height (260px here), and min-height 0 on the scrolling rows region so it shrinks into that
  space instead of running under the sheet.

--- D. The primary button ---

It is currently a yellow "Save & Regenerate rotation". Make it green and rename it:

  margin: 12px 16px 16px; margin-top: auto; flex 1; background #2E7D53; border-radius 24;
  padding 17px; text-align center; Baloo 2 800 21px #fff; box-shadow 0 5px 0 #1C5B3A

Label: "Build new rotation" — the same words on the sheet's confirm button in C, so the coach sees
the phrase they tapped repeated back.
```


---

## 10. Building-rotation overlay, fairness mark, and the mid-match fairness toast

`src/components/SetupView.jsx` (overlay) + the shared match header + a new `RotationBuilding` component

Design reference: `Rotation Building.dc.html` — left frame is the overlay + success state, right frame
is the match screen with the toast, and the strip below it shows the fairness mark's three states.

```
Three related pieces. A is a new overlay after "Build my rotation". B is a reusable fairness mark.
C flashes that mark on the match screen when something changes mid-game. Build them in that order.

--- A. Progress overlay after "⚡ Build my rotation" ---

New self-contained component, props: averageMinutes (number), maxDifference (number),
onContinue (() => void). It owns its own timers and cleans them up on unmount.

When the CTA is pressed, show a centred overlay card while the rotation algorithm runs, ~1800ms.

  scrim: position absolute, inset 0, z-index 5, background rgba(20,32,28,.55), fade in over .3s
  card:  position absolute, left 22px, right 22px, top 50%, z-index 6,
         background #FFF6E5, border-radius 32, border-top 3px solid #F5B93B,
         box-shadow 0 22px 54px rgba(20,32,28,.42), padding 22px 20px 20px,
         display flex, flex-direction column, gap 14
  card enters from transform translateY(-46%) scale(.96) + opacity 0
              to   transform translateY(-50%) scale(1)   + opacity 1
              over .42s cubic-bezier(.22,.9,.3,1)

Title, Baloo 2 800 25px #1C3A2E: "Balancing the squad…"

Three steps reveal in sequence, roughly 530ms apart. Each step fades in and rises 12px:
  hidden:  opacity 0, transform translateY(12px)
  shown:   opacity 1, transform translateY(0)
  transition: opacity .38s ease, transform .38s cubic-bezier(.22,.9,.3,1)

  ⚽ Checking playing time
  ⚖️ Balancing rotations
  ✨ Finding the fairest setup

Each step has a 38px circular tile to its left, label in Baloo 2 800 18px:
  not yet reached  tile #F1E9D2, label #6B7C72
  active           tile #FBE3A6, label #1C3A2E
  finished         tile #2E7D53 with box-shadow 0 3px 0 #1C5B3A, holding a white tick
                   (17x17, viewBox 0 0 24 24, stroke #FFF6E5, stroke-width 3.6, path
                    "M4 12.5l5 5L20 6.5"), label #3E5148

No spinners, no progress bars, no percentage. The only motion is the fade+rise and the tile turning
green.

--- A2. Success state, same card ---

At ~1800ms the card becomes the success state in place — do not unmount and remount it. Title
changes to "✨ Rotation ready!" and border-top goes from #F5B93B to #2E7D53. The success content
fades in and rises 12px, same easing as the steps.

Content, top to bottom:

  1. Fairness card (full width): background #fff, border-radius 22, padding 14px 10px 16px,
     box-shadow 0 3px 0 rgba(28,58,46,.08), centred column, gap 6:
       caption "Fairness", Nunito 800 11px #6B7C72, uppercase, letter-spacing .07em
       the fairness mark at 44px (see B)
       the state label, Baloo 2 800 17px #1C3A2E
  2. Supporting line, Nunito 700 14.5px #3E5148, line-height 1.45, text-wrap pretty, centred:
       "Pitch time is within {maxDifference} min for every child."
     Say "pitch time", not "minutes" — pitch, goal and bench are counted separately everywhere
     else in the app, so a bare "14 min each" is ambiguous.
  3. Average row: background #F1E9D2, border-radius 20, padding 12px 16px, flex row —
       label "Average pitch time" Nunito 800 12px #6B7C72 uppercase letter-spacing .05em on the left,
       "≈ {averageMinutes} min" Baloo 2 800 24px #1C3A2E pushed right with margin-left auto, nowrap
  4. Primary button, full width, height 60, border-radius 22, background #2E7D53,
     box-shadow 0 4px 0 #1F5A3B, Baloo 2 800 20px #FFF6E5: "View my rotation" — calls onContinue

Confetti, once, on entering the success state: 16 small pieces falling inside the card, absolutely
positioned in a pointer-events:none, overflow:hidden, aria-hidden layer at z-index 2 behind the
content. Pieces are 7x12 rects (border-radius 2) and 8x8 circles, coloured from
#F5B93B / #2E7D53 / #FBE3A6 / #CBE8D6 / #123F3D. Each falls ~300px with a small horizontal drift
(-27px..+27px) and 300-660deg of rotation, duration 1.25-1.79s, staggered delays 0-0.39s, fading
out at the end. No red — red is injury. Skip confetti entirely when
prefers-reduced-motion: reduce.

ACCESSIBILITY, and this is the part that bit me building it: role="dialog", aria-modal="true",
aria-labelledby pointing at the title, aria-busy while the steps run, and the step list in an
aria-live="polite" region. On open, move focus to the card (tabIndex -1). When the success state
appears, move focus to "View my rotation". Trap Tab inside the card. While the overlay is open,
mark the screen behind it aria-hidden and make the CTA disabled with tabIndex -1, so the sequence
cannot be restarted underneath the scrim. Do the focus calls after the overlay has actually
mounted (a rAF retry or the same timer that reveals it) — calling focus in the same commit as the
state change is too early and silently does nothing. Honour prefers-reduced-motion by dropping the
transitions, not the state changes.

--- B. The fairness mark: one mark, three states ---

Reusable component. The mark is a balance beam inside a ringed circle, and the BEAM ANGLE carries
the meaning, so it stays readable down to 32px. Same mark everywhere fairness is shown.

  circle: background #FFF6E5, border 3px solid <ring>, border-radius 50%, box-sizing border-box
  glyph:  viewBox 0 0 24 24, fill none, stroke #1C3A2E, stroke-width 2,
          stroke-linecap round, stroke-linejoin round
            <g transform="rotate(<tilt> 12 8)">
              <path d="M4 8h16"></path>
              <circle cx="4" cy="8" r="1.5"></circle>
              <circle cx="20" cy="8" r="1.5"></circle>
            </g>
            <path d="M12 8v7"></path>
            <path d="M8.5 19l3.5-4 3.5 4z"></path>

Three states, chosen from the spread in minutes (max minus min pitch time):

  spread 0-2   ring #2E7D53  tilt 0    label "Fair"            toast "Subs still fair"
  spread 3-4   ring #F5B93B  tilt 9    label "Nearly fair"     toast "Nearly even"
  spread 5+    ring #C4482A  tilt 21   label "Needs attention" toast "Evening it up"

Only the ring colour and the beam tilt change — never the glyph, never the circle. A coach should
recognise the same mark on the success card and in a toast mid-game.

--- C. Mid-match fairness toast ---

When anything changes mid-game that could affect fairness — a swap, a late arrival, an injury, a
squad change — flash the fairness mark on the match screen as a toast, so the coach gets an
unprompted reminder that the remaining subs are still fair.

Placement: inside the yellow match header, anchored to the right of the timer row. The header gets
position: relative; the toast is position: absolute; right: 18px; bottom: 22px; pointer-events: none.
It MUST be out of normal flow — as a flex child it steals width from the timer row and wraps
"of 45 min" onto three lines even when hidden.

  pill: background #123F3D, border-radius 999, padding 7px 14px 7px 7px,
        box-shadow 0 5px 14px rgba(20,32,28,.3), flex row, align-items center, gap 9
  mark: 32px, as in B but with a 2.5px ring and a 17px glyph
  text: the state's toast copy, Baloo 2 800 16px #FFF6E5, white-space nowrap

  enters from opacity 0, transform translateX(18px) scale(.94)
  to         opacity 1, transform translateX(0) scale(1)
  transition opacity .28s ease, transform .42s cubic-bezier(.22,.9,.3,1)
  holds ~3s, then fades out. aria-live="polite" so it is announced once.

Do not block the pitch, the bench or the action bar with it, and never require a tap to dismiss.
```

---

## 11. Mid-match fairness toast — new visual (supersedes block 10C)

`src/components/MatchView.jsx` — the yellow match header only

```
This is a visual-only change to the mid-match fairness toast. Change NOTHING else. Do not touch the
timer, "of 45 min", the header padding, the team block, the cog, or any other screen, component,
spacing, colour or copy. Block 10C's dark pill design is dead; the mark below replaces it, in the
same place. Everything else in block 10 — the building overlay, the fairness mark on the Rotation
Ready success card, the three states, the ring colours, the beam tilts, and the list of events that
trigger a toast — stays exactly as built.

File: src/components/MatchView.jsx — the toast element inside the yellow match header, nothing else.

The toast is now the fairness mark on its own — no pill, no words on screen.

  holder: the timer row gets position: relative (its only change). The toast holder is
          position absolute, right 0, top 0, height 63px (the timer's line box), display flex,
          align-items center, pointer-events none. That centres the mark vertically on "12:40" and
          keeps it out of normal flow, so it can never steal width from the timer row.
  mark:   56px circle — 90% of the 63px timer line. background #FFF6E5,
          border 3.8px solid <state ring colour>, border-radius 50%, box-sizing border-box,
          box-shadow 0 5px 14px rgba(20,32,28,.16).
  glyph:  29px, stroke #1C3A2E, stroke-width 2, the same SVG paths and per-state tilt as block 10B.
          This is the Rotation Ready card's 44px mark scaled up, nothing redrawn — same ring, same
          beam, same proportions. The success card itself stays at 44px; do not resize it.

  At 56px the mark sits clear of "of 45 min" with about 20px to spare, so the header keeps its
  current one-line timer layout. Do not move or restyle that label.

  Animation — dissolve in from the side, hold, dissolve out:
    hidden  opacity 0, transform translateX(16px)
    shown   opacity 1, transform translateX(0)
    transition: opacity .5s ease, transform .5s cubic-bezier(.25,.8,.35,1)
    visible for 3s from the trigger, then reverses to hidden. No scale, no bounce.
    prefers-reduced-motion: reduce → no transition, snap in and out.

  Accessibility: keep aria-live="polite" on the holder, and keep the state's toast copy ("Subs still
  fair" / "Nearly even" / "Evening it up") inside it in a visually hidden span, so it is still
  announced once even though it is no longer drawn. Never require a tap to dismiss.
```

---

## 12. The checking → Rotation ready transition (supersedes the swap in block 10A)

`src/components/RotationBuilding.jsx` (the overlay card built in block 10)

```
This changes ONLY how the overlay card moves between its two states: the checklist ("Balancing the
squad…") and the result ("✨ Rotation ready!"). Change nothing else. Same copy, same colours, same
card, same steps, same fairness mark, same confetti, same three states, same triggers. Today the
checklist unmounts and the result mounts, so the card's height jumps and the whole thing lurches
upward. Nothing should unmount.

A. One content area, two layers.
   Inside the card, below the title, put a single stage element: position relative, and an explicit
   height in px that you set from measurement (below). Both states live inside it as siblings, BOTH
   mounted for the whole sequence:
     - checklist layer: position absolute, left 0, right 0, top 0, natural height
     - result layer:    position absolute, left 0, right 0, top 0, natural height
   Measure each layer's scrollHeight once they are mounted (retry on requestAnimationFrame until both
   report non-zero — they are not measurable on the first frame). Call them h1 (checklist) and h2
   (result).

   Stage height = h1 while checking, h2 once the result is in, with
   transition: height .58s cubic-bezier(.22,.9,.3,1).
   So the card grows into the result instead of snapping to it. The card stays vertically centred as
   it grows; that recentring is now interpolated, which is the point.

   Crossfade the layers, do not unmount them:
     checklist  opacity 1 → 0, transition opacity .3s ease
     result     opacity 0 → 1, transition opacity .4s ease
   The hidden layer gets aria-hidden and pointer-events none, and its "View my rotation" button gets
   tabindex -1 until the result is showing, so it is never focusable early.

B. The last tick becomes the fairness mark (the bit that sells it).
   At the moment the result appears, run a FLIP handoff on the fairness mark — do not fade a second
   circle in:
     1. Before showing the result, measure the third step's 38px green tick disc (getBoundingClientRect)
        and the result's 44px fairness disc.
     2. Compute dx, dy from centre to centre and s = 38 / 44.
     3. On the fairness disc, with transition none: transform translate(dx, dy) scale(s),
        background #2E7D53, border-color #1C5B3A, box-shadow 0 3px 0 #1C5B3A — i.e. it starts as the
        tick disc, in the tick disc's place. Inside it, the balance-beam glyph starts opacity 0 and a
        white 19px tick glyph (same path as the step ticks) starts opacity 1.
     4. Force a reflow, then on the next animation frame:
        transform translate(0,0) scale(1)
        transition: transform .62s cubic-bezier(.22,.9,.3,1),
                    background-color .38s ease .2s, border-color .38s ease .2s, box-shadow .38s ease .2s
        background #FFF6E5, border-color <state ring>, box-shadow none
        beam glyph  → opacity 1, transition opacity .3s ease .34s
        tick glyph  → opacity 0, transition opacity .24s ease .26s
     5. Fade the third step's own tick disc to opacity 0 over .16s as the handoff starts, so there is
        only ever one disc on screen.
   Reset those inline styles at the start of every run so a second build animates from scratch.

   Net effect: the mark the coach will see all match is born out of the last check passing. It is the
   same circle throughout — never two marks, never a pop-in.

C. prefers-reduced-motion: reduce
   No height transition, no FLIP, no travel: stage height jumps, layers swap instantly, mark appears
   in place with its ring and beam already set. Confetti stays suppressed as before.
```

---

## 13. Manual swap — travel and a gold hold marker

`src/components/MatchView.jsx` — the pitch tokens and the bench row only

```
This adds motion to a swap that is committed manually, plus a gold outline that holds after it lands.
It changes NOTHING else. Do not touch any badge, chip, or token design: sizes, colours, borders,
box-shadows, numbers, names, fonts, and spacing all stay exactly as they are. The Otis-style "needs
time" red bench chip keeps its existing treatment. Pitch, match header, timer, period chips, bench
card, action bar, and the fairness mark all keep their current behaviour and appearance. The only
new pixels on screen are the two gold outlines described in part C.

Trigger: a swap the coach commits themselves (the confirm action in the next-sub bottom sheet, and
any drag-or-tap swap on the pitch). Do NOT run this for scheduled or auto-applied swaps — those keep
whatever they do today.

A. Both players stay mounted, at both ends.
   Today a swap re-renders the pitch slot and the bench row with new occupants, so the change lands
   in a single frame. Instead, for the duration of a swap, render BOTH affected players in BOTH
   places at once — the outgoing player and the incoming player each get a pitch-slot node and a
   bench-chip node, all four mounted, and visibility is carried by opacity and transform alone.
   Nothing unmounts mid-animation.

   Give each pitch slot a zero-size positioning anchor at the slot's coordinates and absolutely
   position the token inside it, so a transform on the token cannot disturb the slot's position or
   any neighbouring token. Do the same for the bench chip: a fixed-width relative slot with the
   chips absolutely positioned inside it, right-aligned, so two chips can overlap without the bench
   row reflowing. Keep the bench slot wide enough for the longest squad name so the row never
   changes width.

   Rest states, per player per location:
     on pitch, present:   opacity 1, transform none
     on pitch, absent:    opacity 0, transform translateY(168px) scale(.58)
     on bench, present:   opacity 1, transform none
     on bench, absent:    opacity 0, transform translateY(-30px) scale(.82)

   Both absent states must be applied at rest, before any swap runs, so the browser has a "from"
   value and the transition actually fires when the occupants exchange.

B. The exchange.
   On commit, flip which player is present in which location. The transforms above then carry the
   motion: the outgoing player travels down and shrinks out of its pitch slot while its bench chip
   drops in from above; the incoming player rises into the vacated pitch slot while its bench chip
   lifts away. Down means leaving the field, up means joining it — keep that direction, it is what
   makes the swap readable.

   leaving (a node becoming absent):
     transform 500ms cubic-bezier(.5,0,.78,.1), opacity 310ms ease 80ms
   arriving (a node becoming present):
     transform 560ms cubic-bezier(.3,1.34,.5,1) 90ms, opacity 250ms ease 90ms

   The arriving curve overshoots slightly so the player settles rather than stops dead. Total
   perceived duration is about 650ms. Do not block input while it runs — a second swap committed
   mid-animation just re-flips the occupants and the same transitions carry it.

C. The gold hold marker.
   140ms after the travel completes, fade in a gold outline at BOTH ends of the swap, hold it for
   2000ms, then fade it out.
     - at the pitch slot: a ring concentric with the player's disc, 62px across, 3.5px solid #F5B93B,
       plus box-shadow 0 0 0 5px rgba(245,185,59,.22) as a soft halo.
     - at the bench slot: a ring following the chip's pill shape, inset -5px on every side (so it
       sits outside the chip's own border and does not alter it), 3px solid #F5B93B, plus
       box-shadow 0 0 0 4px rgba(245,185,59,.2).
   Both are separate elements drawn outside the token and the chip. Neither the token nor the chip
   changes in any way — no border, background, shadow, or size change on the existing artwork.
   Both rings are decorative: aria-hidden, pointer-events none.
     fade in:  opacity 220ms ease
     fade out: opacity 520ms ease
   The rings mark the slots, not the players, so they stay put if anything else moves.

   This is the part that survives a coach who looked away — the travel is gone in under a second,
   the outline is still there when they look back. If timing needs tuning later, tune the hold; leave
   the travel alone.

D. Announce it.
   An aria-live="polite" region announces the result once, as "<incoming> on for <outgoing>". Fire it
   on commit, not at the end of the animation.

E. prefers-reduced-motion: reduce
   No travel and no scaling. Both absent states become opacity 0 with transform none, and the
   exchange is a 160ms opacity crossfade at both ends. The gold outlines still appear, still hold
   2000ms, and still fade — under reduced motion they are the whole signal, so do not shorten them.
```

---

## 14. The final minute — two sheets instead of one

Replace: `src/components/MatchView.jsx` (both sheets), `src/components/styles.js` (two new tokens),
`src/hooks/useMatchState.js` (the timers and the commit)

```
The single "final 60 seconds" bottom sheet is replaced by two sheets that appear at different times
and do different jobs. Everything outside these two sheets stays exactly as it is: header, timer,
interval chips, pitch, bench row, cog, action bar, player tokens, badges, and the fairness mark all
keep their current design and behaviour. Add the two new colour tokens alongside the existing ones
in styles.js; do not re-point any shared hex.

Both sheets share the same shell: background #FFF6E5, border-radius 32px 32px 0 0, padding
12px 16px 14px 24px (note the wider left padding), 10px gap between children, box-shadow
0 -12px 40px rgba(20,32,28,.35). Both sit at the bottom of the match column IN FLOW, not as an
overlay — the pitch and the bench row must both stay visible above them. The rest of the screen sits
under a rgba(20,32,28,.55) scrim while either sheet is up; the sheet itself stays unscrimmed.
Both open with a 240ms slide-up and fade, and no animation under prefers-reduced-motion: reduce.

Each sheet starts with a grab handle: a 44x5px bar, border-radius 3px, background #DCD2B6, centred,
with 2px above and 4px below. Dragging it down dismisses the sheet.

=== SHEET 1 — PREPARE. Opens at 60 seconds before the planned sub. ===

Title "Next sub in 0:60", Baloo 2 800 25px #1C3A2E, line-height 1.05. Beside it, baseline-aligned,
the label "GET READY": 12px 800 uppercase #5A6B61, letter-spacing .04em.

Then one card per player who has to physically move before the whistle, and nobody else. A player
changing position inside the pitch does NOT appear on this sheet — they have nothing to do yet.
Players coming off do not appear either. In the reference case that means two cards: the keeper
coming on, then the outfield player coming on.

The incoming keeper's card is the emphasised one and always comes first:
  background #FFE9B8, border 2.5px solid #F5B93B, border-radius 22px, padding 13px 14px, 11px gap
  42px disc, background #2E7D53, white Baloo 2 800 19px kit number
  name in Baloo 2 800 22px #1C3A2E, then a GK pill: 11px 800 #1C3A2E on #F5B93B, radius 999px,
    padding 2px 7px
  instruction under the name: 800 17px #1C3A2E, line-height 1.15 — "Go stand by the goal"

Every other card is the quiet form, and its instruction sits inline after the name, not under it:
  background #F1E9D2, border-radius 20px, padding 11px 14px, 10px gap
  36px disc, background #2E7D53, white Baloo 2 800 16px kit number
  name in Baloo 2 800 18px #1C3A2E, then instruction 800 15px #3E5148 — "Ready at halfway"

Instruction copy is derived from the position being taken, not authored per player: keeper gets
"Go stand by the goal", any outfield position gets "Ready at halfway".

Actions: a secondary Pause (flex 1, height 54px, radius 22px, background #EDE3CB, Baloo 2 800 20px
#1C3A2E, with the existing two-bar pause glyph) and a primary "Ready ✓" (flex 1.25, height 54px,
radius 22px, background #F5B93B, box-shadow 0 5px 0 #C9902A, Baloo 2 800 20px #1C3A2E).

This sheet changes NO state. It dismisses itself after 10 seconds. The handle dismisses it early,
and Ready does exactly the same thing — Ready is a faster dismiss, not a confirmation. Do not add a
"prepared" flag, and do not let dismissing it affect what sheet 2 shows or when it appears.

=== SHEET 2 — EXECUTE. Appears at 30 seconds before the planned sub. ===

Title "Make the changes", Baloo 2 800 24px #1C3A2E. Beside it, baseline-aligned, the label
"0:30 · IN ORDER": 12px 800 uppercase #5A6B61, letter-spacing .04em.

Then the changes as numbered steps, 10px apart. Each step is a row with 10px gap, aligned to the top:

  the numeral: "1." "2." "3." in Baloo 2 800 26px #3E5148, line-height 1, width 26px, left-aligned,
    margin-top -3.5px. That negative margin is deliberate: at 26px against a 16px instruction the
    numeral's cap sits 3.5px low, and this lifts its top edge level with the instruction's. Bare
    numerals with a full stop — never a filled disc, because on this screen a disc means a player.

  the instruction: Baloo 2 800 16px #3E5148, line-height 1.
  under it, the players as two pill chips with an arrow between them, 8px gap:
    chip — flex 1, background #F1E9D2, border-radius 999px, padding 3px 11px 3px 3px, 8px gap,
      a 26px disc with an 800 13px kit number, then the name in 800 15px #1C3A2E, truncating
    arrow — 800 17px #2E7D53

Three colours, three meanings, and they must not be mixed:
  leaving the pitch          disc #E8664A, white number
  arriving on the pitch      disc #2E7D53, white number
  changing position, staying disc #2F6475, white number   <- new token
The arriving keeper's chip also carries the GK pill, right-aligned inside the chip.

Step order. The keeper change is always step 1, because the gloves have to pass before the outgoing
keeper can take an outfield place. After that the order is not constrained — put a player coming off
the bench before a player changing position, since nothing is holding them up. In the reference case:

  1. Goalkeeper swap        George (#2F6475) → Eli (#2E7D53, GK pill)
  2. Hugo comes on          Jack (#E8664A) → Hugo (#2E7D53)
  3. George takes the field Otis (#E8664A) → George (#2F6475)

Note the outgoing keeper appears twice, in two roles, which is what actually happens on the pitch.
He is never shown as a straight swap with the incoming keeper — step 1 is titled as the goalkeeper
swap, and his blue disc says he is not leaving.

Step titles: "Goalkeeper swap" for step 1; for the others, "<name> comes on" for a bench player and
"<name> takes the field" for a player changing position.

Actions: the same Pause secondary, and a primary "Sub done ✓" with the same geometry as Ready.

This sheet stays up until Sub done is tapped or it is pulled down by the handle. The clock running
past the planned sub time does not dismiss it — the whistle rarely lands on the planned second, and
the instructions have to still be there when it does.

=== WHEN THE CHANGE ACTUALLY APPLIES ===

Apply the rotation when Sub done is tapped, and timestamp it at the tap, not at the planned time.
The tap is the only signal of when the change really happened.

If Sub done has not been tapped by 30 seconds into the next interval, apply it anyway, timestamped
at that moment. Coaches miss taps; the record must not break when they do. The auto-apply must be
visible, not silent — reuse the fairness mark's dissolve-in from block 11 — and it must be undoable
through the existing Undo path.

Minutes: round to the interval for anything displayed, and store real seconds underneath. The
rounding is what people read; the seconds are what lets you see a bias that rounding would hide,
such as keeper changes always costing the same players the same 20-30 seconds.

An aria-live="polite" region announces each sheet once when it opens: the prepare sheet as
"Get ready: <name> to the goal, <name> at halfway", the execute sheet as "Make the changes, 3 steps".
```

---

## 15. Cancelling a change (send after block 14)

```
Files: src/components/MatchView.jsx, src/components/styles.js, src/hooks/useMatchState.js.
Reference: Bench Buddy Direction A.dc.html sections 13a / 13b / 13c, and
screens/21-cancel-step-open.png, screens/22-cancel-confirm.png, screens/23-cancel-done.png.

A player can refuse to come on. The coach needs to call off one step of the substitution without
touching the rest of it. This is temporary only — taking a player out for the remainder of the game
is the injured-player flow, not this one. Do not build a second, permanent option here.

New tokens to add to styles.js alongside the existing values:
  #8A9A90  the resting "more" glyph
  #B3BBB4  the numeral of a cancelled step
  #96A29A  the struck-through title of a cancelled step
  #7E8C83  the cancelled-step caption
  #E2EEE4  the Undo pill background
(#FBEDE9, #E8A899 and #B4462E already exist as the caution set — reuse them, do not add duplicates.)

=== REACHING THE STEP (sheet 2, the execute sheet) ===

Every step in the execute list gains a "more" control at the right end of its title row: 28x24,
border-radius 9px, background #F1E9D2, glyph "⋯" 800 15px #8A9A90, accessible name
"More options for step 2". Tapping anywhere on the step row opens that step; the control turns
background #1C3A2E, glyph #FFF6E5.

Do NOT put a ✕ on every row. Three delete targets in a sheet this size, held in one hand at the
side of a pitch, is a mis-tap waiting to happen.

The open step keeps its numeral, title and player chips, and gains an action strip below them:
margin-left 36px (so it lines up with the instruction, not the numeral), 8px gap, containing
  "✕ Cancel this change" — flex 1, height 46px, radius 16px, background #FBEDE9,
     border 2px #E8A899, Baloo 2 800 16px #B4462E
  "Close" — fixed width, padding 0 16px, height 46px, radius 16px, background #F1E9D2,
     Baloo 2 800 16px #3E5148

While a step is open, the OTHER steps collapse to a single line each: opacity .72, the numeral as
usual, then the title in Baloo 2 800 16px #3E5148 with the players as plain text beside it
("George → Eli") in 800 14px #6B7C72, truncating, and their own resting "⋯" at the right end.

That collapse is a hard requirement, not a flourish. The pitch above is flex:1 with min-height:0
inside the phone column, so every pixel the sheet grows is taken out of the pitch and the bottom row
of players is clipped. The sheet must stay the height it was before the step was opened. After any
change to this sheet, check that the pitch still renders at least 193px tall.

=== CONFIRMING ===

Cancel opens a centred dialog over a rgba(20,32,28,.55) scrim covering the whole screen:
card background #FFF6E5, radius 30px, padding 20px 18px 16px, 14px gap, 20px side margins,
box-shadow 0 20px 50px rgba(20,32,28,.4).

  title    "<name> doesn't come on", Baloo 2 800 26px #1C3A2E, line-height 1.05
  body     700 15px #3E5148, line-height 1.4:
           "<staying player> stays on. <name> stays on the bench, first on at the next interval."
  cancel   "✕ Cancel the sub" — height 50px, radius 20px, background #FBEDE9, border 2px #E8A899,
           Baloo 2 800 19px #B4462E
  keep     "Keep the sub" — height 52px, radius 20px, background #F5B93B,
           box-shadow 0 5px 0 #C9902A, Baloo 2 800 19px #1C3A2E

The consequence goes above the buttons because a cancelled sub always means someone else keeps
playing, and that is the part a coach forgets. Keep the sub is the primary: the dialog opened on one
tap and must cost one tap to leave. The body copy is generated from the step, not authored per case.

=== AFTER CANCELLING ===

The step greys out in place and keeps its number. Do not remove it and do not renumber the steps
below it — nothing may shift under the coach's thumb mid-sequence.

  numeral   Baloo 2 800 26px #B3BBB4
  title     Baloo 2 800 16px #96A29A, text-decoration line-through
  Undo      right-aligned pill, padding 3px 13px, radius 999px, background #E2EEE4,
            Baloo 2 800 15px #2E7D53
  caption   one line under the title, 700 13px #7E8C83, white-space nowrap with ellipsis:
            "Cancelled · <staying player> stays on · <name> first on at <next interval>′"

The player chips are dropped from the cancelled step. A cancelled step must not carry the vertical
weight of a live one — same height budget as above.

Both players in the cancelled step immediately lose their change badges on the pitch, so a glance up
matches the list again. The bench chip of the player who is not coming on KEEPS its ↑ arrow: he has
not lost his turn, he has moved to the front of it.

=== STATE ===

Cancelling removes that one step from the current interval's change set. Nothing else in the set is
affected, and the interval itself is not skipped.

The player who did not come on stays on the bench and goes to the front of the queue for the next
interval. Do not record him as having played, and do not clear what the rotation owes him — the
fairness maths must still see the deficit, which is what gets him on first next time.

Undo restores the step, its badges and the queue order, and is available until Sub done is tapped.
On Sub done, apply the remaining steps as block 14 describes, drop the cancelled step out of the
list for good, and store the cancellation with its timestamp so the minutes screen can account for
the gap. The 30-seconds-into-the-next-interval auto-apply applies the remaining steps only.

aria-live="polite" announces the outcome once: "Sub cancelled. <name> stays on the bench, first on
at <next interval> minutes."
```

---

## 16. Save your team — the sign-in sheet (send after block 15)

```
Files: a new src/components/SaveTeamSheet.jsx, plus src/components/styles.js.
Reference: Bench Buddy Direction A.dc.html sections 14a / 14b / 14c, and
screens/24-login-5aside.png, screens/25-login-7aside.png, screens/26-login-9aside.png.

This is NOT the first screen a user sees. Bench Buddy stays usable with no account: players,
rotations and matches all work signed out. This screen appears only when the coach taps Save Team.
It is a full-screen page, dismissible, and it must never read as a gate.

Copy, verbatim — do not rewrite:
  heading   "Save your team"
  body      "Create a free account to save your players, rotations and match history.
             Everything you've already entered will be kept."
  buttons   "Continue with Google", "Continue with Apple", "Continue with Email"
  panel     "Your current team will be linked to your account automatically."
  footer    "Bench Buddy Sports"

No new colours. Everything below is an existing token.

=== SHELL ===

Two parts: a green band at the top and a cream sheet that curves UP into it.

  band    height per squad size (below), background #2E7D53, no border radius, overflow hidden
  sheet   margin-top -30px, border-radius 30px 30px 0 0, background #FFF6E5 + the paper texture,
          padding 34px 26px 0, position relative, z-index 4, flex 1

The band has square corners and runs to the frame edges; the sheet's rounded top corners sit 30px
over it. Do not round the band's bottom corners — that is the older treatment and it is wrong here.

Inside the band, in this order:
  mown stripes   repeating-linear-gradient(180deg, rgba(255,246,229,.055) 0 34px,
                 transparent 34px 68px) — HORIZONTAL bands, not vertical
  centre circle  300x300, border 3px rgba(255,246,229,.4), border-radius 50%,
                 centred, bottom -176px so only the top arc shows
  close          top 44px, right 24px, 40x40, border-radius 14px,
                 background rgba(20,44,32,.34), border 2px rgba(255,246,229,.5),
                 glyph "✕" Baloo 2 800 21px #FFF6E5, accessible name "Close"
  player rows    below
  bench pill     background rgba(255,246,229,.18), radius 999px, padding 5px 14px,
                 700 13px #FFF6E5, with a 17px cream "+" disc; text "<A> and <B> on the bench"

The close control is deliberately NOT a cream circle. On a band of cream shirts a cream disc scans
as another player rather than a way out. 44px from the top keeps it clear of the status bar.

=== PLAYER MARKS ===

Reuse the pitch's shirt component, smaller. Same path, same stroke, same shadow — no new artwork:
  svg viewBox "0 0 62 58", fill #FFF6E5, stroke #1C3A2E, stroke-width 2.4, stroke-linejoin round
  wrapper filter drop-shadow(0 4px 0 rgba(0,0,0,.18))
  number  absolutely centred, Baloo 2 800, #1C3A2E
  name    below, 5px gap, 800 13px #fff, white-space nowrap
The goalkeeper's shirt is filled #F5B93B instead of cream, the same way the pitch marks him.

The column width is set by the NAME, not the circle — roughly 50px for a six-letter first name at
13px. That is what drives the layout below; do not solve a bigger squad by shrinking the shirt.

  up to 6 players   one arch. Band 282. Shirt 50x46, column 62.
                    lefts 29 / 93 / 157 / 221 / 285, tops 104 / 80 / 68 / 80 / 104. Pill bottom 70.
  7-8 players       two rows, 4 + 3. Band 320. Shirt 50x46, column 58.
                    back  lefts 20 / 106 / 192 / 278, tops 100 / 82 / 82 / 100
                    front lefts 63 / 159 / 255,       tops 176 / 166 / 176. Pill bottom 40.
  9-11 players      two rows, 5 + 4. Band 308. Shirt 44x40 (number 17px), column 52.
                    back  lefts 18 / 89 / 160 / 231 / 302, tops 100 / 86 / 80 / 86 / 100
                    front lefts 54 / 125 / 196 / 267,      tops 170 / 160 / 160 / 170. Pill bottom 40.

The front row tucks into the back row's gaps, like a team photo. The keeper stays on the end of the
back row at every size so his place in the graphic never moves. Note 9-a-side's band is SHORTER
than 7-a-side's — nine small shirts stack tighter than seven larger ones. Squad size does not
simply push the sheet down.

Two hard constraints, both of which broke during design:
  - the back row's outer shirts must clear the close control by at least 16px vertically
  - the lowest name must clear the bench pill by ~15px, and the pill must clear the sheet edge by
    at least 10px

=== SHEET CONTENT ===

One column, top-anchored, with the footer pinned by margin-top auto:

  heading      Baloo 2 800 38px #1C3A2E, line-height 1.02, letter-spacing -.4px
  body         700 16.5px #3E5148, line-height 1.45, text-wrap pretty, 12px below the heading
  buttons      14px below the body, 12px apart
  tick panel   20px below the buttons: background #F1E9D2, radius 20px, padding 14px 16px,
               10px gap, a 24px #2E7D53 disc with a cream ✓, then the panel copy
               at 700 14.5px #3E5148
  footer       margin-top auto, padding-bottom 14px, centred, 14px gap:
               "Bench Buddy Sports" at 700 13.5px #6B7C72, then the 134x5px #DCD2B6 home indicator

Those three gaps — 34 / 14 / 20 — are the same at every squad size. A taller band leaves a shorter
sheet, and that slack comes out of the gap above the pinned footer (81px at 5-a-side, 43px at 7).
Do not equalise the footer gap by changing the three gaps per squad size.

=== BUTTONS ===

All three are full width, box-sizing border-box, padding 0 22px, 15px gap, contents left-aligned:
  Google  height 62px, radius 22px, background #F5B93B, box-shadow 0 5px 0 #C9902A
  Apple   height 60px, radius 22px, background #F1E9D2
  Email   height 60px, radius 22px, background #F1E9D2
  each    a 34px #FFF6E5 chip at radius 12px holding the mark, then the label in
          Baloo 2 800 20px #1C3A2E

Because the padding and chip size are shared, all three marks start on the same vertical line and
all three labels start on a second one. Keep it that way.

Use Google's and Apple's OWN sign-in assets for the marks — neither may be recoloured, redrawn or
resized off their published ratios. The envelope for Email is ours: 18px, stroke #3E5148 at 2.1px,
round caps and joins. Google is the primary because it is the one most coaches will use; Apple and
Email are the same width in tan so the hierarchy is colour, not size. No small-print links.

=== BEHAVIOUR ===

Signing in must not lose anything. The rotation, the players and any match already in progress are
in local state before this screen opens; on success they attach to the new account and the coach
returns exactly where they were. On dismiss they also return exactly where they were, still signed
out, with Save Team still available.

The bench pill names real bench players. With more than two, write "<A>, <B> and 2 others on the
bench" rather than growing the pill.
```
