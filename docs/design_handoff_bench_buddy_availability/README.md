# Handoff: Bench Buddy — Availability link

## Overview
**Availability link** lets a coach ask a whole team who is playing, with one link posted into the
existing WhatsApp group. Parents tap the link, answer for their own child, and optionally add a
note. On Saturday morning the coach opens Set up new game and *Who's here* is already filled in.

The coach never types the message and never chases individual replies. Parents never install
anything, never make an account, and never see any part of the app beyond answering one question.

Availability links are a **Pro** feature. Setting up a match and running fair rotations is free.

## The one open decision
The parent side is drawn **two ways**. Pick one before building — they are alternatives, not steps.

| | `1b` squad list | `1c` one child |
| --- | --- | --- |
| Parent sees | every child's answer | only their own child |
| Answer flow | tap your child inline, answer in place | pick your child, then one question fills the screen |
| Gains | the social nudge — stragglers see who has replied | privacy; nothing about other families is exposed |
| Costs | every parent sees who pulled out | coach has to chase the quiet ones himself |

`1b` reproduces the pressure the group chat already creates, which is what actually gets replies.
`1c` is the safer answer if the club has any duty-of-care position on parents seeing each other's
children. **Default to `1c` if nobody decides** — it is the one that cannot cause a complaint.

Both share screens `1a` and `1d` unchanged.

## About the design file
`Bench Buddy Features.dc.html` is a **design reference created in HTML** — a prototype showing
intended look and behaviour, not production code. Recreate it in the app's existing environment
using its established patterns and components. Do not import it or port its markup.

It is a canvas of phone-sized frames (380×844) side by side, each with a `data-screen-label`. Only
these four are in scope:

| Frame | `data-screen-label` | Render |
| --- | --- | --- |
| 1a | `F1a-Availability-compose` | `screens/01-coach-compose.png` |
| 1b | `F1b-Availability-parent-list` | `screens/02-parent-squad-list.png` |
| 1c | `F1c-Availability-parent-focused` | `screens/03-parent-single-child.png` |
| 1d | `F1d-Setup-with-availability` | `screens/04-coach-setup.png` |

Everything else in the file (frames 2a–2d Match Link, 3a–3b Pro locks, 4a–4b upgrade) is a
different feature. **Do not build it.**

## Flow
```
Coach                                    Parent
─────                                    ──────
1a  Who's playing?
    ├ match, squad, closing time
    ├ preview of the exact group message
    └ Share to WhatsApp / Copy link ──▶  1b or 1c   answer for your child
                                             ├ Playing / Can't make it
                                             ├ optional note chips + free text
                                             └ Send to coach
                                                     │
1d  Set up new game  ◀───────────────────────────────┘
    Who's here pre-filled; notes attached; non-repliers still tappable
```

## Behaviour and rules

### The link
- **One link per match**, shared with everyone. Not one link per child — the coach must never have
  to copy nine links.
- No login, no account, no app install. The link opens a web page.
- The link stays open after the closing time; closing only changes the page's framing (a line
  saying the coach has been told, answers still accepted). **Never** hard-close it — a parent
  answering late is strictly better than a parent not answering.
- The coach can reopen or resend at any time; the same URL keeps working.
- A parent can change their answer by reopening the link. The coach sees the latest answer with a
  changed-at time.
- Answers are per child, not per device. Two parents of the same child hitting the link will
  overwrite each other — last write wins, and the coach sees who answered last.

### Identity, and its limits
There is no authentication here, and there should not be: the friction would kill the reply rate.
Anyone with the link can answer for any child in that squad. Accept that and design around it:
- the coach's list shows **when** each answer arrived, so an odd change is visible;
- the coach can override any answer in `1d`;
- do not show phone numbers, emails, addresses or anything else about a family on the parent page.
  Child first names and shirt numbers only.

### Notes
- Three preset chips: **Arriving late**, **Leaving early**, **Can keep goal**. Multi-select.
- One free-text field, optional, one or two lines. Visible to the coach only — state that on the
  page.
- `Can keep goal` should feed the goalkeeper rotation the app already builds; `Arriving late` and
  `Leaving early` should be visible at the moment the coach builds the rotation, not buried.
- Notes travel with the child into `1d` and stay attached for the match.

