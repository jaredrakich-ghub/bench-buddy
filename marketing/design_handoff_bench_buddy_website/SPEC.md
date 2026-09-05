# Bench Buddy marketing site — build specification

Everything needed to build the approved design as a production website: assets,
tokens, section-by-section layout, every string of copy verbatim, and the two
pieces of JavaScript the page depends on.

Reference implementation: `Bench Buddy Website.dc.html`.

---

## 1. What this is

A single-page marketing site with eight content sections, the last of which
carries the footer. Its purpose is one conversion: app download. There is no
secondary navigation, no blog, no pricing — every link on the page resolves to
either `#story` or `#get`.

The page is a static document. No framework is required — semantic HTML, one
stylesheet and roughly 80 lines of vanilla JavaScript will reproduce it exactly.
Two behaviours are not optional and are specified in section 8: video autoplay
wiring and visibility-gated playback.

## 2. Assets to supply

| Asset | Detail |
| --- | --- |
| **Fonts** | Google Fonts: Schibsted Grotesk (400, 500, 600, 700), Nunito (400, 500, 600, 700), Baloo 2 (700, 800). Self-host for production; preconnect at minimum. |
| **Logo** | SVG mark, cropped to artwork bounds. 56×56 in header, 42×42 in footer. Current file has a white circular backing, so it only sits on dark grounds — a transparent variant is needed before it can be used on cream. |
| **Video** | 16 clips, H.264 MP4, 1280×720. Listed in section 6. Must be re-encoded and CDN-hosted for production (see section 8). |
| **Screenshots** | 3 app screens at 1170×2532 (iPhone), used in the How it works phone frames. |
| **Store badges** | Official App Store and Google Play badges. The design currently uses placeholder boxes — swap for the real artwork, which has its own mandated clear space. |

## 3. Colour

Two background colours carry the whole page — bone and deep green — with one
intermediate cream as the single step between them. Yellow is reserved for
actions and is never used as a surface. The app green is a graphic colour only:
at 4.0:1 on the darker cream it must not be used for small text anywhere.

| Token | Hex | Used for |
| --- | --- | --- |
| bone | `#F4F1E9` | Page default, Benefits, Saturday mornings |
| cream | `#EAE5D8` | How it works only |
| deep green | `#14251D` | Hero, both acts, final CTA, footer, phone bezels, step numerals |
| near-black green | `#0E1B14` | Video wells behind footage; scrim base at alpha |
| yellow | `#F5B93B` | All buttons, Act two accents, hero eyebrow. Hover `#FFD063` |
| ink | `#14251D` | Headings on light grounds; label on yellow (9.1:1) |
| body | `#4C6157` | Body copy on light grounds (6.1:1 on bone) |
| eyebrow green | `#1F5637` | Section eyebrows on light grounds (6.0:1 on cream) |
| app green | `#2E7D53` | Benefit icons and links only. Never small text. |
| cream on dark | `rgba(244,241,233,.66)` | Footer links and note (7.0:1). Body on dark uses .68, hero .88. |

## 4. Type

**Schibsted Grotesk** 700 for all headings, 600 for eyebrows and buttons.
**Nunito** 500 for body copy. **Baloo 2** 800 for the wordmark only — it is the
single thread back to the app and appears nowhere else. Every size is fluid; the
values below are the literal `clamp()` declarations.

| Role | Size | Other |
| --- | --- | --- |
| Hero h1 | `clamp(36px, 5.6vw, 76px)` | 700 / lh 1.04 / ls −.03em / balance |
| Final CTA h2 | `clamp(40px, 8vw, 104px)` | 700 / lh 1 / ls −.035em |
| Section h2 | `clamp(30px, 4.4vw, 60px)` | 700 / lh 1.06 / ls −.03em |
| Beat h3 (acts) | `clamp(23px, 2.6vw, 36px)` | 700 / lh 1.1 / ls −.03em |
| Card h3 | `clamp(21px, 2vw, 27px)` | 700 / lh 1.16 / ls −.02em |
| Eyebrow | 13px fixed | 600 / ls .16em / uppercase |
| Beat numeral | 12px fixed | 600 / ls .14em |
| Lead paragraph | `clamp(16px, 1.5vw, 20px)` | Nunito 500 / lh 1.5 / pretty |
| Body | `clamp(15px, 1.3vw, 17px)` | Nunito 500 / lh 1.55 |

## 5. Global layout

- Content column: **max-width 1320px**, centred. Final CTA narrows to **1000px**.
- Horizontal page padding, every section: **`clamp(18px, 4vw, 64px)`**.
- Vertical section padding: **`clamp(78px, 11vh, 150px)`** standard; the acts use
  **`clamp(72px, 10vh, 132px)`**; final CTA **`clamp(88px, 14vh, 180px)`**.
