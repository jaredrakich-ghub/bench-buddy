# Handoff: Bench Buddy — Match Link

## Overview
**Match Link** lets a coach hand the running of a game to another adult — usually a parent — for one
match. The coach builds the rotation plan as normal, sends a link to the one person who agreed to
help, and that person runs the subs on their own phone while the coach coaches, referees, or stays
home sick.

It is **not** a spectator feature. Nobody receives this link without being asked, the link is
addressed to one email, and there is no browse-the-team view. Every piece of copy in the design was
written to keep that clear; if you find yourself writing the words "follow", "watch" or "live for
parents", the framing has drifted.

Match Link is a **Pro** feature. Running a match yourself, with fair rotations, is free.

## Two handover levels
The coach chooses how much to hand over. This is the one product decision in the feature.

| Level | Parent controls | Coach keeps | When |
| --- | --- | --- | --- |
| **Subs** | make substitutions, mark injuries | the clock (start / pause / resume / half time) | Coach is at the game but has his hands full — refereeing, coaching |
| **Full game** | subs **and** the clock | nothing during the match | Coach cannot be there at all — sick, away, two games at once |

Both levels use the **same match screen**, which is the screen the coach already sees. The only
visual difference is which controls are live. Do not build a separate parent UI.

## About the design file
`Bench Buddy Features.dc.html` is a **design reference created in HTML** — a prototype showing
intended look and behaviour, not production code. Recreate it in the app's existing environment
using its established patterns and components. Do not import it or port its markup.

It is a canvas of phone-sized frames (380×844) side by side, each with a `data-screen-label`. Only
these four are in scope:

| Frame | `data-screen-label` | Render |
| --- | --- | --- |
| 2a | `F2a-MatchLink-share` | `screens/01-coach-share.png` |
| 2b | `F2b-MagicLink-email` | `screens/02-magic-link-email.png` |
| 2c | `F2c-MatchLink-parent-subs` | `screens/03-subs-handover.png` |
| 2d | `F2d-MatchLink-parent-full` | `screens/04-full-game-handover.png` |

Everything else in the file (frames 1a–1d availability links, 3a–3b Pro locks, 4a–4b upgrade) is a
different feature. **Do not build it.**

## Flow
```
Coach                                   Parent
─────                                   ──────
2a  Match Link
    ├ choose handover level
    ├ toggles: expires at full time, ask for an email
    └ Share to WhatsApp / Copy link ──▶ 2b  enter email
                                            └ receives emailed link
                                                    │
                                        2c  subs handover        (level = subs)
                                        2d  full game handover   (level = full)
```
2a and 2b are **consecutive steps**, not alternatives — 2a is the coach's phone, 2b is the parent's.
If the coach turns "Ask for an email first" off, 2b is skipped and the link opens 2c/2d directly.
2c and 2d **are** alternatives: they are the two handover levels.

## Behaviour and rules

### Link and token
- One link per match, not per parent. Regenerating invalidates the previous link.
- "Stops working at full time" (default on): the token expires when the match ends, or at a hard
  cap of kickoff + 4 hours if full time is never recorded.
- "Ask for an email first" (default on): the shared URL is a **claim** URL. Opening it asks for an
  email and mails that address its own single-use token, which then binds to that device. A
  forwarded claim URL is useless once claimed. With the toggle off, the shared URL grants access on
  open — offer this only as a deliberate choice, and say what it costs.
- The coach's list ("WHO HAS THE GAME") shows who claimed the link. He can revoke a holder
  mid-match; the parent's screen drops to a "Dave has taken the game back" state at once.
- Emails are used once, to send the link. Do not add the address to any list, and do not create an
  account for it.

### Permissions during the match
- The parent's session is scoped to **one match**. No squad editing, no season data, no other
  matches, no team settings.
- **Subs level**: the parent's clock controls are absent — not disabled-looking, absent. The screen
  states who has the clock in the header sub-line.
- **Full game level**: the parent gets the clock too. The header sub-line states why they have it.
- Two people, one game: every change is attributed and broadcast to both screens. Last write wins
  per player; the clock is single-owner, so whoever does not own it cannot write it at all.
- If the connection drops, the parent's screen keeps its own clock running from the last known state
  and queues sub events; on reconnect, the server's clock wins and queued subs replay in order.

### Push
- Coach gets a notification when the link is claimed, and when a sub is made if the app is
  backgrounded.
- The parent gets the same 60-second sub warning the coach's app gives.

## Design system
Shared with the rest of the app. Fonts: **Baloo 2** (display, weights 500–800) and **Nunito**
(text, 400–800).