### What lands in Set up new game (`1d`)
- Children who answered **in** are pre-selected in *Who's here*.
- Children who answered **out** appear greyed at the end of the list, still tappable — a child who
  said no and then turns up must be one tap to add.
- Children who never answered appear greyed as "waiting", also tappable.
- The count pill reflects the pre-selected total.
- A one-line summary states the shape of it: "Six answered your link. Sarah is out, two haven't
  replied."
- **Nothing is locked.** The link fills the screen in; the coach still decides.

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
| Green tint | `#E3F0E5`, chip `#C9E4CE` |
| Gold | `#F5B93B`, shadow `#C9902A` |
| Sand | `#F1E9D2` / `#EDE7D3` / well `#F8F3E3` |
| Out / negative | `#B4462F` |
| Disabled disc | `#BFC7BE` |
| Shadows | solid, not blurred: `0 4-6px 0 <darker>` |

Shared furniture across all four screens:
- **Header pill**: `#FBE3A6`, radius 30, `padding: 14px 18px`, `margin: 12px 16px 0`; back button
  52×52 white, radius 18, `‹` Baloo 2 800 26px; title Baloo 2 800 27px `#1C3A2E`.
- **Card**: white, radius 22–24, `padding: 14–18px`.
- **Section label**: Nunito 800 13px `#6B7C72`, `letter-spacing: .08em`, uppercase.
- **Player chip**: radius 999, `padding: 6px 14px 6px 6px`; number disc 28–34px `#2E7D53` with white
  Nunito 800 text; name Nunito 800 15–16px.
- **Primary button**: height 64, radius 26, `#2E7D53`, shadow `0 6px 0 #1F5C3C`, Baloo 2 800 23px
  white. **Secondary**: height 56, radius 22, `#EDE7D3`, Baloo 2 800 20px `#1C3A2E`.

## Screens

### 1a — Who's playing? (coach) · `F1a-Availability-compose`
- Header pill, title "Who's playing?".
- **Match card**: fixture Baloo 2 800 21px; "Sat 13 Sep · 9:30 am · Hillcrest Park" Nunito 700 15px
  `#6B7C72`.
- **Message preview card**: label "WHAT THE GROUP SEES"; the message itself in a `#F1E9D2` well,
  radius 18, `padding: 14px 16px`, Nunito 600 15px `#3E5148`, with the URL below it in Nunito 800
  `#2E7D53`. Under the well: "Closes Friday 6:00 pm. You can reopen it any time." Nunito 700 14px
  `#6B7C72`.
  **The preview is the message.** What ships to WhatsApp must be byte-identical to what is shown
  here — no share-sheet template, no extra footer, no tracking suffix.
- **Squad card**: label "SQUAD · 9", chips wrapping, `+ 4 more` chip last, then the reply state
  ("Nobody has answered yet." → "6 of 9 answered").
- Buttons: Share to WhatsApp (primary), Copy link (secondary).
- **To add in build**: the closing time is stated but not editable in the frame — put a tap target
  on that line opening the app's existing date/time picker.

### 1b — Squad list (parent, web) · `F1b-Availability-parent-list`
- **URL chip** (browser, not app chrome): `#EDE7D3`, radius 16, `padding: 9px 14px`, Nunito 700
  14px `#6B7C72`, padlock glyph 12×14.
- Fixture Baloo 2 800 29px, detail line Nunito 700 15px `#6B7C72`. Label "TAP YOUR CHILD".
- **Answered row**: white, radius 22, `padding: 12px 16px`; 34px number disc; name Baloo 2 800 20px;
  status right — `In ✓` Nunito 800 15px `#2E7D53`, `Out` `#B4462F`, `Waiting` `#6B7C72` at
  `opacity: .75`.
- **Expanded row** (the child being answered for): white, `border: 3px solid #F5B93B`, radius 24.
  Contains: name row; two answer buttons side by side, height 56, radius 20 — **Playing** `#2E7D53`
  shadow `0 5px 0 #1F5C3C` white text, **Can't make it** `#F1E9D2` `#1C3A2E` text; note chips
  `padding: 9px 14px` radius 999, selected `#FBE3A6` `#1C3A2E`, unselected `#F1E9D2` `#6B7C72`;
  free-text well `#F8F3E3` radius 16.