- Radii: cards **28px**, video frames **`clamp(18px, 2vw, 26px)`**, phone bezel
  **`clamp(26px, 3vw, 38px)`**, buttons **999px**, store badges **14px**.
- Button heights: header **44px**, hero **60px**, final CTA **64px**. Never below
  44px anywhere.
- Wrapper carries `overflow-x: hidden`. Header is `position: absolute` over the
  hero, not fixed — it scrolls away.

## 6. Sections, in order

### Header

Absolute over the hero. Logo 56px + Baloo 2 wordmark at 21px white with
`text-shadow: 0 1px 8px rgba(10,20,15,.45)` for legibility over footage. Right:
yellow pill, 44px, "Download the App" → `#get`.

### 1 · Hero — full-bleed video, bottom-aligned

`min-height: 100svh` (svh, not vh — mobile browser chrome must not crop the CTA),
content aligned to the bottom. Video *Scene 10 — Celebrating the action*,
`object-fit: cover`, `preload="auto"` (the only clip that preloads).

Two overlays, in order: a flat `rgba(12,26,19,.5)` across the whole frame, then a
gradient `to top, rgba(12,26,19,.52) → transparent` over the bottom 66%. **The
gradient must not be a solid block** — a hard-edged scrim reads as a line across
the video.

Text block caps at **1080px** so the headline holds three lines at full size; the
subhead caps at **600px**. Two buttons: solid yellow "Download the App", and an
outlined "Watch the story" with a play triangle → `#story`.

### 2 · Act one — seven beats, deep green

Anchor `#story`. Eyebrow "Act one" in 62% cream (not yellow — yellow belongs to
Act two). Each beat is one row: a **4/3** video frame at `flex: 1 1 400px` beside
a text column at `flex: 1 1 288px`, gap `clamp(20px, 3vw, 52px)`,
`align-items: center`, wrapping to stacked around 720px. Row gap
`clamp(48px, 6vw, 84px)`. Numerals and frames are plain cream — no yellow
anywhere in this act.

### 3 · The turn — full-bleed hinge

`min-height: clamp(460px, 64svh, 760px)`, content bottom-aligned, same overlay
recipe as the hero but heavier: flat `.46` plus a `.78` gradient over the bottom
72%. Eyebrow returns to yellow here — this is where Emma's half of the story
starts. One headline, one line of copy, no buttons.

### 4 · Act two — five beats plus a closing frame

Identical row geometry to Act one. The only differences: each frame carries
`border-top: 2px solid #F5B93B` and the numerals are yellow.

Closes on a full-width **16/9** frame with a bottom gradient (`.82` over 74%) and
the quote overlaid at `clamp(22px, 3vw, 42px)`, 700 weight, max-width 720px. No
subtitle under the quote.

### 5 · Benefits — five cards, bone ground

`grid-template-columns: repeat(auto-fit, minmax(268px, 1fr))`, gap
`clamp(16px, 1.8vw, 24px)` — lands 3+2 on desktop, 2+2+1 mid, single column on
mobile. Cards are white, radius 28px, padding `clamp(26px, 3vw, 38px)`. Each holds
a 72×52 SVG mark (green `#2E7D53` with a yellow accent), then title and body.
Marks are `aria-hidden`.

### 6 · How it works — three phone frames, cream ground

The only section on `#EAE5D8`. `repeat(auto-fit, minmax(260px, 1fr))`, gap
`clamp(28px, 3.6vw, 52px)`. Phone frame: max-width 290px,
`aspect-ratio: 1170/2532`, deep green bezel with 7px padding and inner radius
`clamp(20px, 2.4vw, 31px)`, shadow `0 22px 44px -22px rgba(20,37,29,.45)`. Below
each: a 34px dark circle numeral beside title and body. Screenshots carry real alt
text.

### 7 · Saturday mornings — split, bone ground

Two-up `repeat(auto-fit, minmax(320px, 1fr))`, `align-items: center`, gap
`clamp(32px, 4vw, 64px)`. Left: a **4/5** video frame (Scene 11), radius
`clamp(24px, 3vw, 34px)`. Right: eyebrow, headline at
`clamp(28px, 3.8vw, 52px)`, one paragraph capped at 560px.

### 8 · Final CTA and footer

Anchor `#get`. Deep green, centred, max-width 1000px: one oversized headline, one
yellow pill at 64px, then the two store badges (56px tall, 1.5px cream outline at
30%).

Footer sits on the same green with a `1px rgba(244,241,233,.14)` top rule: 42px
logo and wordmark left, four links centre, "Free to use. No spam." right. Footer
links carry **13px vertical padding** to clear 44px of tap area.