| Token | Value |
| --- | --- |
| Paper | `#FFF6E5` (with the ball-motif paper texture) |
| Card | `#FFFFFF` |
| Header card | `#FBE3A6` |
| Ink | `#1C3A2E` |
| Ink muted | `#3E5148` |
| Ink light | `#6B7C72` |
| Gold ink (on yellow) | `#96772F` |
| Green | `#2E7D53`, shadow `#1F5C3C` |
| Deep green (action bar) | `#123F3D` |
| Gold | `#F5B93B`, shadow `#C9902A` |
| Sand | `#F1E9D2` / `#EDE7D3` |
| Outgoing badge | `#E8664A` |
| Stopped clock digits | `#7F7C50` |
| Shadows | solid, not blurred: `0 4-6px 0 <darker>` |

## Screens

### 2a — Match Link (coach) · `F2a-MatchLink-share`
- **Purpose**: choose who runs the game and how much they get.
- **Header pill**: `#FBE3A6`, radius 30, `padding: 14px 18px`, `margin: 12px 16px 0`. Back button
  52×52 white, radius 18, `‹` Baloo 2 800 26px. Title "Match Link" Baloo 2 800 27px `#1C3A2E`.
  `PRO` badge right: `#1C3A2E` fill, `#F5B93B` text, Nunito 800 11px, `letter-spacing: .06em`,
  `padding: 5px 10px`, radius 999.
- **Explainer card**: white, radius 24, `padding: 18px`. Title "Hand the subs to someone" Baloo 2
  800 22px. Body Nunito 600 15px `#3E5148`, `line-height: 1.5`.
- **Link card**: white, radius 24. Section label Nunito 800 13px `#6B7C72`
  `letter-spacing: .08em`. URL value in a `#F1E9D2` well, radius 18, `padding: 14px 16px`, Nunito
  800 16px `#2E7D53`.
- **Toggles**: 58×34 track, radius 999, on = `#2E7D53`, knob 26px white. Rows "Stops working at
  full time" and "Ask for an email first", Nunito 700 15px `#3E5148`. Footnote under them Nunito
  700 14px `#6B7C72`.
- **Holder list**: label "WHO HAS THE GAME · 1"; one row, email Nunito 700 15px `#1C3A2E` with the
  role right-aligned in `#6B7C72`.
- **Buttons**: primary "Share to WhatsApp" height 64, radius 26, `#2E7D53`, shadow
  `0 6px 0 #1F5C3C`, Baloo 2 800 23px white. Secondary "Copy link" height 56, radius 22, `#EDE7D3`,
  Baloo 2 800 20px `#1C3A2E`.
- **To add in build**: the handover-level control (subs / full game) is specified but not drawn in
  this frame — put it directly above the link card as a two-option segmented row using the interval
  chip style (active `#1C3A2E`/`#FFF6E5`, inactive white/`#6B7C72`), and change the explainer card's
  title and body with the selection.

### 2b — Claim the link (parent) · `F2b-MagicLink-email`
Shown in one frame as two states: the form, and the confirmation sheet that covers it after tapping.
- **URL chip** (browser, not app chrome): `#EDE7D3`, radius 16, `padding: 9px 14px`, Nunito 700
  14px `#6B7C72`, padlock glyph 12×14 `#6B7C72`.
- **Crest**: 96px circle, `border: 6px solid #2E7D53`, logo `object-fit: cover` at `scale(1.5)`.
- **Title** "Take the subs for Tigers FC" Baloo 2 800 32px, `line-height: 1.1`, centred.
- **Body** "Dave has asked you to handle the subs today. Enter your email and we'll send you the
  link. No password and no app to install." Nunito 600 16px `#3E5148`.
- **Email field**: white, radius 22, `padding: 18px 20px`, Nunito 700 17px `#1C3A2E`.
- **Button** "Email me the link": height 64, radius 26, `#2E7D53`, shadow `0 6px 0 #1F5C3C`.
- **Footnote** "Used once, to send this link. Nothing else." Nunito 700 14px `#6B7C72`, centred.
- **Sent sheet**: scrim `rgba(20,32,28,.5)` over the form; sheet `#FFF6E5`, radius
  `34px 34px 38px 38px`, `padding: 24px 22px 30px`, shadow `0 -18px 44px rgba(20,32,28,.28)`.
  Grabber 56×6 `#DCD4C0`. Gold disc 52px `#F5B93B` with an envelope glyph. Title "Check your email"
  Baloo 2 800 26px. Body names the address in bold. Secondary "Send it again" height 60, radius 24,
  `#EDE7D3`. Tertiary line "Wrong address? Start over" with "Start over" in `#2E7D53`.
- The match name stays visible behind the sheet so the parent can tell the tab is the right one.

### 2c — Subs handover (parent) · `F2c-MatchLink-parent-subs`
The coach's match screen with sub controls live and no clock controls.
- **Header card**: `#FBE3A6`, radius 30, `padding: 14px 18px 16px`.
  - Crest 50px, `border: 4px solid #2E7D53`.
  - Fixture "Tigers FC v Rovers" Baloo 2 800 19px `#1C3A2E`, `white-space: nowrap`.
  - Sub-line "You're on subs for Dave today" Nunito 800 12px `#96772F`. **This line carries the
    handover state and must always be present.**
  - `LIVE` pill: white, radius 999, `padding: 6px 12px`, Nunito 800 12px `#2E7D53`, 9px dot.
  - Clock row: `35:32` Baloo 2 800 58px `#1C3A2E`, then "of 45 min" Nunito 800 14px `#96772F`
    (`flex: 0 0 auto; white-space: nowrap`). **Nothing else in this row** — it overflows a 380px
    frame if anything is added.