- Sticky footer button "Send to coach": height 64, radius 26, **gold** `#F5B93B`, shadow
  `0 6px 0 #C9902A`, Baloo 2 800 23px `#1C3A2E`.
- Only one row expands at a time; answering collapses it to its status.

### 1c — One child (parent, web) · `F1c-Availability-parent-focused`
The same page after the parent has picked their child; the picker step is the squad list without
statuses.
- Back affordance "‹ Not your child? Pick again" Nunito 800 15px `#2E7D53`.
- **Question card**: white, radius 26, centred — 64px `#2E7D53` disc with the shirt number in Baloo
  2 800 28px white; "Is Bobbie playing?" Baloo 2 800 32px, `line-height: 1.1`; match detail Nunito
  700 15px `#6B7C72` over two lines.
- **Answer buttons**, full width, stacked, height 68, radius 24, Baloo 2 800 26px — **Yes, playing**
  `#2E7D53` shadow `0 6px 0 #1F5C3C` white; **Can't make it** white, shadow `0 5px 0 #DCD4C0`,
  `#1C3A2E`.
- **Note card**: label "ANYTHING THE COACH SHOULD KNOW?"; chips as in 1b at `padding: 10px 15px`;
  free-text well `#F8F3E3` radius 16, `min-height: 38px`; footnote "Optional. Only the coach sees
  this." Nunito 700 14px `#6B7C72`.
- Footer "Send to coach", gold, as in 1b.

### 1d — Set up new game (coach) · `F1d-Setup-with-availability`
The app's existing setup screen with the availability result folded in.
- Header pill "Set up new game".
- Title row: "Who's here" Baloo 2 800 27px + count pill `#C9E4CE` radius 999 `padding: 5px 14px`
  Nunito 800 15px `#1C3A2E`.
- **Summary line**: `#E3F0E5`, radius 20, `padding: 14px 16px`, Nunito 700 15px — the sentence in
  `#1C3A2E`, the qualifier in `#6B7C72`.
- **In chips**: white, radius 999, 32px `#2E7D53` disc. A child with a note carries
  `border: 2px solid #F5B93B` and a small tag ("late") in Nunito 800 13px `#96772F`.
- **Out / waiting chips**: `#F1E9D2`, disc `#BFC7BE`, label `#6B7C72` with the reason appended
  ("Sarah · out", "Ollie · waiting"). Still tappable.
- **Nudge row**: white card, 44px `#FBE3A6` tile with a bell glyph, "Nudge the two waiting" Baloo 2
  800 19px, `PRO` badge right (`#1C3A2E` fill, `#F5B93B` text, Nunito 800 11px,
  `letter-spacing: .06em`, `padding: 4px 9px`, radius 999).
- **Stat trio** unchanged from the app: three white cards, radius 24, value Baloo 2 800 32px, label
  Nunito 800 13px `#6B7C72` `letter-spacing: .06em` — ON PITCH / TOTAL / SUB EVERY.
- Fairness line "✓ These sub settings provide a fair rotation." Nunito 800 15px `#2E7D53`.
- Primary "Build new rotation".

## Layout budget — read before changing these screens
The frame is 380×844 and the content column between header and footer is the flexible element, so
every pixel added above or below comes out of the list. This bit the design repeatedly in review:
- `1c`'s two stacked answer buttons are at 68px; they were 84px and pushed the footer off-screen;
- `1d` fits its section labels, chips, nudge row, stat trio and fairness line with nothing to
  spare — the "TEAMS · TIGERS FC IS YOUR ONE FREE TEAM" pattern of folding a sentence into a
  section label exists because a separate line did not fit;
- the sticky footer button is 64px plus 20px padding on every parent screen and is never negotiable.

After any change, confirm the footer button is fully inside the frame and the content column
scrolls rather than clips.

## Accessibility
- Contrast: body text meets 4.5:1, headline-scale type 3:1. `#96772F` on `#FBE3A6` and `#B4462F` on
  white were chosen for this; do not lighten them.
- Hit targets: minimum 44px. The note chips and player rows are at that floor already.
- Answer state must be conveyed in text, not colour alone — `In ✓` / `Out` / `Waiting` carry it.
- The parent pages are web pages on unknown devices: they must work at 320px wide and at 200% text
  size, and every control must be reachable by keyboard.