### Video map

| Slot | Source file |
| --- | --- |
| Hero | Scene 10 - Coach Dave - Celebrating the action |
| Act one 01 | Coach Dave - Happy with Static paper plan lower quality |
| Act one 02 | Scene 2 - Child asking when they're going on |
| Act one 03 | Scene 3 - Child asking why he's been subbed |
| Act one 04 | Scene 5 - Unexpected Event - Injury to player |
| Act one 05 | Scene 4 - Kid asking if they have been in goal |
| Act one 06 | Scene 7 - Asking the whole sideline of parents for help |
| Act one 07 | Scene 8 - Turning point - Looking for alternative to paper |
| The turn | Parent Emma - Coach Dave asks if Emma can cover subs |
| Act two 01 | Parent Emma - Lily asks when she is going on |
| Act two 02 | Parent Emma - Asks about his position |
| Act two 03 | Parent Emma - Leo arrives late |
| Act two 04 | Parent Emma - Jack going back on |
| Act two 05 | Parent Emma - Coach Dave thanks Emma for running the subs |
| Act two close | Parent Emma - Mother and Daughter after game |
| Saturday mornings | Scene 11 - Successful Sub |

Unused in the library: Scene 1 (superseded by the lower-quality cut), Scene 6,
*Parent Emma — Sideline Parent asking whos next*, *Coaches talking after the game*.

## 7. Copy, verbatim

Every string on the page, exactly as approved. Reproduce character for character,
including the em dash in the hero subhead and the curly apostrophes. Line breaks
shown as `/` in the hero headline are hard `<br>` elements.

### Header and buttons

| Slot | Exact text |
| --- | --- |
| Header CTA | Download the App |
| Hero CTA | Download the App |
| Hero secondary | Watch the story |
| Final CTA button | Get Bench Buddy |
| Store badge 1 | Download on the / App Store |
| Store badge 2 | Get it on / Google Play |
| Footer links | The story · Download · Privacy · Contact |
| Footer note | Free to use. No spam. |

### 1 · Hero

| Slot | Exact text |
| --- | --- |
| Eyebrow | For coaches, parents and clubs |
| Headline | Fair rotations. / Less thinking. / More time enjoying the game. |
| Subhead | Bench Buddy takes care of substitutions, playing time and goalkeeper rotations—so every child gets a fair game. |

### 2 · Act one

| Slot | Exact text |
| --- | --- |
| Eyebrow | Act one |
| Headline | The Saturday morning every coach knows. |
| Lead | A paper team sheet and the impossible task of remembering who’s had a turn. |
| 01 title | The plan |
| 01 body | An AI-generated plan, ready to implement. |
| 02 title | “When am I going on?” |
| 02 body | I can handle this. My plan tells you exactly when you go on. |
| 03 title | First confusion |
| 03 body | “Why am I coming off? I just came on.” First loss of trust. |
| 04 title | The knock |
| 04 body | A kid gets a knock and needs a quick break — they’ll likely be back soon. The plan has to adapt, and there’s shuffling required. |
| 05 title | Rotation fairness |
| 05 body | Has everyone had a go in goal? |
| 06 title | The blur |
| 06 body | Asking the sideline for help. |
| 07 title | Give-up moment |
| 07 body | Too many changes. Kids and parents are confused. |

### 3 · The turn

| Slot | Exact text |
| --- | --- |
| Eyebrow | The turn |
| Headline | Ten minutes before kick-off, Dave is asked to referee. |
| Body | He hands the subs to Emma, one of the parents. She has never run a rotation before. |

### 4 · Act two

| Slot | Exact text |
| --- | --- |
| Eyebrow | Act two |
| Headline | The same Saturday. Just easier. |
| Lead | Emma opens Bench Buddy. Everything Dave had to keep in his head is already worked out. |
| 01 title | She never has to guess. |
| 01 body | Lily asks when she is going on. Emma reads the answer straight off the screen. |
| 02 title | Every position, already decided. |
| 02 body | Who comes on, and where they play. Nobody has to hold it in their head. |
| 03 title | Late arrivals are fine. |
| 03 body | Leo turns up after kick-off. The rotation re-plans itself around him. |
| 04 title | Managing the knock. |
| 04 body | Jack needed a few minutes off. The app tracks his break and puts him back on when he is ready. |
| 05 title | Life saver. |
| 05 body | A bit to deal with out there. Kids were happy. Thanks for the help. |
| Closing quote | “Did you enjoy the game, Mum?” (no subtitle beneath it) |

### 5 · Benefits