- **Handover banner**: `#F1E9D2`, radius 20, `padding: 11px 14px`, Nunito 800 14px `#7A6320`,
  padlock glyph. Copy: "You're handling the subs today for Dave, the team coach."
- **Interval strip**: horizontally scrollable, `gap: 8px`. Chip `padding: 9px 14px`, radius 16,
  Nunito 800 14px; active `#1C3A2E` bg `#FFF6E5` text, inactive white bg `#6B7C72` text. The strip
  **is** the rotation plan — there is no separate plan screen. Clipping the last chip at the frame
  edge is correct.
- **Pitch card**: `flex: 1; min-height: 0`, radius 28, `#2E7D53`, mowed stripes
  `repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0 34px, rgba(0,0,0,.05) 34px 68px)`,
  hand-drawn halfway line and centre circle `stroke: rgba(255,255,255,.3); stroke-width: 2.4`.
  - Jersey 58×54, fill `#FFF6E5`, `stroke: #1C3A2E 2.4`, `filter: drop-shadow(0 4px 0
    rgba(0,0,0,.18))`; number Baloo 2 800 22px centred; name below Nunito 800 15px white.
  - Keeper jersey fill `#F5B93B`.
  - Outgoing badge: 24px disc `#E8664A`, white `↓`, top-right.
  - Incoming badge: 24px white disc, `border: 2px solid #2E7D53`, `#2E7D53` `↑`, top-left.
- **Bench strip**: `#F1E9D2`, radius 22, `padding: 11px 14px`. "BENCH" Baloo 2 800 15px `#6B7C72`.
  Chips white, radius 999, `padding: 5px 12px 5px 5px`; number disc 28px (`#2E7D53`/white, keeper
  `#F5B93B`/`#1C3A2E`); name Nunito 800 15px. The **keeper's bench chip carries the glove glyph**
  (`#2E7D53`, 14px); players coming on carry `↑`.
- **Action bar**: `#123F3D`, radius 28, `padding: 14px 16px`. Stat "Next sub 4:28" Baloo 2 800 25px
  `#F5B93B`, single line, no sub-label. Button right: height 62, `padding: 0 26px`, radius 24, cream
  `#FFF6E5`, shadow `0 5px 0 #B9C9BA`, Baloo 2 800 22px `#1C3A2E`, ❙❙ glyph left of "Pause".
  In the subs level the parent does **not** get this button — see below.
- **Minutes link**: "Today's Minutes" centred under the bar, Nunito 800 15px `#2E7D53`. Opens the
  existing minutes view read-only.
- **Build note**: frame 2c is drawn with Pause present, which is the *full-game* control. At the
  subs level, replace it with the sub action the app already uses at the 60-second mark and leave
  clock ownership to the coach; keep the bar's geometry identical.

### 2d — Full game handover (parent) · `F2d-MatchLink-parent-full`
Identical to 2c with the clock handed over, shown in its **stopped** state.
- Sub-line: "Dave is off sick · you have the game".
- Clock digits go `#7F7C50` while stopped; they return to `#1C3A2E` when running.
- No handover banner (the sub-line carries it) — this is also what keeps the frame inside 844px.
- Action bar: stat "Clock stopped" Baloo 2 800 21px `#F5B93B`, `white-space: nowrap`. Button
  "Resume": height 62, `padding: 0 20px`, radius 24, `#F5B93B`, shadow `0 5px 0 #C9902A`, Baloo 2
  800 22px `#1C3A2E`, ▶ glyph left of the label.
- Half time lives in the app's existing settings/overflow, not in the header.

## Layout budget — read before changing these screens
The frame is 380×844. The pitch card is the only `flex: 1` element, so **every pixel added above or
below it comes out of the pitch** and clips the bottom row of players. This has bitten the design
four times in review:
- the header clock row cannot hold a third item beside the digits and "of 45 min";
- the header top row cannot hold a third item beside the fixture and the `LIVE` pill;
- the action bar's stat and button together must stay under `348 − 32 = 316px`;
- 2d cannot carry both a banner and a full-height action bar.

After any change, check the pitch still renders at least 193px tall and that
`row.scrollWidth <= row.clientWidth` for the header rows and the action bar.

## Accessibility
- Contrast: body text meets 4.5:1, headline-scale type 3:1. `#96772F` on `#FBE3A6` and `#7A6320` on
  `#F1E9D2` were chosen for this; do not lighten them.
- Hit targets: minimum 44px. The bench chips and interval chips are at that floor already.
- The handover state must be conveyed in text, not colour alone — that is the sub-line's job.