| Slot | Exact text |
| --- | --- |
| Eyebrow | Why Coaches and Parents love it |
| Headline | Five fewer things to hold in your head. |
| Card 1 | Fair from the first whistle — Playing time is shared evenly before the match starts, so every kid gets the minutes they need to develop. |
| Card 2 | Handles the unexpected — Injuries, late arrivals, a change of shape at half time. The rotation re-plans itself and stays fair. |
| Card 3 | Goalkeeper rotations made easy — Set who goes in goal and when. Everyone gets a turn between the posts without you tracking it. |
| Card 4 | Never caught out by a sub — An early nudge before each change, so the next player is warmed up and ready on the touchline. |
| Card 5 | A record of the whole season — Minutes, positions and goalkeeping turns add up week to week, so you can show any parent where their child stands. |

### 6 · How it works

| Slot | Exact text |
| --- | --- |
| Eyebrow | How it works |
| Headline | Set up once. Then enjoy the game. |
| Step 1 | Add your players — Names, shirt numbers, and who is available today. |
| Step 2 | Bench Buddy builds the fairest rotation — Even minutes across the squad, goalkeeper included. |
| Step 3 | Follow the match with confidence — Tap through the subs as they come. Nothing left to remember. |

### 7 · Saturday mornings

| Slot | Exact text |
| --- | --- |
| Eyebrow | Built for real Saturday mornings |
| Headline | Made by a coach on the sideline, not in an office. |
| Body | Bench Buddy was created by a volunteer coach who wanted to spend less time tracking rotations and more time coaching kids. It was built between matches, on muddy pitches, for teams with one coach, no assistant and eleven parents watching. |

### 8 · Final CTA

| Slot | Exact text |
| --- | --- |
| Headline | Enjoy the game again. |

## 8. Behaviour

### Video autoplay — do not skip

Set `muted` and `loop` as DOM *properties* in script:

```js
v.muted = true;
v.loop = true;
v.playsInline = true;
v.defaultMuted = true;
```

Not as markup attributes. If the site is built in React the bare attributes arrive
as `false`, autoplay is refused with `NotAllowedError`, and every clip freezes on
its first frame.

Also handle failure: a broken video paints opaque over whatever sits behind it, so
hide it on `error` and reveal on `loadeddata`, with a 4s timeout as a backstop.

### Visibility-gated playback

One `IntersectionObserver` at `rootMargin: '25% 0px'`, `threshold: 0.01`: play a
clip as it approaches, pause it once it leaves. All story clips are
`preload="none"` — only the hero preloads. Without this gate fourteen 720p clips
download on load. Keep it after moving to a CDN.

### Reveal motion

One effect on the whole site: elements fade up 18px over
`700ms cubic-bezier(.22, .7, .25, 1)`, once each, triggered by an
`IntersectionObserver` at `threshold: 0.01, rootMargin: '0px 0px -8% 0px'`.

Resolve the observer root to the real scrolling ancestor rather than assuming the
viewport, and add a **1200ms failsafe** that reveals anything still hidden — that
is what keeps the page legible if the observer never fires (print, odd embed,
host-owned scroll container). Flag revealed elements so a re-render cannot hide
them again.

Fully suppressed under `prefers-reduced-motion: reduce`. No parallax, no counters,
no scroll-jacking.

### Production video hosting

The reference build streams from `raw.githubusercontent.com`. That is staging
only: it depends on the repo staying public, serves 720p, and supports no range
requests. For production, host on a CDN, supply a `poster` JPG per clip for first
paint, and consider a smaller mobile encode. Payload has not been measured across
the set; the one clip checked was 2.0MB at 720p, so budget on that order per clip
and measure before launch.

## 9. Responsive and accessibility

There are **no media queries**. Type uses `clamp()`, grids use
`auto-fit / minmax()`, and the act rows use `flex-wrap` with flex-basis — every
collapse point comes from the content. Verified 360–1920px. Reproduce it this way
rather than adding breakpoints.

- Every text colour is measured against its resolved background, not assumed. All
  body text clears 4.5:1; figures are in section 3.
- Hero and turn text sit over scrims so contrast holds on any frame of footage.
- All 16 videos are decorative: `aria-hidden="true"`, no captions needed. Benefit
  marks likewise. Phone screenshots carry real alt text.
- Every tap target clears 44px, footer links included.
- One `h1` (hero); each section leads with an `h2`; beats and cards use `h3`.

## 10. Before launch

- Move all 16 clips to a CDN with poster frames; drop the raw.githubusercontent URLs.
- Replace the placeholder store badges with official artwork, and point both plus
  every `#get` CTA at real store URLs.
- Supply a transparent-background logo variant for any future use on cream.
- Write Privacy and Contact destinations — both footer links currently resolve to `#get`.
- Self-host the three font families; add `font-display: swap`.
- Add page title, meta description and an OG image (a hero frame works).
